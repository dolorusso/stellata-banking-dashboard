/**
 * Deterministic demo data for a small creative studio.
 *
 * A fixed faker seed means the same transactions (amounts, merchants, order)
 * every time. Dates are anchored to the current UTC day so the dashboard always
 * looks "live": the shape is stable, only the calendar slides.
 */
import { Faker, en } from "@faker-js/faker";
import type { Account, Card, Category, Payee, PaymentMethod, Transaction } from "./schemas";

const SEED = 20261105;
export const HISTORY_DAYS = 180;
const DAY_MS = 86_400_000;

export type AccountBase = Omit<Account, "balanceCents" | "pendingOutCents"> & {
  openingBalanceCents: number;
};
export type CardBase = Omit<Card, "status" | "spentThisMonthCents">;
/** Internal ledger row. Status is resolved at read time from `failed` + `settlesAt`. */
export type LedgerEntry = Omit<Transaction, "status"> & { failed: boolean };

export type Seed = {
  anchor: Date;
  accounts: AccountBase[];
  payees: Payee[];
  cards: CardBase[];
  entries: LedgerEntry[];
};

export const ACCOUNT_IDS = {
  operating: "acc_operating",
  payroll: "acc_payroll",
  tax: "acc_tax_reserve",
} as const;

export const CARD_ID = "card_virtual_ops";

/** Final balances the seed is tuned to land on (before any user transfers). */
const TARGET_BALANCES: Record<string, number> = {
  [ACCOUNT_IDS.operating]: 24_831_542,
  [ACCOUNT_IDS.payroll]: 4_120_618,
  [ACCOUNT_IDS.tax]: 6_348_090,
};

export const PAYEES: Payee[] = [
  { id: "py_brightline", name: "Brightline Design Co.", bankName: "Cascade Federal", accountLast4: "2290", methods: ["ach", "wire"], category: "contractors" },
  { id: "py_fernhill", name: "Fernhill Dev Collective", bankName: "Ridgeview Credit Union", accountLast4: "8814", methods: ["ach"], category: "contractors" },
  { id: "py_harbor", name: "Harbor Property Management", bankName: "First Lakeside Bank", accountLast4: "5531", methods: ["ach"], category: "rent" },
  { id: "py_kestrel", name: "Kestrel Legal LLP", bankName: "Meridian Trust", accountLast4: "0472", methods: ["ach", "wire"], category: "professional" },
  { id: "py_atlas", name: "Atlas Components Ltd.", bankName: "Northgate International", accountLast4: "9168", methods: ["wire"], category: "suppliers" },
];

const CLIENTS = ["Acme Robotics", "Meridian Health", "Lumen Labs", "Orchard & Vale", "Bluebird Logistics"];
const MEALS = ["Sweetgreen", "Blue Bottle Coffee", "DoorDash", "Tartine Bakery", "Chipotle"];
const TRAVEL = ["Delta Air Lines", "United Airlines", "Airbnb", "Uber", "Marriott"];
const MARKETING = ["Google Ads", "Meta Ads", "LinkedIn Ads"];
const OFFICE = ["Amazon Business", "Staples", "IKEA", "B&H Photo"];

const startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export function generateSeed(now: Date): Seed {
  const f = new Faker({ locale: [en] });
  f.seed(SEED);
  const anchor = startOfUtcDay(now);
  const entries: LedgerEntry[] = [];
  let sequence = 0;

  const accounts: AccountBase[] = [
    { id: ACCOUNT_IDS.operating, name: "Operating", kind: "operating", last4: "4821", routingNumber: f.string.numeric(9), currency: "USD", openingBalanceCents: 0 },
    { id: ACCOUNT_IDS.payroll, name: "Payroll", kind: "payroll", last4: "7390", routingNumber: f.string.numeric(9), currency: "USD", openingBalanceCents: 0 },
    { id: ACCOUNT_IDS.tax, name: "Tax Reserve", kind: "tax_reserve", last4: "1046", routingNumber: f.string.numeric(9), currency: "USD", openingBalanceCents: 0 },
  ];

  const cards: CardBase[] = [
    {
      id: CARD_ID,
      accountId: ACCOUNT_IDS.operating,
      holderName: f.person.fullName(),
      nickname: "Team expenses",
      last4: f.string.numeric(4),
      expiry: `0${f.number.int({ min: 1, max: 9 })}/${(anchor.getUTCFullYear() + 3) % 100}`,
      monthlyLimitCents: 2_500_000,
    },
  ];

  const chance = (percent: number) => f.number.int({ min: 1, max: 100 }) <= percent;
  const cents = (minDollars: number, maxDollars: number) =>
    f.number.int({ min: minDollars * 100, max: maxDollars * 100 });

  function reference(method: PaymentMethod) {
    switch (method) {
      case "ach":
        return f.string.numeric(15);
      case "wire":
        return `FED${f.string.alphanumeric({ length: 12, casing: "upper" })}`;
      case "card":
        return f.string.alphanumeric({ length: 6, casing: "upper" });
      case "internal":
        return `INT-${f.string.alphanumeric({ length: 8, casing: "upper" })}`;
    }
  }

  function add(
    daysAgo: number,
    accountId: string,
    tx: {
      counterparty: string;
      description: string;
      category: Category;
      method: PaymentMethod;
      amountCents: number;
      failed?: boolean;
    },
  ) {
    const postedAt = new Date(
      anchor.getTime() - daysAgo * DAY_MS + f.number.int({ min: 7, max: 19 }) * 3_600_000 + f.number.int({ min: 0, max: 59 }) * 60_000,
    );
    // Recent external activity is still settling (card auths, ACH in flight).
    const settling = daysAgo <= 2 && tx.method !== "internal" && !tx.failed;
    sequence += 1;
    entries.push({
      id: `txn_${String(sequence).padStart(4, "0")}`,
      accountId,
      postedAt: postedAt.toISOString(),
      description: tx.description,
      counterparty: tx.counterparty,
      category: tx.category,
      method: tx.method,
      amountCents: tx.amountCents,
      currency: "USD",
      settlesAt: settling ? new Date(postedAt.getTime() + 3 * DAY_MS).toISOString() : null,
      reference: reference(tx.method),
      memo: null,
      cardId: tx.method === "card" ? CARD_ID : null,
      transferId: null,
      failed: tx.failed ?? false,
    });
  }

  function internal(daysAgo: number, fromId: string, toId: string, amountCents: number, description: string) {
    const from = accounts.find((a) => a.id === fromId)!;
    const to = accounts.find((a) => a.id === toId)!;
    add(daysAgo, fromId, { counterparty: `${to.name} ••${to.last4}`, description, category: "transfer", method: "internal", amountCents: -amountCents });
    add(daysAgo, toId, { counterparty: `${from.name} ••${from.last4}`, description, category: "transfer", method: "internal", amountCents });
  }

  const { operating, payroll, tax } = ACCOUNT_IDS;

  // History ends yesterday: the seed is memoized per day and must never
  // contain timestamps later than "now". Today's activity comes from the user.
  for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo--) {
    const date = new Date(anchor.getTime() - daysAgo * DAY_MS);
    const dom = date.getUTCDate();
    const month = date.getUTCMonth();
    const weekday = date.getUTCDay() !== 0 && date.getUTCDay() !== 6;
    const monthName = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });

    // ── Monthly schedule ──
    if (dom === 1) {
      add(daysAgo, operating, { counterparty: "Harbor Property Management", description: `Studio rent · ${monthName}`, category: "rent", method: "ach", amountCents: -685_000 });
      internal(daysAgo, operating, tax, 950_000, "Monthly tax set-aside");
    }
    if (dom === 2) add(daysAgo, operating, { counterparty: "Amazon Web Services", description: "AWS monthly usage", category: "software", method: "card", amountCents: -cents(1_400, 2_600) });
    if (dom === 3) {
      add(daysAgo, operating, { counterparty: "Google Workspace", description: "Workspace · 14 seats", category: "software", method: "card", amountCents: -32_200 });
      add(daysAgo, operating, { counterparty: "Slack", description: "Slack Pro · annualized", category: "software", method: "card", amountCents: -17_500 });
    }
    if (dom === 5) {
      add(daysAgo, operating, { counterparty: "Figma", description: "Figma Organization", category: "software", method: "card", amountCents: -67_500 });
      add(daysAgo, operating, { counterparty: "GitHub", description: "GitHub Team", category: "software", method: "card", amountCents: -16_800 });
    }
    if (dom === 8 || dom === 22) {
      const client = f.helpers.arrayElement(CLIENTS);
      add(daysAgo, operating, { counterparty: client, description: `Invoice INV-${f.string.numeric(4)} · ${client}`, category: "revenue", method: f.helpers.arrayElement(["ach", "ach", "wire"] as const), amountCents: cents(8_000, 24_000) });
    }
    if (dom === 10 || dom === 25) {
      const payee = f.helpers.arrayElement(PAYEES.filter((p) => p.category === "contractors"));
      add(daysAgo, operating, { counterparty: payee.name, description: `${payee.name} · ${monthName} retainer`, category: "contractors", method: "ach", amountCents: -cents(2_500, 7_500), failed: chance(8) });
    }
    if (dom === 13 || dom === 27) internal(daysAgo, operating, payroll, 3_200_000, "Payroll funding");
    if (dom === 15 || dom === 28) add(daysAgo, payroll, { counterparty: "Gusto", description: `Payroll run · ${monthName} ${dom}`, category: "payroll", method: "ach", amountCents: -cents(27_000, 31_000) });
    if (dom === 18) add(daysAgo, operating, { counterparty: "Pacific Power", description: "Electricity", category: "utilities", method: "ach", amountCents: -cents(320, 480) });
    if (dom === 20) add(daysAgo, operating, { counterparty: "Comcast Business", description: "Internet · 1 Gbps", category: "utilities", method: "ach", amountCents: -24_900 });
    if (dom === 28) add(daysAgo, tax, { counterparty: "Stellata", description: "Interest earned · 3.10% APY", category: "interest", method: "internal", amountCents: cents(90, 160) });

    // Quarterly estimated taxes (US federal + state).
    if (dom === 15 && [0, 3, 5, 8].includes(month)) {
      add(daysAgo, tax, { counterparty: "IRS · EFTPS", description: "Federal estimated tax payment", category: "taxes", method: "ach", amountCents: -cents(18_000, 24_000) });
      add(daysAgo, tax, { counterparty: "Franchise Tax Board", description: "State estimated tax payment", category: "taxes", method: "ach", amountCents: -cents(4_000, 7_000) });
    }

    // ── Day-to-day activity ──
    if (!weekday) continue;
    if (chance(35)) add(daysAgo, operating, { counterparty: "Stripe", description: `Stripe payout · PO-${f.string.alphanumeric({ length: 6, casing: "upper" })}`, category: "revenue", method: "ach", amountCents: cents(2_400, 11_000) });
    if (chance(15)) {
      const m = f.helpers.arrayElement(MEALS);
      add(daysAgo, operating, { counterparty: m, description: m, category: "meals", method: "card", amountCents: -cents(18, 140) });
    }
    if (chance(6)) {
      const m = f.helpers.arrayElement(TRAVEL);
      add(daysAgo, operating, { counterparty: m, description: `${m} · client visit`, category: "travel", method: "card", amountCents: -cents(120, 1_400) });
    }
    if (chance(8)) {
      const m = f.helpers.arrayElement(MARKETING);
      add(daysAgo, operating, { counterparty: m, description: `${m} campaign`, category: "marketing", method: "card", amountCents: -cents(300, 2_200) });
    }
    if (chance(5)) {
      const m = f.helpers.arrayElement(OFFICE);
      add(daysAgo, operating, { counterparty: m, description: `${m} order`, category: "office", method: "card", amountCents: -cents(40, 650) });
    }
  }

  // Opening balances are back-solved so every account lands on its target.
  for (const account of accounts) {
    const net = entries
      .filter((e) => e.accountId === account.id && !e.failed)
      .reduce((sum, e) => sum + e.amountCents, 0);
    account.openingBalanceCents = (TARGET_BALANCES[account.id] ?? 0) - net;
  }

  return { anchor, accounts, payees: PAYEES, cards, entries };
}

let cached: { key: number; seed: Seed } | undefined;

/** Memoized per UTC day: the seed only changes when the calendar does. */
export function getSeed(now: Date): Seed {
  const key = startOfUtcDay(now).getTime();
  if (cached?.key !== key) cached = { key, seed: generateSeed(now) };
  return cached.seed;
}
