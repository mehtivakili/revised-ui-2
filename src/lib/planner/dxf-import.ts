import type { PlanWall, Vec2 } from "@/src/domain/planner/types";

type DxfPair = { code: number; value: string };
type DxfChunk = { type: string; pairs: DxfPair[] };
type RawSegment = { a: Vec2; b: Vec2; layer: string };

export type DxfImportResult = {
  walls: PlanWall[];
  unitLabel: string;
  layerCount: number;
  ignoredEntities: number;
  detectedPlanGroups: number;
  discardedSegments: number;
  scaleCorrection: number;
};

const excludedLayer = /(?:^defpoints$|dim|dimension|text|annot|hatch|grid|axis|center|furn|elect|plumb|door|window|opening)/i;
const wallLayer = /(?:wall|a-wall|partition|boundary|دیوار)/i;

function pairsFromText(text: string): DxfPair[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const pairs: DxfPair[] = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = Number.parseInt(lines[index].trim(), 10);
    if (!Number.isFinite(code)) continue;
    pairs.push({ code, value: lines[index + 1].trim() });
  }
  return pairs;
}

function entityChunks(pairs: DxfPair[]): DxfChunk[] {
  const chunks: DxfChunk[] = [];
  let inEntities = false;
  let current: DxfChunk | null = null;
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index];
    if (pair.code === 0 && pair.value.toUpperCase() === "SECTION" && pairs[index + 1]?.code === 2) {
      inEntities = pairs[index + 1].value.toUpperCase() === "ENTITIES";
      current = null;
      continue;
    }
    if (!inEntities) continue;
    if (pair.code === 0 && pair.value.toUpperCase() === "ENDSEC") break;
    if (pair.code === 0) {
      current = { type: pair.value.toUpperCase(), pairs: [] };
      chunks.push(current);
    } else if (current) {
      current.pairs.push(pair);
    }
  }
  return chunks;
}

function firstNumber(pairs: DxfPair[], code: number, fallback = 0): number {
  const value = Number.parseFloat(pairs.find((pair) => pair.code === code)?.value ?? "");
  return Number.isFinite(value) ? value : fallback;
}

function firstText(pairs: DxfPair[], code: number, fallback = "0"): string {
  return pairs.find((pair) => pair.code === code)?.value || fallback;
}

function unitInfo(pairs: DxfPair[]): { scale: number; label: string } {
  const marker = pairs.findIndex((pair) => pair.code === 9 && pair.value.toUpperCase() === "$INSUNITS");
  const code = marker >= 0
    ? Number.parseInt(pairs.slice(marker + 1, marker + 6).find((pair) => pair.code === 70)?.value ?? "0", 10)
    : 0;
  const units: Record<number, { scale: number; label: string }> = {
    0: { scale: 1, label: "بدون واحد؛ متر فرض شد" },
    1: { scale: 0.0254, label: "اینچ" },
    2: { scale: 0.3048, label: "فوت" },
    4: { scale: 0.001, label: "میلی‌متر" },
    5: { scale: 0.01, label: "سانتی‌متر" },
    6: { scale: 1, label: "متر" }
  };
  return units[code] ?? { scale: 1, label: `واحد DXF شماره ${code}؛ متر فرض شد` };
}

function addArc(segments: RawSegment[], center: Vec2, radius: number, startDeg: number, endDeg: number, layer: string) {
  let sweep = endDeg - startDeg;
  while (sweep <= 0) sweep += 360;
  const steps = Math.max(2, Math.ceil(sweep / 10));
  let previous = {
    x: center.x + Math.cos(startDeg * Math.PI / 180) * radius,
    z: center.z + Math.sin(startDeg * Math.PI / 180) * radius
  };
  for (let index = 1; index <= steps; index += 1) {
    const radians = (startDeg + sweep * index / steps) * Math.PI / 180;
    const next = { x: center.x + Math.cos(radians) * radius, z: center.z + Math.sin(radians) * radius };
    segments.push({ a: previous, b: next, layer });
    previous = next;
  }
}

function addBulgedEdge(segments: RawSegment[], a: Vec2, b: Vec2, bulge: number, layer: string) {
  if (Math.abs(bulge) < 1e-7) {
    segments.push({ a, b, layer });
    return;
  }
  const chord = Math.hypot(b.x - a.x, b.z - a.z);
  if (chord < 1e-7) return;
  const sweep = 4 * Math.atan(bulge);
  const midpoint = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  const left = { x: -(b.z - a.z) / chord, z: (b.x - a.x) / chord };
  const centreOffset = chord / (2 * Math.tan(sweep / 2));
  const center = { x: midpoint.x + left.x * centreOffset, z: midpoint.z + left.z * centreOffset };
  const start = Math.atan2(a.z - center.z, a.x - center.x);
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 18)));
  let previous = a;
  for (let index = 1; index <= steps; index += 1) {
    const angle = start + sweep * index / steps;
    const next = index === steps
      ? b
      : { x: center.x + Math.cos(angle) * Math.hypot(a.x - center.x, a.z - center.z), z: center.z + Math.sin(angle) * Math.hypot(a.x - center.x, a.z - center.z) };
    segments.push({ a: previous, b: next, layer });
    previous = next;
  }
}

function lightweightVertices(pairs: DxfPair[]): Array<Vec2 & { bulge: number }> {
  const vertices: Array<Vec2 & { bulge: number }> = [];
  for (const pair of pairs) {
    if (pair.code === 10) {
      vertices.push({ x: Number.parseFloat(pair.value), z: 0, bulge: 0 });
    } else if (pair.code === 20 && vertices.length) {
      vertices[vertices.length - 1].z = Number.parseFloat(pair.value);
    } else if (pair.code === 42 && vertices.length) {
      vertices[vertices.length - 1].bulge = Number.parseFloat(pair.value) || 0;
    }
  }
  return vertices.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.z));
}

function polylineSegments(segments: RawSegment[], vertices: Array<Vec2 & { bulge: number }>, closed: boolean, layer: string) {
  const count = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < count; index += 1) {
    const next = vertices[(index + 1) % vertices.length];
    addBulgedEdge(segments, vertices[index], next, vertices[index].bulge, layer);
  }
}

function rawSegments(chunks: DxfChunk[]): { segments: RawSegment[]; ignored: number } {
  const segments: RawSegment[] = [];
  let ignored = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const layer = firstText(chunk.pairs, 8);
    if (chunk.type === "LINE") {
      segments.push({
        a: { x: firstNumber(chunk.pairs, 10), z: firstNumber(chunk.pairs, 20) },
        b: { x: firstNumber(chunk.pairs, 11), z: firstNumber(chunk.pairs, 21) },
        layer
      });
    } else if (chunk.type === "LWPOLYLINE") {
      polylineSegments(segments, lightweightVertices(chunk.pairs), (firstNumber(chunk.pairs, 70) & 1) === 1, layer);
    } else if (chunk.type === "POLYLINE") {
      const vertices: Array<Vec2 & { bulge: number }> = [];
      let cursor = index + 1;
      while (chunks[cursor]?.type === "VERTEX") {
        vertices.push({
          x: firstNumber(chunks[cursor].pairs, 10),
          z: firstNumber(chunks[cursor].pairs, 20),
          bulge: firstNumber(chunks[cursor].pairs, 42)
        });
        cursor += 1;
      }
      polylineSegments(segments, vertices, (firstNumber(chunk.pairs, 70) & 1) === 1, layer);
      index = cursor - 1;
    } else if (chunk.type === "ARC") {
      addArc(segments, { x: firstNumber(chunk.pairs, 10), z: firstNumber(chunk.pairs, 20) }, firstNumber(chunk.pairs, 40), firstNumber(chunk.pairs, 50), firstNumber(chunk.pairs, 51), layer);
    } else if (chunk.type === "CIRCLE") {
      addArc(segments, { x: firstNumber(chunk.pairs, 10), z: firstNumber(chunk.pairs, 20) }, firstNumber(chunk.pairs, 40), 0, 360, layer);
    } else if (!["VERTEX", "SEQEND"].includes(chunk.type)) {
      ignored += 1;
    }
  }
  return { segments, ignored };
}

function pointKey(point: Vec2): string {
  return `${point.x.toFixed(4)},${point.z.toFixed(4)}`;
}

function uniqueSegments(segments: RawSegment[]) {
  const seen = new Set<string>();
  return segments.filter((segment) => {
    const key = [pointKey(segment.a), pointKey(segment.b)].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function connectedGroups(segments: RawSegment[], toleranceM = 0.08) {
  const parent = segments.map((_, index) => index);
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const join = (left: number, right: number) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };
  const grid = new Map<string, Array<{ index: number; point: Vec2 }>>();
  const cell = (point: Vec2) => ({ x: Math.round(point.x / toleranceM), z: Math.round(point.z / toleranceM) });
  segments.forEach((segment, index) => {
    for (const point of [segment.a, segment.b]) {
      const at = cell(point);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          for (const candidate of grid.get(`${at.x + dx},${at.z + dz}`) ?? []) {
            if (Math.hypot(point.x - candidate.point.x, point.z - candidate.point.z) <= toleranceM) join(index, candidate.index);
          }
        }
      }
      const key = `${at.x},${at.z}`;
      grid.set(key, [...(grid.get(key) ?? []), { index, point }]);
    }
  });
  const groups = new Map<number, RawSegment[]>();
  segments.forEach((segment, index) => groups.set(find(index), [...(groups.get(find(index)) ?? []), segment]));
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

function mergeCollinearChains(source: RawSegment[]) {
  const segments = [...source];
  const nodeKey = (point: Vec2) => `${Math.round(point.x / 0.015)},${Math.round(point.z / 0.015)}`;
  for (let pass = 0; pass < source.length; pass += 1) {
    const nodes = new Map<string, Array<{ index: number; end: "a" | "b" }>>();
    segments.forEach((segment, index) => {
      for (const end of ["a", "b"] as const) {
        const key = nodeKey(segment[end]);
        nodes.set(key, [...(nodes.get(key) ?? []), { index, end }]);
      }
    });
    let merged = false;
    for (const entries of nodes.values()) {
      if (entries.length !== 2 || entries[0].index === entries[1].index) continue;
      const left = segments[entries[0].index];
      const right = segments[entries[1].index];
      const jointLeft = left[entries[0].end];
      const jointRight = right[entries[1].end];
      if (Math.hypot(jointLeft.x - jointRight.x, jointLeft.z - jointRight.z) > 0.03) continue;
      const otherLeft = left[entries[0].end === "a" ? "b" : "a"];
      const otherRight = right[entries[1].end === "a" ? "b" : "a"];
      const v1 = { x: otherLeft.x - jointLeft.x, z: otherLeft.z - jointLeft.z };
      const v2 = { x: otherRight.x - jointRight.x, z: otherRight.z - jointRight.z };
      const lengthProduct = Math.hypot(v1.x, v1.z) * Math.hypot(v2.x, v2.z);
      if (lengthProduct < 1e-8) continue;
      const cross = Math.abs(v1.x * v2.z - v1.z * v2.x) / lengthProduct;
      const dot = (v1.x * v2.x + v1.z * v2.z) / lengthProduct;
      if (cross > Math.sin(2 * Math.PI / 180) || dot > -0.99) continue;
      const remove = [entries[0].index, entries[1].index].sort((a, b) => b - a);
      remove.forEach((index) => segments.splice(index, 1));
      segments.push({ a: otherLeft, b: otherRight, layer: left.layer });
      merged = true;
      break;
    }
    if (!merged) break;
  }
  return segments;
}

/**
 * CAD drawings commonly split one visible wall at every crossing, block boundary
 * and dimension anchor.  The planner treats every one of those pieces as a wall,
 * so joining continuous runs is essential before creating editable objects.
 */
function mergeCollinearRuns(source: RawSegment[]) {
  type Run = { start: number; end: number; layer: string };
  type Bucket = { direction: Vec2; normal: Vec2; offset: number; runs: Run[] };
  const buckets = new Map<string, Bucket>();

  for (const segment of source) {
    const dx = segment.b.x - segment.a.x;
    const dz = segment.b.z - segment.a.z;
    const length = Math.hypot(dx, dz);
    if (length < 1e-8) continue;
    let direction = { x: dx / length, z: dz / length };
    if (direction.x < -1e-6 || (Math.abs(direction.x) <= 1e-6 && direction.z < 0)) {
      direction = { x: -direction.x, z: -direction.z };
    }
    const normal = { x: -direction.z, z: direction.x };
    const angle = Math.atan2(direction.z, direction.x);
    const offset = segment.a.x * normal.x + segment.a.z * normal.z;
    const key = `${Math.round(angle / (Math.PI / 360))}:${Math.round(offset / 0.015)}`;
    const bucket = buckets.get(key) ?? { direction, normal, offset, runs: [] };
    const left = segment.a.x * direction.x + segment.a.z * direction.z;
    const right = segment.b.x * direction.x + segment.b.z * direction.z;
    bucket.runs.push({ start: Math.min(left, right), end: Math.max(left, right), layer: segment.layer });
    buckets.set(key, bucket);
  }

  const result: RawSegment[] = [];
  for (const bucket of buckets.values()) {
    const ordered = bucket.runs.sort((a, b) => a.start - b.start || a.end - b.end);
    const merged: Run[] = [];
    for (const run of ordered) {
      const previous = merged.at(-1);
      if (previous && run.start <= previous.end + 0.025) {
        previous.end = Math.max(previous.end, run.end);
      } else {
        merged.push({ ...run });
      }
    }
    for (const run of merged) {
      result.push({
        a: {
          x: bucket.direction.x * run.start + bucket.normal.x * bucket.offset,
          z: bucket.direction.z * run.start + bucket.normal.z * bucket.offset
        },
        b: {
          x: bucket.direction.x * run.end + bucket.normal.x * bucket.offset,
          z: bucket.direction.z * run.end + bucket.normal.z * bucket.offset
        },
        layer: run.layer
      });
    }
  }
  return result;
}

function cleanDenseCadSegments(source: RawSegment[]) {
  const unique = uniqueSegments(source).filter((segment) => Math.hypot(segment.b.x - segment.a.x, segment.b.z - segment.a.z) >= 0.08);
  const groups = connectedGroups(unique);
  const meaningful = groups.filter((group) => group.length >= 10);
  const selected = meaningful[0] ?? groups[0] ?? [];
  const cleaned = mergeCollinearRuns(mergeCollinearChains(selected));
  return {
    segments: cleaned,
    detectedPlanGroups: meaningful.length || (selected.length ? 1 : 0),
    discardedSegments: Math.max(0, source.length - cleaned.length)
  };
}

/** Converts practical ASCII DXF linework to centred, metre-based editable walls. */
export function importDxfWalls(text: string, defaults: { heightM: number; thicknessM: number }): DxfImportResult {
  const pairs = pairsFromText(text);
  if (!pairs.some((pair) => pair.code === 0 && pair.value.toUpperCase() === "SECTION")) {
    throw new Error("ساختار فایل DXF معتبر نیست یا فایل به‌صورت Binary ذخیره شده است.");
  }
  const units = unitInfo(pairs);
  const parsed = rawSegments(entityChunks(pairs));
  const clean = parsed.segments.filter((segment) => !excludedLayer.test(segment.layer));
  const preferred = clean.filter((segment) => wallLayer.test(segment.layer));
  const source = preferred.length >= 2 ? preferred : clean;
  if (!source.length) throw new Error("هیچ خط یا Polyline قابل تبدیل به دیوار در فایل پیدا نشد.");

  const scaled = source.map((segment) => ({
    ...segment,
    a: { x: segment.a.x * units.scale, z: segment.a.z * units.scale },
    b: { x: segment.b.x * units.scale, z: segment.b.z * units.scale }
  })).filter((segment) => Math.hypot(segment.b.x - segment.a.x, segment.b.z - segment.a.z) >= 0.04);
  if (!scaled.length) throw new Error("خطوط فایل بعد از تبدیل واحد، کوتاه‌تر از حد قابل استفاده‌اند.");

  const cleanup = scaled.length >= 400
    ? cleanDenseCadSegments(scaled)
    : { segments: scaled, detectedPlanGroups: 1, discardedSegments: 0 };
  let drawingSegments = cleanup.segments;

  // A surprising number of DWG files advertise inches while their model-space
  // coordinates were authored as decimal architectural units.  With the normal
  // conversion those plans become one or two metres wide and the planner's
  // 20-cm walls cover the entire drawing.  Only correct this clearly impossible
  // dense-plan case, and use powers of ten so the original proportions remain
  // untouched and the adjustment is predictable.
  const importedPoints = drawingSegments.flatMap((segment) => [segment.a, segment.b]);
  const importedSpan = Math.max(
    Math.max(...importedPoints.map((point) => point.x)) - Math.min(...importedPoints.map((point) => point.x)),
    Math.max(...importedPoints.map((point) => point.z)) - Math.min(...importedPoints.map((point) => point.z))
  );
  let scaleCorrection = 1;
  if (scaled.length >= 400 && importedSpan > 0 && importedSpan < 5) {
    while (importedSpan * scaleCorrection < 10) scaleCorrection *= 10;
    drawingSegments = drawingSegments.map((segment) => ({
      ...segment,
      a: { x: segment.a.x * scaleCorrection, z: segment.a.z * scaleCorrection },
      b: { x: segment.b.x * scaleCorrection, z: segment.b.z * scaleCorrection }
    }));
  }

  const points = drawingSegments.flatMap((segment) => [segment.a, segment.b]);
  const center = {
    x: (Math.min(...points.map((point) => point.x)) + Math.max(...points.map((point) => point.x))) / 2,
    z: (Math.min(...points.map((point) => point.z)) + Math.max(...points.map((point) => point.z))) / 2
  };
  const unique = new Set<string>();
  const walls: PlanWall[] = [];
  drawingSegments.forEach((segment, index) => {
    const a = { x: segment.a.x - center.x, z: segment.a.z - center.z };
    const b = { x: segment.b.x - center.x, z: segment.b.z - center.z };
    const key = [pointKey(a), pointKey(b)].sort().join("|");
    if (unique.has(key)) return;
    unique.add(key);
    walls.push({
      id: `dxf-wall-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
      a,
      b,
      heightM: defaults.heightM,
      thicknessM: defaults.thicknessM,
      blocksView: true
    });
  });

  return {
    walls,
    unitLabel: units.label,
    layerCount: new Set(source.map((segment) => segment.layer)).size,
    ignoredEntities: parsed.ignored,
    detectedPlanGroups: cleanup.detectedPlanGroups,
    discardedSegments: cleanup.discardedSegments,
    scaleCorrection
  };
}
