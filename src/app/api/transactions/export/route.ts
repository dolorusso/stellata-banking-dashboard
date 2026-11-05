import { parseBody } from "@/lib/http";
import { buildLedger } from "@/lib/ledger";
import { TransactionExportRequestSchema } from "@/lib/schemas";
import { filterTransactions, sortTransactions, transactionsToCsv } from "@/lib/transactions-query";

export async function POST(request: Request) {
  const parsed = await parseBody(request, TransactionExportRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { filters, sort, state } = parsed.data;
  const ledger = buildLedger(state);
  const rows = sortTransactions(filterTransactions(ledger.transactions, filters), sort);
  const filename = `stellata-transactions-${ledger.now.toISOString().slice(0, 10)}.csv`;

  return new Response(transactionsToCsv(rows, ledger.accounts), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
