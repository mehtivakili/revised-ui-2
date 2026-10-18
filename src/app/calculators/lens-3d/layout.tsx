import type { Metadata } from "next";
import type { ReactNode } from "react";
import { toolMetadata } from "@/src/lib/seo";

export const metadata: Metadata = toolMetadata("lens-3d");

export default function Lens3dLayout({ children }: { children: ReactNode }) {
  return children;
}
