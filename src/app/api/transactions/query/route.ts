import { parseBody } from "@/lib/http";
import { buildLedger } from "@/lib/ledger";
import { TransactionQueryRequestSchema } from "@/lib/schemas";
import { queryTransactions } from "@/lib/transactions-query";

export async function POST(request: Request) {
  const parsed = await parseBody(request, TransactionQueryRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { transactions } = buildLedger(parsed.data.state);
  return Response.json(queryTransactions(transactions, parsed.data.query));
}
