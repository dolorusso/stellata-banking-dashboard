import { buildOverview } from "@/lib/analytics";
import { parseBody } from "@/lib/http";
import { buildLedger } from "@/lib/ledger";
import { OverviewRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const parsed = await parseBody(request, OverviewRequestSchema);
  if (!parsed.ok) return parsed.response;

  const ledger = buildLedger(parsed.data.state);
  return Response.json(buildOverview(ledger, parsed.data.range));
}
