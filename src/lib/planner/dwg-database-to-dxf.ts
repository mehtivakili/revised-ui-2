import type {
  DwgArcEntity,
  DwgCircleEntity,
  DwgDatabase,
  DwgEntity,
  DwgEllipseEntity,
  DwgInsertEntity,
  DwgLineEntity,
  DwgLWPolylineEntity,
  DwgMLineEntity,
  DwgPolyline2dEntity,
  DwgPolyline3dEntity,
  DwgSplineEntity
} from "@mlightcad/libredwg-web";

type Affine = { a: number; b: number; c: number; d: number; tx: number; ty: number };
const identity: Affine = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

function applyPoint(transform: Affine, point: { x: number; y: number }) {
  return {
    x: transform.a * point.x + transform.b * point.y + transform.tx,
    y: transform.c * point.x + transform.d * point.y + transform.ty
  };
}

function compose(parent: Affine, local: Affine): Affine {
  return {
    a: parent.a * local.a + parent.b * local.c,
    b: parent.a * local.b + parent.b * local.d,
    c: parent.c * local.a + parent.d * local.c,
    d: parent.c * local.b + parent.d * local.d,
    tx: parent.a * local.tx + parent.b * local.ty + parent.tx,
    ty: parent.c * local.tx + parent.d * local.ty + parent.ty
  };
}

function cleanLayer(layer?: string) {
  return (layer || "0").replace(/[\r\n]/g, " ").slice(0, 200);
}

function finite(...values: number[]) {
  return values.every(Number.isFinite);
}

function lineEntity(entity: DwgLineEntity, transform: Affine, inheritedLayer?: string) {
  if (!finite(entity.startPoint.x, entity.startPoint.y, entity.endPoint.x, entity.endPoint.y)) return [];
  const start = applyPoint(transform, entity.startPoint);
  const end = applyPoint(transform, entity.endPoint);
  return ["0", "LINE", "8", cleanLayer(entity.layer === "0" ? inheritedLayer : entity.layer), "10", String(start.x), "20", String(start.y), "11", String(end.x), "21", String(end.y)];
}

function lightweightPolyline(entity: DwgLWPolylineEntity | DwgPolyline2dEntity | DwgPolyline3dEntity, transform: Affine, inheritedLayer?: string) {
  const vertices = entity.vertices.filter((vertex) => finite(vertex.x, vertex.y));
  if (vertices.length < 2) return [];
  const output = ["0", "LWPOLYLINE", "8", cleanLayer(entity.layer === "0" ? inheritedLayer : entity.layer), "90", String(vertices.length), "70", String(entity.flag & 1)];
  for (const vertex of vertices) {
    const point = applyPoint(transform, vertex);
    output.push("10", String(point.x), "20", String(point.y));
    if ("bulge" in vertex && Number.isFinite(vertex.bulge) && vertex.bulge !== 0) output.push("42", String(vertex.bulge));
  }
  return output;
}

function sampledArc(entity: DwgArcEntity | DwgCircleEntity, transform: Affine, inheritedLayer?: string) {
  const isCircle = entity.type === "CIRCLE";
  const start = isCircle ? 0 : entity.startAngle;
  let sweep = isCircle ? Math.PI * 2 : entity.endAngle - entity.startAngle;
  while (sweep <= 0) sweep += Math.PI * 2;
  const steps = Math.max(8, Math.ceil(sweep / (Math.PI / 18)));
  const output = ["0", "LWPOLYLINE", "8", cleanLayer(entity.layer === "0" ? inheritedLayer : entity.layer), "90", String(steps + (isCircle ? 0 : 1)), "70", isCircle ? "1" : "0"];
  const count = isCircle ? steps : steps + 1;
  for (let index = 0; index < count; index += 1) {
    const angle = start + sweep * index / steps;
    const point = applyPoint(transform, {
      x: entity.center.x + Math.cos(angle) * entity.radius,
      y: entity.center.y + Math.sin(angle) * entity.radius
    });
    output.push("10", String(point.x), "20", String(point.y));
  }
  return output;
}

function arcEntity(entity: DwgArcEntity, transform: Affine, inheritedLayer?: string) {
  if (!finite(entity.center.x, entity.center.y, entity.radius, entity.startAngle, entity.endAngle) || entity.radius <= 0) return [];
  return sampledArc(entity, transform, inheritedLayer);
}

function circleEntity(entity: DwgCircleEntity, transform: Affine, inheritedLayer?: string) {
  if (!finite(entity.center.x, entity.center.y, entity.radius) || entity.radius <= 0) return [];
  return sampledArc(entity, transform, inheritedLayer);
}

function pointSequence(layer: string | undefined, points: Array<{ x: number; y: number }>, closed: boolean, transform: Affine, inheritedLayer?: string) {
  const valid = points.filter((point) => finite(point.x, point.y));
  if (valid.length < 2) return [];
  const output = ["0", "LWPOLYLINE", "8", cleanLayer(layer === "0" ? inheritedLayer : layer), "90", String(valid.length), "70", closed ? "1" : "0"];
  for (const source of valid) {
    const point = applyPoint(transform, source);
    output.push("10", String(point.x), "20", String(point.y));
  }
  return output;
}

function mlineEntity(entity: DwgMLineEntity, transform: Affine, inheritedLayer?: string) {
  return pointSequence(entity.layer, entity.vertices.map((item) => item.vertex), (entity.flags & 2) === 2, transform, inheritedLayer);
}

function splineEntity(entity: DwgSplineEntity, transform: Affine, inheritedLayer?: string) {
  const points = entity.fitPoints?.length >= 2 ? entity.fitPoints : entity.controlPoints;
  return pointSequence(entity.layer, points, (entity.flag & 1) === 1, transform, inheritedLayer);
}

function ellipseEntity(entity: DwgEllipseEntity, transform: Affine, inheritedLayer?: string) {
  const majorRadius = Math.hypot(entity.majorAxisEndPoint.x, entity.majorAxisEndPoint.y);
  if (!finite(entity.center.x, entity.center.y, majorRadius, entity.axisRatio, entity.startAngle, entity.endAngle) || majorRadius <= 0) return [];
  const majorAngle = Math.atan2(entity.majorAxisEndPoint.y, entity.majorAxisEndPoint.x);
  let sweep = entity.endAngle - entity.startAngle;
  while (sweep <= 0) sweep += Math.PI * 2;
  const closed = Math.abs(sweep - Math.PI * 2) < 1e-4;
  const steps = Math.max(12, Math.ceil(sweep / (Math.PI / 18)));
  const count = closed ? steps : steps + 1;
  const points = Array.from({ length: count }, (_, index) => {
    const angle = entity.startAngle + sweep * index / steps;
    const localX = Math.cos(angle) * majorRadius;
    const localY = Math.sin(angle) * majorRadius * entity.axisRatio;
    return {
      x: entity.center.x + Math.cos(majorAngle) * localX - Math.sin(majorAngle) * localY,
      y: entity.center.y + Math.sin(majorAngle) * localX + Math.cos(majorAngle) * localY
    };
  });
  return pointSequence(entity.layer, points, closed, transform, inheritedLayer);
}

function entityPairs(entity: DwgEntity, transform: Affine, inheritedLayer?: string): string[] {
  if (entity.isInPaperSpace || entity.isVisible === false) return [];
  switch (entity.type) {
    case "LINE": return lineEntity(entity as DwgLineEntity, transform, inheritedLayer);
    case "LWPOLYLINE": return lightweightPolyline(entity as DwgLWPolylineEntity, transform, inheritedLayer);
    case "POLYLINE2D": return lightweightPolyline(entity as DwgPolyline2dEntity, transform, inheritedLayer);
    case "POLYLINE3D": return lightweightPolyline(entity as DwgPolyline3dEntity, transform, inheritedLayer);
    case "ARC": return arcEntity(entity as DwgArcEntity, transform, inheritedLayer);
    case "CIRCLE": return circleEntity(entity as DwgCircleEntity, transform, inheritedLayer);
    case "ELLIPSE": return ellipseEntity(entity as DwgEllipseEntity, transform, inheritedLayer);
    case "MLINE": return mlineEntity(entity as DwgMLineEntity, transform, inheritedLayer);
    case "SPLINE": return splineEntity(entity as DwgSplineEntity, transform, inheritedLayer);
    default: return [];
  }
}

function insertTransform(insert: DwgInsertEntity, basePoint: { x: number; y: number }, column = 0, row = 0): Affine {
  const angle = Number.isFinite(insert.rotation) ? insert.rotation : 0;
  const sx = Number.isFinite(insert.xScale) && insert.xScale !== 0 ? insert.xScale : 1;
  const sy = Number.isFinite(insert.yScale) && insert.yScale !== 0 ? insert.yScale : 1;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const a = cosine * sx;
  const b = -sine * sy;
  const c = sine * sx;
  const d = cosine * sy;
  const offsetX = column * (insert.columnSpacing || 0);
  const offsetY = row * (insert.rowSpacing || 0);
  return {
    a, b, c, d,
    tx: insert.insertionPoint.x + cosine * offsetX - sine * offsetY - a * basePoint.x - b * basePoint.y,
    ty: insert.insertionPoint.y + sine * offsetX + cosine * offsetY - c * basePoint.x - d * basePoint.y
  };
}

function expandedEntityPairs(database: DwgDatabase): string[] {
  const records = database.tables?.BLOCK_RECORD?.entries ?? [];
  const byName = new Map(records.map((record) => [record.name, record]));
  const expand = (entities: DwgEntity[], transform: Affine, inheritedLayer?: string, stack: string[] = []): string[] => entities.flatMap((entity) => {
    if (entity.type !== "INSERT") return entityPairs(entity, transform, inheritedLayer);
    const insert = entity as DwgInsertEntity;
    const block = byName.get(insert.name);
    if (!block || stack.includes(insert.name) || stack.length >= 12) return [];
    const columns = Math.max(1, Math.min(50, insert.columnCount || 1));
    const rows = Math.max(1, Math.min(50, insert.rowCount || 1));
    const output: string[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        output.push(...expand(
          block.entities,
          compose(transform, insertTransform(insert, block.basePoint, column, row)),
          insert.layer === "0" ? inheritedLayer : insert.layer,
          [...stack, insert.name]
        ));
      }
    }
    return output;
  });
  const modelEntities = expandedModelEntities(database, records);
  return expand(modelEntities, identity);
}

function expandedModelEntities(database: DwgDatabase, records: DwgDatabase["tables"]["BLOCK_RECORD"]["entries"]): DwgEntity[] {
  if (database.entities?.length) return database.entities;
  return records.find((record) => /\*model[_ ]space/i.test(record.name))?.entities ?? [];
}

/** Builds a minimal ASCII DXF from the recoverable model-space geometry in a DWG database. */
export function recoverDxfFromDwgDatabase(database: DwgDatabase): Uint8Array | null {
  const entities = expandedEntityPairs(database);
  if (!entities.length) return null;
  const units = Number.isInteger(database.header.INSUNITS) ? database.header.INSUNITS : 0;
  const lines = [
    "0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", String(units), "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES", ...entities, "0", "ENDSEC", "0", "EOF", ""
  ];
  return new TextEncoder().encode(lines.join("\n"));
}

/** Safe diagnostic used when a drawing opens but contains no recoverable linework. */
export function dwgEntityTypeSummary(database: DwgDatabase) {
  const counts = new Map<string, number>();
  const collect = (entities?: DwgEntity[]) => entities?.forEach((entity) => counts.set(entity.type, (counts.get(entity.type) ?? 0) + 1));
  collect(database.entities);
  database.tables?.BLOCK_RECORD?.entries?.forEach((record) => collect(record.entities));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([type, count]) => `${type}:${count}`).join(", ");
}
