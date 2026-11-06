// Browser end-to-end checks against a running server.
//   npm run build && npm start      (in one terminal)
//   npm run e2e                     (in another; BASE_URL defaults to http://localhost:3000)
// Screenshots land in e2e-artifacts/. Exits non-zero on the first failed check.
import { ARTIFACTS, launch } from "./browser.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`✗ ${label}${detail ? ` (${detail})` : ""}`);
  passed += 1;
  console.log(`  ✓ ${label}${detail ? ` (${detail})` : ""}`);
}

async function suite(name, options, body) {
  console.log(`\n${name}`);
  const browser = await launch(options);
  try {
    await body(browser);
    check("no console errors", browser.errors.length === 0, browser.errors.join(" | "));
  } finally {
    await browser.close();
  }
}

// Parenthesized: these expressions get `.includes(...)` appended (`a ?? ""` would bind wrongly).
const summary = `(document.querySelector("[aria-live=polite]")?.textContent ?? "")`;
const heading = `document.querySelector("h2[tabindex='-1']")?.textContent`;
const totalBalance = `document.querySelector("#total-balance")?.parentElement?.querySelector("p")?.textContent`;

async function pickOption(b, triggerSelector, optionText) {
  await b.click(triggerSelector);
  await b.waitFor(`document.querySelector('[role="option"]')`);
  await b.click('[role="option"]', optionText);
  await b.waitFor(`!document.querySelector('[role="listbox"]')`);
}

try {
  await fetch(BASE);
} catch {
  console.error(`No server at ${BASE}. Start one with: npm run build && npm start`);
  process.exit(1);
}

try {
  await suite("Overview", {}, async (b) => {
    await b.goto(`${BASE}/`);
    await b.waitFor(totalBalance);
    check("total balance renders", /^\$[\d,]+\.\d{2}$/.test(await b.eval(totalBalance)), await b.eval(totalBalance));
    check("three charts render bars/areas", await b.eval(`document.querySelectorAll(".recharts-bar-rectangle, .recharts-area-area").length > 10`));
    await b.click('[aria-label="Last 30 days"]');
    await b.waitFor(`document.querySelector('[aria-label="Last 30 days"]').getAttribute("data-state") === "on"`);
    await b.click('[aria-label="Table view"]');
    check("chart has a table view", await b.eval(`!!document.querySelector("table")`));
    await b.screenshot("overview");
  });

  await suite("Dark theme", { dark: true }, async (b) => {
    await b.goto(`${BASE}/`);
    await b.waitFor(totalBalance);
    // This browser reports an OS dark preference: the app must still open in light.
    check("first visit opens in light, even with an OS dark preference", await b.eval(`!document.documentElement.classList.contains("dark")`));
    await b.click('button[aria-label="Switch to dark theme"]');
    check("one click switches to dark", await b.eval(`document.documentElement.classList.contains("dark")`));
    await b.goto(`${BASE}/`);
    await b.waitFor(totalBalance);
    check("the choice survives a reload", await b.eval(`document.documentElement.classList.contains("dark")`));
    await b.screenshot("overview-dark");
    await b.click('button[aria-label="Switch to light theme"]');
    check("one click switches back to light", await b.eval(`!document.documentElement.classList.contains("dark")`));
  });

  await suite("Transactions", {}, async (b) => {
    await b.goto(`${BASE}/transactions`);
    await b.waitFor(`document.querySelectorAll("tbody tr").length === 25`);
    check("first page of 25", (await b.eval(summary)).includes("1–25"), await b.eval(summary));

    await b.fill('input[type="search"]', "gusto");
    await b.waitFor(`${summary}.includes("of 12")`);
    check("search filters server-side", true, await b.eval(summary));

    await b.click("thead button", "Amount");
    await b.waitFor(`document.querySelector('th[aria-sort]')?.textContent.includes("Amount") && !document.querySelector(".opacity-60")`);
    const amounts = await b.eval(`[...document.querySelectorAll("tbody td:last-child")].map((td) => Number(td.textContent.replace(/[^0-9.-]/g, "")))`);
    check("sort by amount (descending)", amounts.every((v, i) => i === 0 || amounts[i - 1] >= v));

    await b.fill('input[type="search"]', "");
    await b.waitFor(`${summary}.includes("1–25")`);
    await b.click('button[aria-label="Next page"]');
    await b.waitFor(`${summary}.includes("26–50")`);
    check("pagination", true);

    await b.click("button", "Status");
    await b.click("label", "Pending");
    await b.press("Escape");
    await b.waitFor(`!document.querySelector('[data-slot="popover-content"]')`);
    await sleep(300); // Radix returns focus to the trigger after the exit animation
    await b.waitFor(`!document.querySelector(".opacity-60") && ${summary}.includes("1–")`);
    const statuses = await b.eval(`[...new Set([...document.querySelectorAll("tbody td:nth-child(5)")].map((td) => td.textContent))]`);
    check("status filter resets to page 1", statuses.length === 1 && statuses[0] === "Pending", statuses.join(","));

    await b.eval(`document.querySelector("tbody td:nth-child(2) button").focus()`);
    await b.press("Enter");
    await b.waitFor(`document.querySelector('[role="dialog"]')`);
    check("detail sheet opens from the keyboard", await b.eval(`document.querySelector('[role="dialog"]').contains(document.activeElement)`));
    await b.screenshot("transaction-detail");
    await b.press("Escape");
    await b.waitFor(`!document.querySelector('[role="dialog"]')`);
    await sleep(300);
    check("focus returns to the row", await b.eval(`document.activeElement.closest("tbody") !== null`));

    await b.click("button", "Amount");
    await b.fill('input[placeholder="0.00"]', "abc");
    await b.click('button[type="submit"]', "Apply");
    check("invalid amount filter is rejected", (await b.eval(`document.querySelector('[role="alert"]')?.textContent ?? ""`)).includes("Enter amounts"));
    await b.press("Escape");
    await sleep(300);

    await b.fill('input[type="search"]', "zzzz-no-match");
    await b.waitFor(`document.body.innerText.includes("No transactions match")`);
    check("empty state disables export", await b.eval(`[...document.querySelectorAll("button")].find((x) => x.textContent.includes("Export CSV")).disabled`));
  });

  await suite("Transfers and cards", { height: 1100 }, async (b) => {
    await b.goto(`${BASE}/`);
    await b.waitFor(totalBalance);
    const before = await b.eval(totalBalance);

    await b.goto(`${BASE}/transfers`);
    await b.waitFor(`${heading} === "Transfer details"`);
    await b.click("button", "Review transfer");
    await sleep(300);
    check("empty form shows field errors", (await b.eval(`document.querySelectorAll("p.text-destructive").length`)) >= 2);
    check("focus moves to the first invalid field", await b.eval(`document.activeElement.getAttribute("aria-invalid") === "true"`));

    await pickOption(b, 'button[id$="-destination"]', "Brightline Design Co.");
    await b.click("label", "Wire");
    await b.fill('input[id$="-amount"]', "999,999");
    await b.click("button", "Review transfer");
    await sleep(300);
    check("insufficient funds caught before review", (await b.eval(`document.querySelector('[id$="-amount-error"]')?.textContent ?? ""`)).includes("Insufficient funds"));

    await b.fill('input[id$="-amount"]', "1,500");
    await b.fill('input[id$="-memo"]', "Logo refresh");
    await b.click("button", "Review transfer");
    await b.waitFor(`${heading} === "Review and confirm"`);
    check("review shows the amount", (await b.eval(`document.querySelector("[data-slot=card-content]").innerText`)).includes("$1,500.00"));
    await b.click("button", "Send");
    await b.waitFor(`${heading} === "Transfer submitted"`);
    check("transfer starts pending", (await b.eval(`document.querySelector("[data-slot=card-content]").innerText`)).includes("Pending"));
    await b.screenshot("transfer-pending");
    const started = Date.now();
    await b.waitFor(`document.querySelector("[aria-live=polite]")?.textContent.includes("completed")`, 20_000);
    check("wire completes on its own", true, `${Math.round((Date.now() - started) / 1000)}s`);

    await b.goto(`${BASE}/`);
    await b.waitFor(totalBalance);
    const toCents = (s) => Number(s.replace(/[^0-9]/g, ""));
    const after = await b.eval(totalBalance);
    check("total balance dropped by exactly $1,500.00", toCents(before) - toCents(after) === 150_000, `${before} → ${after}`);

    await b.goto(`${BASE}/transactions`);
    await b.waitFor(`document.querySelectorAll("tbody tr").length > 0 && !document.querySelector("tbody .animate-pulse")`);
    check("transfer is the newest transaction", (await b.eval(`document.querySelector("tbody tr").innerText`)).includes("Brightline"));

    await b.goto(`${BASE}/cards`);
    await b.waitFor(`document.querySelector('[role="switch"]')`);
    await b.click('[role="switch"]');
    await b.waitFor(`document.querySelector('[role="switch"]').getAttribute("aria-checked") === "true"`);
    await b.goto(`${BASE}/cards`);
    await b.waitFor(`document.querySelector('[role="switch"]')`);
    check("frozen card survives a reload", await b.eval(`document.querySelector('[role="switch"]').getAttribute("aria-checked") === "true"`));
    await b.screenshot("card-frozen");

    await b.click('button[aria-label="Reset demo data"]');
    await b.waitFor(`document.querySelector('[role="dialog"]')`);
    await b.click('[role="dialog"] button', "Reset demo");
    await sleep(600);
    await b.goto(`${BASE}/`);
    await b.waitFor(totalBalance);
    check("reset restores the seed balance", (await b.eval(totalBalance)) === before);
  });

  for (const [path, name] of [["/", "overview"], ["/transactions", "transactions"], ["/transfers", "transfers"], ["/cards", "cards"]]) {
    await suite(`Mobile 390px: ${name}`, { width: 390, height: 900 }, async (b) => {
      await b.goto(`${BASE}${path}`);
      await sleep(1500);
      check("no horizontal overflow", !(await b.eval(`document.documentElement.scrollWidth > window.innerWidth`)));
      check("bottom navigation visible", await b.eval(`getComputedStyle(document.querySelector('nav[aria-label="Main"].fixed')).display !== "none"`));
      await b.screenshot(`mobile-${name}`);
    });
  }

  console.log(`\nAll ${passed} checks passed. Screenshots: ${ARTIFACTS}`);
} catch (error) {
  console.error(`\n${error.message}`);
  process.exit(1);
}
