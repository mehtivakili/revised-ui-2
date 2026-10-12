import type * as THREE_NS from "three";
import type { PlanObstacle } from "@/src/domain/planner/types";
import { buildObstacleMesh, disposeGroup } from "@/src/lib/planner/scene-builders";
import { appearances, proportions, type Appearance } from "@/src/lib/planner/crowd/appearances";
import { groundAt } from "@/src/lib/planner/crowd/navigation";
import type { Agent, CrowdState } from "@/src/lib/planner/crowd/simulation";

/**
 * 3D figures and cars for the dynamic environment.
 *
 * A person is a small jointed figure built to scale from its appearance: hips, knees,
 * shoulders and elbows are groups that the pose drives, so walking, sitting, talking and
 * reaching are the same model in different poses. A dress has a hem that folds away as
 * the person sits, so cloth never cuts through a seat. Cars reuse the plan's own vehicle
 * models, recoloured.
 */

type ThreeModule = typeof THREE_NS;

export type PersonRig = {
  root: THREE_NS.Group;
  pelvis: THREE_NS.Group;
  torso: THREE_NS.Group;
  head: THREE_NS.Group;
  hipL: THREE_NS.Group;
  hipR: THREE_NS.Group;
  kneeL: THREE_NS.Group;
  kneeR: THREE_NS.Group;
  shoulderL: THREE_NS.Group;
  shoulderR: THREE_NS.Group;
  elbowL: THREE_NS.Group;
  elbowR: THREE_NS.Group;
  /** Hem of a dress, hidden while seated. */
  hem: THREE_NS.Object3D | null;
  hipY: number;
  pose: PoseValues;
};

type PoseValues = {
  hipL: number; hipR: number; kneeL: number; kneeR: number;
  shoulderL: number; shoulderR: number; elbowL: number; elbowR: number;
  armOutL: number; armOutR: number;
  torsoPitch: number; headYaw: number; headPitch: number; pelvisY: number;
};

/** Slightly shifted colours for a second person wearing the same look. */
function vary(THREE: ThreeModule, color: number, variant: number) {
  if (!variant) return color;
  const tint = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  tint.getHSL(hsl);
  tint.setHSL((hsl.h + 0.12 * variant) % 1, Math.min(1, hsl.s + 0.05), Math.min(0.85, Math.max(0.12, hsl.l + (variant % 2 ? 0.08 : -0.06))));
  return tint.getHex();
}

export function buildPerson(THREE: ThreeModule, appearance: Appearance, variant = 0, materials = new Map<number, THREE_NS.Material>()): PersonRig {
  const p = proportions(appearance);
  const material = (color: number, rough = 0.78) => {
    let found = materials.get(color);
    if (!found) {
      found = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 });
      materials.set(color, found);
    }
    return found;
  };
  const top = vary(THREE, appearance.top.color, variant);
  const bottom = vary(THREE, appearance.bottom.color, variant);
  const skin = material(appearance.skin, 0.6);
  const topMat = material(top);
  const bottomMat = material(bottom);
  const shoeMat = material(appearance.shoes, 0.5);
  // Hair keeps its natural colour on a repeated look; only the clothes change.
  const hairMat = material(appearance.hair.color, 0.85);

  const mesh = (geometry: THREE_NS.BufferGeometry, mat: THREE_NS.Material, x = 0, y = 0, z = 0) => {
    const node = new THREE.Mesh(geometry, mat);
    node.position.set(x, y, z);
    node.castShadow = true;
    node.receiveShadow = false;
    return node;
  };
  const group = (x = 0, y = 0, z = 0) => {
    const node = new THREE.Group();
    node.position.set(x, y, z);
    return node;
  };
  const limb = (radius: number, length: number, mat: THREE_NS.Material, taper = 0.9) =>
    mesh(new THREE.CylinderGeometry(radius, radius * taper, length, 10), mat, 0, -length / 2, 0);

  const root = group();
  root.name = `person-${appearance.id}`;
  const pelvis = group(0, p.hipY, 0);
  root.add(pelvis);

  const dress = appearance.top.style === "dress";
  // Hips and legs.
  const legs = [1, -1].map((side) => {
    const hip = group(side * p.hipHalf, 0, 0);
    hip.add(limb(p.limb * (dress ? 1.45 : 1.2), p.thigh, dress ? topMat : bottomMat, 0.85));
    const knee = group(0, -p.thigh, 0);
    const shinMat = appearance.bottom.style === "shorts" ? skin : bottomMat;
    knee.add(limb(p.limb, p.shin, shinMat, 0.85));
    if (appearance.bottom.style === "shorts") knee.add(mesh(new THREE.CylinderGeometry(p.limb * 1.25, p.limb * 1.2, p.shin * 0.12, 10), bottomMat, 0, -p.shin * 0.06, 0));
    knee.add(mesh(new THREE.BoxGeometry(p.limb * 2, p.foot, p.limb * 4.2), shoeMat, 0, -p.shin - p.foot / 2, p.limb * 0.9));
    hip.add(knee);
    pelvis.add(hip);
    return { hip, knee };
  });
  pelvis.add(mesh(new THREE.BoxGeometry(p.hipHalf * 2 + p.limb * 2.4, p.thigh * 0.32, p.limb * 3), dress ? topMat : bottomMat, 0, p.thigh * 0.05, 0));

  // Torso.
  const torso = group();
  pelvis.add(torso);
  const torsoShape = new THREE.CylinderGeometry(p.shoulderHalf * 0.86, p.hipHalf + p.limb * 1.2, p.torso, 14);
  const torsoMesh = mesh(torsoShape, topMat, 0, p.torso / 2, 0);
  torsoMesh.scale.z = 0.58;
  torso.add(torsoMesh);
  if (appearance.top.style === "suit" || appearance.top.style === "shirt") {
    // Shirt front and tie, or a collar.
    const inner = material(appearance.top.inner ?? 0xf8fafc);
    torso.add(mesh(new THREE.BoxGeometry(p.shoulderHalf * 0.5, p.torso * 0.5, 0.01), inner, 0, p.torso * 0.72, p.shoulderHalf * 0.5));
    if (appearance.top.accent) torso.add(mesh(new THREE.BoxGeometry(p.shoulderHalf * 0.13, p.torso * 0.42, 0.012), material(appearance.top.accent), 0, p.torso * 0.66, p.shoulderHalf * 0.51));
  }
  if (appearance.top.style === "tshirt" && appearance.top.accent) {
    for (const y of [0.38, 0.62]) {
      const stripe = mesh(new THREE.CylinderGeometry(p.shoulderHalf * 0.86 * (0.85 + y * 0.15) + 0.004, p.shoulderHalf * 0.86 * (0.85 + y * 0.15) + 0.004, p.torso * 0.07, 14), material(appearance.top.accent), 0, p.torso * y, 0);
      stripe.scale.z = 0.6;
      torso.add(stripe);
    }
  }
  if (appearance.top.style === "hoodie") {
    const hood = mesh(new THREE.SphereGeometry(p.headR * 0.95, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), topMat, 0, p.torso + p.neck * 0.6, -p.headR * 0.7);
    hood.rotation.x = -0.6;
    torso.add(hood);
  }
  if (appearance.bag?.kind === "backpack") {
    torso.add(mesh(new THREE.BoxGeometry(p.shoulderHalf * 1.2, p.torso * 0.62, p.limb * 4), material(appearance.bag.color), 0, p.torso * 0.55, -p.shoulderHalf * 0.62));
  }

  // A summer dress, just above the knee. Folds away when seated.
  let hem: THREE_NS.Object3D | null = null;
  if (dress) {
    const length = p.thigh * 0.9;
    hem = mesh(new THREE.CylinderGeometry(p.hipHalf + p.limb * 1.9, p.hipHalf + p.limb * 1.9 + 0.08, length, 16, 1, true), topMat, 0, -length / 2, 0);
    (hem as THREE_NS.Mesh).scale.z = 0.72;
    pelvis.add(hem);
  }

  // Neck and head.
  torso.add(mesh(new THREE.CylinderGeometry(p.limb * 1.2, p.limb * 1.3, p.neck * 1.6, 10), skin, 0, p.torso + p.neck * 0.6, 0));
  const head = group(0, p.torso + p.neck + p.headR * 0.95, 0);
  torso.add(head);
  head.add(mesh(new THREE.SphereGeometry(p.headR, 18, 14), skin));
  const eyeMat = material(0x1f2933, 0.4);
  for (const side of [1, -1]) head.add(mesh(new THREE.SphereGeometry(p.headR * 0.09, 8, 6), eyeMat, side * p.headR * 0.36, p.headR * 0.12, p.headR * 0.9));
  if (appearance.glasses) {
    head.add(mesh(new THREE.BoxGeometry(p.headR * 1.25, p.headR * 0.12, p.headR * 0.06), material(0x111827, 0.3), 0, p.headR * 0.12, p.headR * 0.97));
  }
  if (appearance.beard) {
    const beard = mesh(new THREE.SphereGeometry(p.headR * 0.78, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), material(appearance.beard), 0, -p.headR * 0.12, p.headR * 0.28);
    beard.scale.set(1, 0.9, 0.9);
    head.add(beard);
  }
  const hair = appearance.hair;
  if (hair.style === "short" || hair.style === "pigtails" || hair.style === "long" || hair.style === "ponytail" || hair.style === "bob") {
    const cap = mesh(new THREE.SphereGeometry(p.headR * 1.06, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat, 0, p.headR * 0.05, -p.headR * 0.06);
    head.add(cap);
    if (hair.style === "pigtails") {
      for (const side of [1, -1]) {
        const tail = mesh(new THREE.CylinderGeometry(p.headR * 0.22, p.headR * 0.12, p.headR * 1.1, 8), hairMat, side * p.headR * 1.05, -p.headR * 0.25, -p.headR * 0.1);
        tail.rotation.z = side * 0.35;
        head.add(tail);
      }
    }
    if (hair.style === "long") {
      // Loose hair down to the shoulder blades.
      const fall = mesh(new THREE.BoxGeometry(p.headR * 1.75, p.headR * 2.3, p.headR * 0.45), hairMat, 0, -p.headR * 0.75, -p.headR * 0.62);
      head.add(fall);
      for (const side of [1, -1]) head.add(mesh(new THREE.BoxGeometry(p.headR * 0.25, p.headR * 1.3, p.headR * 0.8), hairMat, side * p.headR * 0.92, -p.headR * 0.35, -p.headR * 0.2));
    } else if (hair.style === "ponytail") {
      const tail = mesh(new THREE.CylinderGeometry(p.headR * 0.24, p.headR * 0.1, p.headR * 1.6, 8), hairMat, 0, -p.headR * 0.45, -p.headR * 1.15);
      tail.rotation.x = 0.35;
      head.add(tail);
    } else if (hair.style === "bob") {
      // Short, rounded, down to the jaw.
      const bob = mesh(new THREE.SphereGeometry(p.headR * 1.1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.68), hairMat, 0, p.headR * 0.02, -p.headR * 0.12);
      head.add(bob);
    }
  } else if (hair.style === "bald") {
    for (const side of [1, -1]) head.add(mesh(new THREE.BoxGeometry(p.headR * 0.18, p.headR * 0.4, p.headR * 0.9), hairMat, side * p.headR * 0.93, 0, -p.headR * 0.2));
  } else if (hair.style === "cap") {
    head.add(mesh(new THREE.SphereGeometry(p.headR * 1.07, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat, 0, p.headR * 0.08, 0));
    head.add(mesh(new THREE.BoxGeometry(p.headR * 1.3, p.headR * 0.08, p.headR * 0.9), hairMat, 0, p.headR * 0.12, p.headR * 1.0));
  }

  // Arms.
  const arms = [1, -1].map((side) => {
    const shoulder = group(side * p.shoulderHalf, p.torso * 0.92, 0);
    const longSleeves = appearance.top.sleeves === "long";
    shoulder.add(limb(p.limb * 0.95, p.upperArm, topMat));
    const elbow = group(0, -p.upperArm, 0);
    elbow.add(limb(p.limb * 0.82, p.forearm, longSleeves ? topMat : skin));
    elbow.add(mesh(new THREE.SphereGeometry(p.limb * 1.05, 8, 6), skin, 0, -p.forearm - p.limb * 0.6, 0));
    if (side === -1 && appearance.bag?.kind === "handbag") {
      elbow.add(mesh(new THREE.BoxGeometry(p.limb * 2, p.limb * 6, p.limb * 5), material(appearance.bag.color), 0, -p.forearm - p.limb * 4, 0));
    }
    shoulder.add(elbow);
    torso.add(shoulder);
    return { shoulder, elbow };
  });

  return {
    root, pelvis, torso, head,
    hipL: legs[0]!.hip, hipR: legs[1]!.hip, kneeL: legs[0]!.knee, kneeR: legs[1]!.knee,
    shoulderL: arms[0]!.shoulder, shoulderR: arms[1]!.shoulder, elbowL: arms[0]!.elbow, elbowR: arms[1]!.elbow,
    hem, hipY: p.hipY,
    pose: {
      hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, shoulderL: 0, shoulderR: 0, elbowL: -0.15, elbowR: -0.15,
      armOutL: 0.06, armOutR: 0.06, torsoPitch: 0, headYaw: 0, headPitch: 0, pelvisY: p.hipY
    }
  };
}

/** Joint angles for what the person is doing. Forward swing is a negative x rotation. */
function targetPose(rig: PersonRig, agent: Agent): PoseValues {
  const g = agent.gesture;
  const amplitude = agent.pose === "walk" ? Math.min(1, agent.speed / 1.1) : 0;
  const phase = agent.walkPhase;
  const swing = Math.sin(phase);
  const standing: PoseValues = {
    hipL: -swing * 0.5 * amplitude,
    hipR: swing * 0.5 * amplitude,
    kneeL: amplitude * (0.1 + 0.75 * Math.max(0, Math.sin(phase - 0.9))),
    kneeR: amplitude * (0.1 + 0.75 * Math.max(0, Math.sin(phase + Math.PI - 0.9))),
    shoulderL: swing * 0.4 * amplitude,
    shoulderR: -swing * 0.4 * amplitude,
    elbowL: -0.18 - 0.25 * amplitude,
    elbowR: -0.18 - 0.25 * amplitude,
    armOutL: 0.07, armOutR: 0.07,
    torsoPitch: 0.04 * amplitude + Math.sin(g * 1.4) * 0.008,
    headYaw: 0, headPitch: 0,
    pelvisY: rig.hipY + amplitude * 0.022 * Math.abs(Math.cos(phase)) - amplitude * 0.012
  };
  if (agent.pose === "talk") {
    standing.shoulderR = -0.35 + Math.sin(g * 1.7) * 0.12;
    standing.elbowR = -1.05 + Math.sin(g * 3.1) * 0.35;
    standing.shoulderL = -0.12 + Math.sin(g * 0.9 + 1) * 0.08;
    standing.elbowL = -0.45 + Math.max(0, Math.sin(g * 2.2 + 2)) * 0.5;
    standing.headYaw = Math.sin(g * 0.8) * 0.16;
    standing.headPitch = Math.sin(g * 2.3) * 0.06;
  } else if (agent.pose === "use") {
    standing.shoulderR = -1.05 + Math.sin(g * 2) * 0.08;
    standing.elbowR = -0.45 + Math.sin(g * 3.3) * 0.2;
    standing.shoulderL = -0.45;
    standing.elbowL = -0.75;
    standing.torsoPitch = 0.12;
    standing.headPitch = 0.22;
  } else if (agent.pose === "browse") {
    const reach = Math.max(0, Math.sin(g * 0.7));
    standing.shoulderR = -0.25 - reach * 1.1;
    standing.elbowR = -0.3 - reach * 0.3;
    standing.headYaw = Math.sin(g * 0.45) * 0.45;
    standing.headPitch = -0.05 + Math.sin(g * 0.3) * 0.1;
  } else if (agent.pose === "write") {
    standing.shoulderR = -2.1 + Math.sin(g * 1.3) * 0.15;
    standing.elbowR = -0.35;
    standing.armOutR = 0.02 + Math.sin(g * 2.6) * 0.08;
    standing.headPitch = -0.12;
  }
  const s = agent.sit;
  if (s <= 0) return standing;
  const seated: PoseValues = {
    hipL: -1.5, hipR: -1.5, kneeL: 1.5, kneeR: 1.5,
    shoulderL: -0.35, shoulderR: -0.35 + (Math.sin(g * 0.35) > 0.85 ? -0.4 : 0), elbowL: -0.95, elbowR: -0.95,
    armOutL: 0.1, armOutR: 0.1,
    torsoPitch: -0.06, headYaw: Math.sin(g * 0.3) * 0.25, headPitch: 0.04,
    pelvisY: agent.seatHeightM + 0.05
  };
  const mixed = {} as PoseValues;
  for (const key of Object.keys(standing) as (keyof PoseValues)[]) mixed[key] = standing[key] + (seated[key] - standing[key]) * s;
  return mixed;
}

function applyPose(rig: PersonRig, agent: Agent, dt: number) {
  const target = targetPose(rig, agent);
  const k = 1 - Math.exp(-dt * 12);
  for (const key of Object.keys(target) as (keyof PoseValues)[]) rig.pose[key] += (target[key] - rig.pose[key]) * k;
  const pose = rig.pose;
  rig.pelvis.position.y = pose.pelvisY;
  rig.hipL.rotation.x = pose.hipL;
  rig.hipR.rotation.x = pose.hipR;
  rig.kneeL.rotation.x = pose.kneeL;
  rig.kneeR.rotation.x = pose.kneeR;
  rig.shoulderL.rotation.set(pose.shoulderL, 0, pose.armOutL);
  rig.shoulderR.rotation.set(pose.shoulderR, 0, -pose.armOutR);
  rig.elbowL.rotation.x = pose.elbowL;
  rig.elbowR.rotation.x = pose.elbowR;
  rig.torso.rotation.x = pose.torsoPitch;
  rig.head.rotation.set(pose.headPitch, pose.headYaw, 0);
  if (rig.hem) {
    // The hem shortens and hides as the person sits, instead of cutting through the seat.
    rig.hem.visible = agent.sit < 0.6;
    rig.hem.scale.y = Math.max(0.05, 1 - agent.sit * 1.4);
  }
}

/* ── Cars ─────────────────────────────────────────────────────────── */

const bodyColors: Record<string, number> = { sedan: 0x0f766e, suv: 0x2563eb, van: 0xe2e8f0, pickup: 0x64748b };

function buildCar(THREE: ThreeModule, variant: string, lengthM: number, widthM: number, color: number) {
  const heights: Record<string, number> = { sedan: 1.45, suv: 1.8, van: 2.45, pickup: 1.75 };
  const model: PlanObstacle = {
    id: `dynamic-${variant}`, label: "", kind: "vehicle", variant: variant as PlanObstacle["variant"],
    center: { x: 0, z: 0 }, widthM: lengthM, depthM: widthM, heightM: heights[variant] ?? 1.5, rotationDeg: 0, blocksView: true
  };
  const object = buildObstacleMesh(THREE, model, false);
  // Recolour the body panels only: glass, tyres and lights keep their own materials.
  object.traverse((child) => {
    const mesh = child as THREE_NS.Mesh;
    const material = mesh.material as THREE_NS.MeshStandardMaterial | undefined;
    if (!mesh.isMesh || !material?.color || material.color.getHex() !== bodyColors[variant]) return;
    const recoloured = material.clone();
    recoloured.color.setHex(color);
    mesh.material = recoloured;
  });
  object.traverse((child) => { child.userData = {}; });
  const holder = new THREE.Group();
  holder.add(object);
  return holder;
}

/* ── The whole crowd ──────────────────────────────────────────────── */

export type CrowdView = { group: THREE_NS.Group; rigs: PersonRig[]; cars: THREE_NS.Group[] };

export function buildCrowdView(THREE: ThreeModule, state: CrowdState): CrowdView {
  const group = new THREE.Group();
  group.name = "dynamic-environment";
  const materials = new Map<number, THREE_NS.Material>();
  const rigs = state.agents.map((agent) => {
    const rig = buildPerson(THREE, agent.appearance, agent.variant, materials);
    group.add(rig.root);
    return rig;
  });
  const cars = state.traffic.cars.map((car) => {
    const model = buildCar(THREE, car.variant, car.lengthM, car.widthM, car.color);
    group.add(model);
    return model;
  });
  updateCrowdView(state, { group, rigs, cars }, 0);
  return { group, rigs, cars };
}

export function updateCrowdView(state: CrowdState, view: CrowdView, dt: number) {
  state.agents.forEach((agent, index) => {
    const rig = view.rigs[index]!;
    const ground = groundAt(state.grid, agent.position);
    rig.root.position.set(agent.position.x, ground * (1 - agent.sit), agent.position.z);
    rig.root.rotation.y = agent.yaw;
    applyPose(rig, agent, dt || 1);
  });
  state.traffic.cars.forEach((car, index) => {
    const model = view.cars[index]!;
    model.visible = car.active && car.presence > 0.02;
    if (!model.visible) return;
    // Heading comes from the axles (traffic.ts), so a car swings round a turn smoothly.
    model.position.set(car.position.x, 0, car.position.z);
    model.rotation.y = car.heading;
    model.scale.setScalar(Math.max(0.001, car.presence));
  });
}

export function disposeCrowdView(view: CrowdView) {
  disposeGroup(view.group);
  view.group.removeFromParent();
}

export { appearances };
