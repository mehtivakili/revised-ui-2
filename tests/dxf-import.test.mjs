import assert from "node:assert/strict";
import test from "node:test";

import { importDxfWalls } from "@/src/lib/planner/dxf-import.ts";

const dxf = `0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
A-WALL
10
0
20
0
11
5000
21
0
0
LWPOLYLINE
8
A-WALL
70
1
10
0
20
0
10
5000
20
0
10
5000
20
3000
10
0
20
3000
0
LINE
8
A-DOOR
10
1000
20
0
11
2000
21
0
0
ARC
8
A-WALL
10
2500
20
1500
40
500
50
0
51
90
0
ENDSEC
0
EOF`;

test("ASCII DXF imports metre-scaled editable wall and curve segments", () => {
  const result = importDxfWalls(dxf, { heightM: 3.2, thicknessM: 0.2 });
  assert.equal(result.unitLabel, "میلی‌متر");
  assert.equal(result.layerCount, 1);
  assert.equal(result.scaleCorrection, 1);
  assert.ok(result.walls.length >= 12, "closed polyline and arc should both be segmented");
  assert.ok(result.walls.every((wall) => wall.heightM === 3.2 && wall.thicknessM === 0.2));
  const points = result.walls.flatMap((wall) => [wall.a, wall.b]);
  const width = Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
  assert.ok(Math.abs(width - 5) < 1e-6, `millimetres should become a five metre width, got ${width}`);
});

test("dense CAD imports keep the main plan and merge fragmented collinear walls", () => {
  const line = (x1, y1, x2, y2) => `0\nLINE\n8\nA-WALL\n10\n${x1}\n20\n${y1}\n11\n${x2}\n21\n${y2}\n`;
  let entities = "";
  for (let index = 0; index < 260; index += 1) entities += line(index * 100, 0, (index + 1) * 100, 0);
  for (let index = 0; index < 150; index += 1) entities += line(index * 100, 5000, (index + 1) * 100, 5000);
  const denseDxf = `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF`;

  const result = importDxfWalls(denseDxf, { heightM: 3, thicknessM: 0.2 });
  assert.equal(result.detectedPlanGroups, 2);
  assert.equal(result.walls.length, 1);
  assert.ok(result.discardedSegments >= 409);
  assert.equal(result.scaleCorrection, 1);
});

test("binary or malformed CAD input is rejected with a useful error", () => {
  assert.throws(
    () => importDxfWalls("not a DXF", { heightM: 3, thicknessM: 0.2 }),
    /DXF معتبر نیست/
  );
});
