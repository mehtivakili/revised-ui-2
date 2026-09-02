import assert from "node:assert/strict";
import test from "node:test";

import { MAX_DWG_BYTES, validateDwgUpload } from "@/src/lib/planner/dwg-import.ts";
import { dwgEntityTypeSummary, recoverDxfFromDwgDatabase } from "@/src/lib/planner/dwg-database-to-dxf.ts";
import { importDxfWalls } from "@/src/lib/planner/dxf-import.ts";

test("DWG upload rejects files with a different extension", () => {
  const result = validateDwgUpload({ name: "plan.txt", size: 6 }, "AC1027");
  assert.equal(result?.status, 415);
  assert.match(result?.message ?? "", /DWG/);
});

test("DWG upload validates size and binary signature before starting WebAssembly", () => {
  assert.equal(validateDwgUpload({ name: "plan.dwg", size: 100 }, "invalid")?.status, 422);
  assert.equal(validateDwgUpload({ name: "plan.dwg", size: MAX_DWG_BYTES + 1 }, "AC1027")?.status, 413);
  assert.equal(validateDwgUpload({ name: "plan.dwg", size: 100 }, "AC1027"), null);
});

test("recoverable DWG database geometry becomes editable DXF walls", () => {
  const database = {
    header: { INSUNITS: 6 },
    tables: { BLOCK_RECORD: { entries: [] } },
    entities: [
      { type: "LINE", layer: "A-WALL", startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 8, y: 0, z: 0 } },
      { type: "LWPOLYLINE", layer: "A-WALL", flag: 0, vertices: [{ x: 8, y: 0, bulge: 0 }, { x: 8, y: 5, bulge: 0 }] },
      { type: "TEXT", layer: "ANNOTATION" }
    ]
  };
  const bytes = recoverDxfFromDwgDatabase(database);
  assert.ok(bytes);
  const imported = importDxfWalls(new TextDecoder().decode(bytes), { heightM: 3, thicknessM: 0.2 });
  assert.equal(imported.walls.length, 2);
  assert.equal(imported.unitLabel, "متر");
});

test("DWG block inserts are expanded with their placement transform", () => {
  const database = {
    header: { INSUNITS: 6 },
    tables: { BLOCK_RECORD: { entries: [{
      name: "ROOM-WALLS",
      basePoint: { x: 0, y: 0, z: 0 },
      entities: [{ type: "LINE", layer: "0", startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 4, y: 0, z: 0 } }]
    }] } },
    entities: [{
      type: "INSERT", name: "ROOM-WALLS", layer: "A-WALL", insertionPoint: { x: 10, y: 5, z: 0 },
      xScale: 1, yScale: 1, rotation: Math.PI / 2, columnCount: 1, rowCount: 1
    }]
  };
  const bytes = recoverDxfFromDwgDatabase(database);
  assert.ok(bytes);
  const imported = importDxfWalls(new TextDecoder().decode(bytes), { heightM: 3, thicknessM: 0.2 });
  assert.equal(imported.walls.length, 1);
  assert.ok(Math.abs(imported.walls[0].a.x - imported.walls[0].b.x) < 1e-6, "rotated block line should be vertical");
});

test("DWG recovery recognises architectural MLINE and reports unsupported entity types", () => {
  const database = {
    header: { INSUNITS: 6 },
    tables: { BLOCK_RECORD: { entries: [] } },
    entities: [{
      type: "MLINE", layer: "A-WALL", flags: 0,
      vertices: [{ vertex: { x: 0, y: 0, z: 0 } }, { vertex: { x: 6, y: 0, z: 0 } }]
    }, { type: "PROXY_ENTITY", layer: "0" }]
  };
  const bytes = recoverDxfFromDwgDatabase(database);
  assert.ok(bytes);
  assert.equal(importDxfWalls(new TextDecoder().decode(bytes), { heightM: 3, thicknessM: 0.2 }).walls.length, 1);
  assert.match(dwgEntityTypeSummary(database), /PROXY_ENTITY:1/);
});
