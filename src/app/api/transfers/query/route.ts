import { parseBody } from "@/lib/http";
import { buildLedger } from "@/lib/ledger";
import { StateOnlyRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const parsed = await parseBody(request, StateOnlyRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { transfers } = buildLedger(parsed.data.state);
  return Response.json({ transfers });
}
