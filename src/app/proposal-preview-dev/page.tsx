"use client";
// TEMPORARY dev-only page for checking the printed proposal. Delete after use.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EngineeringProposal, type ProposalProps } from "@/src/components/smart/EngineeringProposal";

type Fixture = Omit<ProposalProps, "quantityFor" | "selected"> & { selectedId: string };

export default function ProposalPreview() {
  const [data, setData] = useState<Fixture | null>(null);
  useEffect(() => {
    document.body.classList.add("is-printing-proposal");
    void fetch("/api/proposal-preview-dev").then((r) => r.json()).then(setData);
  }, []);
  if (!data) return null;
  const selected = data.result.plans.find((plan) => plan.id === data.selectedId) ?? data.result.plans[0];
  return createPortal(
    <div className="proposal-print-root" id="proposal-ready">
      <EngineeringProposal {...data} selected={selected} quantityFor={(_id, initial) => initial} />
    </div>,
    document.body
  );
}
