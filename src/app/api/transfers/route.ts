import { jsonError, parseBody } from "@/lib/http";
import { createTransfer } from "@/lib/ledger";
import { CreateTransferRequestSchema } from "@/lib/schemas";

/** Create a transfer. Returns the event the client must append to its log. */
export async function POST(request: Request) {
  const parsed = await parseBody(request, CreateTransferRequestSchema);
  if (!parsed.ok) return parsed.response;

  const result = createTransfer(parsed.data.state, parsed.data.input, new Date());
  if (!result.ok) {
    const { code, message, field } = result.error;
    return jsonError(422, { code, message, ...(field ? { field } : {}) });
  }

  return Response.json({ event: result.event, transfer: result.transfer }, { status: 201 });
}
