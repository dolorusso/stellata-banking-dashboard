import { jsonError, parseBody } from "@/lib/http";
import { buildLedger, findCard, withCardStatus } from "@/lib/ledger";
import { UpdateCardRequestSchema } from "@/lib/schemas";

/** Freeze or unfreeze a card. The client stores the returned status. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/cards/[id]">) {
  const { id } = await ctx.params;
  const parsed = await parseBody(request, UpdateCardRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { state, status } = parsed.data;
  if (!findCard(buildLedger(state), id)) {
    return jsonError(404, { message: "Card not found", code: "CARD_NOT_FOUND" });
  }

  const card = findCard(buildLedger(withCardStatus(state, id, status)), id);
  return Response.json({ card });
}
