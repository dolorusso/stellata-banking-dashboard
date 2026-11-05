import { PAYEES } from "@/lib/seed";

// Saved recipients are static demo data, so this GET is prerendered at build time.
export function GET() {
  return Response.json({ payees: PAYEES });
}
