import type { AssistantReasoningMode } from "@/src/lib/chatbot/assistant-types";
import type { ChatReply } from "@/src/lib/chatbot/engine";

/**
 * Whether a message is answered by the local language model or by the deterministic
 * engine on its own.
 *
 * The model is the default. It used to be the exception — knowledge answers were served
 * straight from the article store in low and medium mode — which meant that in the mode
 * the widget opens in, questions like "DORI چیست؟" never reached the model at all and
 * the assistant read like a canned FAQ. Anything the model can phrase better, it now
 * phrases, with the retrieved article passed to it as grounding rather than shipped
 * verbatim.
 *
 * Two sources still bypass it, and only two:
 *
 *   • `catalog` — real product rows. A generative pass can silently alter a part number
 *     or a price, and there is no upside to rewording a table.
 *   • `calculation` — bandwidth, storage and PoE budgets that were computed exactly.
 *     The number is the answer; regenerating it risks drift for no gain.
 *
 * Both still reach the model as evidence on any follow-up question, so "why is that
 * number so high?" is answered generatively even though the number itself was not.
 */
export function shouldUseLocalLlm(
  reply: ChatReply,
  message: string,
  historyLength: number,
  mode: AssistantReasoningMode
) {
  void message;
  void historyLength;
  void mode;

  if (reply.answer.source === "catalog") return false;
  if (reply.answer.source === "calculation") return false;
  return true;
}
