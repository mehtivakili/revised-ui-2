/**
 * The ten people of the dynamic environment.
 *
 * Each is a distinct, recognisable figure at true scale: men, women, boys and girls of
 * different heights and builds, in ordinary everyday European clothes — a suit, a blazer
 * and jeans, a jumper, a cardigan, a hoodie, a T-shirt, a summer dress — with their hair
 * showing. The 3D builder reads only these fields, so adding a person is adding an entry.
 */

export type AgeGroup = "man" | "woman" | "boy" | "girl";
export type HairStyle = "short" | "bald" | "cap" | "pigtails" | "long" | "ponytail" | "bob";
export type TopStyle = "suit" | "shirt" | "hoodie" | "tshirt" | "dress";
export type BottomStyle = "trousers" | "shorts" | "leggings";

export type Appearance = {
  id: string;
  label: string;
  group: AgeGroup;
  heightM: number;
  /** Shoulder width relative to an average adult of the same height. */
  build: number;
  skin: number;
  hair: { style: HairStyle; color: number };
  top: { style: TopStyle; color: number; inner?: number; sleeves: "long" | "short"; accent?: number };
  bottom: { style: BottomStyle; color: number };
  shoes: number;
  beard?: number;
  glasses?: boolean;
  bag?: { kind: "handbag" | "backpack"; color: number };
  /** Comfortable walking speed in m/s. */
  walkSpeed: number;
};

export const appearances: Appearance[] = [
  {
    id: "man-suit", label: "مرد کت‌وشلواری", group: "man", heightM: 1.8, build: 1.05, skin: 0xe0b48f,
    hair: { style: "short", color: 0x2b1d14 },
    top: { style: "suit", color: 0x22314f, inner: 0xf8fafc, sleeves: "long", accent: 0xb91c1c },
    bottom: { style: "trousers", color: 0x22314f }, shoes: 0x111827, glasses: true, walkSpeed: 1.3
  },
  {
    id: "man-casual", label: "مرد جوان اسپرت", group: "man", heightM: 1.76, build: 1, skin: 0xc99366,
    hair: { style: "short", color: 0x3b2a1a },
    top: { style: "hoodie", color: 0xb23a3a, sleeves: "long" },
    bottom: { style: "trousers", color: 0x3d5a80 }, shoes: 0xf1f5f9, walkSpeed: 1.35
  },
  {
    id: "man-senior", label: "مرد میانسال", group: "man", heightM: 1.71, build: 1.08, skin: 0xd9a982,
    hair: { style: "bald", color: 0x9ca3af }, beard: 0x9ca3af,
    top: { style: "shirt", color: 0x8a9ba8, sleeves: "long" },
    bottom: { style: "trousers", color: 0xa68a64 }, shoes: 0x5b3a1e, walkSpeed: 1.05
  },
  {
    id: "woman-blazer", label: "زن با کت و شلوار جین", group: "woman", heightM: 1.66, build: 0.92, skin: 0xe8c09e,
    hair: { style: "long", color: 0x5a3a22 },
    top: { style: "suit", color: 0x9a3412, inner: 0xf8fafc, sleeves: "long" },
    bottom: { style: "trousers", color: 0x3b5b8c }, shoes: 0x111827, bag: { kind: "handbag", color: 0x7c4a2d }, walkSpeed: 1.2
  },
  {
    id: "woman-young", label: "زن جوان با پلیور", group: "woman", heightM: 1.63, build: 0.9, skin: 0xd6a47c,
    hair: { style: "ponytail", color: 0xc9a25b },
    top: { style: "shirt", color: 0x2a9d8f, inner: 0x2a9d8f, sleeves: "long" },
    bottom: { style: "trousers", color: 0x1f2937 }, shoes: 0xf8fafc, walkSpeed: 1.25
  },
  {
    id: "woman-senior", label: "خانم مسن با ژاکت", group: "woman", heightM: 1.6, build: 0.95, skin: 0xe2b896,
    hair: { style: "bob", color: 0xb8b8b8 },
    top: { style: "shirt", color: 0x8b5e83, sleeves: "long" },
    bottom: { style: "trousers", color: 0x4b5563 }, shoes: 0x5b3a1e, glasses: true, bag: { kind: "handbag", color: 0x3f3f46 }, walkSpeed: 1.05
  },
  {
    id: "boy-teen", label: "پسر نوجوان", group: "boy", heightM: 1.58, build: 0.9, skin: 0xc68e62,
    hair: { style: "cap", color: 0xc0392b },
    top: { style: "tshirt", color: 0xf2c14e, sleeves: "short" },
    bottom: { style: "trousers", color: 0x3a3f47 }, shoes: 0xf1f5f9, bag: { kind: "backpack", color: 0x1d4ed8 }, walkSpeed: 1.3
  },
  {
    id: "boy-child", label: "پسر بچه", group: "boy", heightM: 1.2, build: 0.95, skin: 0xe5b98f,
    hair: { style: "short", color: 0x4a3222 },
    top: { style: "tshirt", color: 0x3b82f6, sleeves: "short", accent: 0xf8fafc },
    bottom: { style: "shorts", color: 0xb08d57 }, shoes: 0xdc2626, walkSpeed: 1
  },
  {
    id: "girl-teen", label: "دختر نوجوان با هودی", group: "girl", heightM: 1.56, build: 0.88, skin: 0xe6bf98,
    hair: { style: "long", color: 0x2b1d14 },
    top: { style: "hoodie", color: 0x7c3aed, sleeves: "long" },
    bottom: { style: "trousers", color: 0x334155 }, shoes: 0xf8fafc, bag: { kind: "backpack", color: 0xdb2777 }, walkSpeed: 1.2
  },
  {
    id: "girl-child", label: "دختر بچه", group: "girl", heightM: 1.1, build: 0.95, skin: 0xf0c8a4,
    hair: { style: "pigtails", color: 0x5a3a22 },
    top: { style: "dress", color: 0xf472b6, sleeves: "short" },
    bottom: { style: "leggings", color: 0xf8fafc }, shoes: 0x7c3aed, walkSpeed: 0.95
  }
];

/** Body measurements derived from height, so every figure is to scale. */
export function proportions(appearance: Appearance) {
  const h = appearance.heightM;
  const child = appearance.heightM < 1.3;
  const headR = h * (child ? 0.078 : 0.066);
  const hipY = h * (child ? 0.46 : 0.48);
  const thigh = hipY * 0.5;
  const foot = h * 0.035;
  const shin = hipY - thigh - foot;
  const torso = h * (child ? 0.29 : 0.3);
  return {
    headR,
    hipY,
    thigh,
    shin,
    foot,
    torso,
    neck: h * 0.03,
    shoulderHalf: h * 0.125 * appearance.build,
    hipHalf: h * 0.055 * appearance.build,
    upperArm: h * 0.18,
    forearm: h * 0.15,
    limb: h * (child ? 0.034 : 0.03)
  };
}
