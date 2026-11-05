// Minimal Chrome DevTools Protocol driver (no dependencies). Drives a locally
// installed Chrome/Edge in headless mode: navigate, click, type, read the DOM,
// collect console errors and take screenshots.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const ARTIFACTS = join(process.cwd(), "e2e-artifacts");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CANDIDATES = {
  win32: [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ],
  linux: ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge"],
};

function findBrowser() {
  const path = process.env.BROWSER_PATH ?? (CANDIDATES[process.platform] ?? []).find((p) => existsSync(p));
  if (!path) throw new Error("No Chrome/Edge found. Set BROWSER_PATH to a Chromium-based browser.");
  return path;
}

let nextPort = 9400;

export async function launch({ width = 1440, height = 1000, dark = false } = {}) {
  const port = nextPort++;
  const profile = mkdtempSync(join(tmpdir(), "stellata-e2e-"));
  const proc = spawn(findBrowser(), [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, "about:blank",
  ], { stdio: "ignore" });

  let page;
  for (let i = 0; i < 75 && !page; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      page = targets.find((t) => t.type === "page");
    } catch {
      // browser still starting
    }
    if (!page) await sleep(200);
  }
  if (!page) throw new Error("Browser did not expose a debugging target");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));

  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method === "Runtime.exceptionThrown") {
      errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }] });

  const browser = {
    errors,
    async goto(url) {
      await send("Page.navigate", { url });
      await sleep(1200);
    },
    /** Evaluate an expression in the page. DOM nodes don't serialize: coerce to values. */
    async eval(expression) {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    },
    async waitFor(expression, timeout = 10_000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (await browser.eval(`!!(${expression})`).catch(() => false)) return;
        await sleep(150);
      }
      throw new Error(`Timed out after ${timeout}ms waiting for: ${expression}`);
    },
    /** Real mouse click on the first element matching `selector` (and containing `text`). */
    async click(selector, text = "") {
      const point = await browser.eval(`(() => {
        const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
          .find((e) => e.textContent.includes(${JSON.stringify(text)}));
        if (!el) return null;
        el.scrollIntoView({ block: "center" });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
      if (!point) throw new Error(`No element matches ${selector} ${text}`);
      for (const type of ["mousePressed", "mouseReleased"]) {
        await send("Input.dispatchMouseEvent", { type, ...point, button: "left", clickCount: 1 });
      }
      await sleep(250);
    },
    /** Focus an element and replace its value by typing (fires real input events). */
    async fill(selector, value) {
      await browser.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select?.(); })()`);
      // Inserting "" doesn't replace a selection; delete it like a user would.
      if (value === "") await browser.press("Backspace");
      else await send("Input.insertText", { text: value });
      await sleep(250);
    },
    async press(key) {
      const codes = { Enter: [13, "\r"], Escape: [27], Backspace: [8], Tab: [9] };
      const [keyCode, text] = codes[key] ?? [0];
      await send("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", key, code: key, windowsVirtualKeyCode: keyCode, ...(text ? { text } : {}) });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: keyCode });
      await sleep(200);
    },
    async screenshot(name) {
      mkdirSync(ARTIFACTS, { recursive: true });
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      const path = join(ARTIFACTS, `${name}.png`);
      writeFileSync(path, Buffer.from(data, "base64"));
      return path;
    },
    async close() {
      ws.close();
      proc.kill();
      await sleep(300);
      rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
    },
  };
  return browser;
}
