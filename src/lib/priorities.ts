export const remediationPhases = [
  {
    id: "p0-security-auth",
    label: "Security and auth",
    items: [
      "Rotate leaked database credentials",
      "Move secrets to environment variables",
      "Add SMS OTP with rate limiting",
      "Harden sessions and cookies",
      "Add roles and admin authorization"
    ]
  },
  {
    id: "p1-routing-structure",
    label: "Routing and structure",
    items: [
      "Split calculators into pages",
      "Remove static duplicate app shell",
      "Replace hardcoded deployment paths",
      "Move formulas into libraries"
    ]
  },
  {
    id: "p2-ui-quality",
    label: "UI quality",
    items: [
      "Use one Persian font system",
      "Fix mobile grid overflow",
      "Replace clickable divs",
      "Finish language and number handling"
    ]
  }
] as const;
