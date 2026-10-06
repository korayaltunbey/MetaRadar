import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { readPage } from "../src/page/read-page.js";
import { PageAccessError, readActivePage } from "../src/page/active-page.js";

afterEach(() => { delete globalThis.chrome; });

test("serialized reader works without its module scope and returns only selected DOM fields", () => {
  const document = {
    contentType: "text/html",
    baseURI: "https://example.com/",
    head: {
      querySelector: (selector) => {
        const contentValues = new Map([
          ['meta[property="og:title" i]', "First OG title"],
          ['meta[property="og:description" i]', "OG description"],
          ['meta[property="og:image" i]', "https://example.com/image.png"],
        ]);

        if (contentValues.has(selector)) {
          return { getAttribute: () => contentValues.get(selector) };
        }

        return selector === "title"
          ? { textContent: "Example" }
          : { getAttribute: () => "Description" };
      },
      querySelectorAll: (selector) => {
        if (selector.startsWith("meta")) return [{ getAttribute: () => "index, follow" }];
        if (selector.includes("alternate")) {
          return [{ getAttribute: (name) => ({ hreflang: "tr", href: "/tr" })[name] ?? null }];
        }
        return [{ getAttribute: () => "/article" }];
      },
    },
    documentElement: { getAttribute: () => "en-US" },
    querySelectorAll: (selector) => selector === "img"
      ? [
        { hasAttribute: () => true, getAttribute: () => "example" },
        { hasAttribute: () => true, getAttribute: () => "" },
        { hasAttribute: () => false, getAttribute: () => null },
      ]
      : [{ textContent: "Heading" }],
  };
  const snapshot = runInNewContext(`(${readPage.toString()})()`, { document, location: { href: "https://example.com/article" } });
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), {
    url: "https://example.com/article",
    baseUrl: "https://example.com/",
    title: "Example",
    description: "Description",
    robotsContents: ["index, follow"],
    ogTitle: { isPresent: true, value: "First OG title" },
    ogDescription: { isPresent: true, value: "OG description" },
    ogImage: { isPresent: true, value: "https://example.com/image.png" },
    htmlLang: "en-US",
    h1Texts: ["Heading"],
    imageAltAttributePresence: [true, true, false],
    canonicalHrefs: ["/article"],
    hreflangLinks: [{ language: "tr", href: "/tr" }],
  });
});

test("reader handles missing head and rejects non-HTML documents", () => {
  const read = (document) => runInNewContext(`(${readPage.toString()})()`, { document, location: { href: "https://example.com" } });
  assert.equal(read({ contentType: "application/pdf" }), null);
  const result = read({ contentType: "text/html", baseURI: "https://example.com", head: null, documentElement: null, querySelectorAll: () => [] });
  assert.equal(result.title, "");
  assert.equal(result.description, "");
  assert.deepEqual(Array.from(result.robotsContents), []);
  assert.deepEqual(JSON.parse(JSON.stringify(result.ogTitle)), { isPresent: false, value: "" });
  assert.deepEqual(JSON.parse(JSON.stringify(result.ogDescription)), { isPresent: false, value: "" });
  assert.deepEqual(JSON.parse(JSON.stringify(result.ogImage)), { isPresent: false, value: "" });
  assert.equal(result.htmlLang, "");
  assert.deepEqual(Array.from(result.imageAltAttributePresence), []);
  assert.equal(result.canonicalHrefs.length, 0);
  assert.deepEqual(Array.from(result.hreflangLinks), []);
});

function mockChrome(tabs, executeScript) {
  globalThis.chrome = {
    tabs: {
      query: async (options) => {
        assert.deepEqual(options, { active: true, currentWindow: true });
        return tabs;
      },
    },
    scripting: { executeScript },
  };
}

test("active-page reader injects only into the main frame in isolated world", async () => {
  const snapshot = { title: "Selected page" };
  mockChrome([{ id: 12, url: "https://example.com/" }], async (options) => {
    assert.deepEqual(options.target, { tabId: 12 });
    assert.equal(options.world, "ISOLATED");
    assert.equal(options.func, readPage);
    return [{ frameId: 0, result: snapshot }];
  });
  assert.equal(await readActivePage(), snapshot);
});

test("unsupported pages and missing tabs do not trigger injection", async () => {
  for (const tabs of [[], [{ url: "https://example.com" }], [{ id: 1, url: "chrome://extensions" }], [{ id: 1, url: "file:///test.html" }]]) {
    mockChrome(tabs, () => assert.fail("Injection must not run"));
    await assert.rejects(readActivePage, PageAccessError);
  }
});

test("Chrome refusal becomes a user-facing error without exposing raw API details", async () => {
  mockChrome([{ id: 1, url: "https://chromewebstore.google.com" }], async () => { throw new Error("Sensitive details"); });
  await assert.rejects(readActivePage, (error) => error instanceof PageAccessError && /erişime izin vermedi/u.test(error.message) && !error.message.includes("Sensitive details"));
});

test("missing or non-HTML injection output becomes an access error", async () => {
  for (const injections of [[], [{ frameId: 0, result: null }], [{ frameId: 2, result: { title: "Iframe" } }]]) {
    mockChrome([{ id: 1, url: "https://example.com" }], async () => injections);
    await assert.rejects(readActivePage, PageAccessError);
  }
});

function readDocument(overrides = {}) {
  const document = {
    contentType: "text/html",
    baseURI: "https://example.com/",
    head: null,
    documentElement: null,
    querySelectorAll: () => [],
    ...overrides,
  };
  return JSON.parse(JSON.stringify(runInNewContext(`(${readPage.toString()})()`, {
    document, location: { href: "https://example.com/" },
  })));
}

test("oversized metadata fails closed without transporting a partial snapshot", () => {
  const snapshot = readDocument({
    head: { querySelector: () => ({ textContent: "x".repeat(2_000_000) }) },
  });
  assert.deepEqual(snapshot, { readError: "resource-limit" });
});

test("aggregate text budget also rejects many individually acceptable fields", () => {
  const snapshot = readDocument({
    querySelectorAll: (selector) => selector === "h1"
      ? Array.from({ length: 6 }, () => ({ textContent: "x".repeat(200_000) }))
      : [],
  });
  assert.deepEqual(snapshot, { readError: "resource-limit" });
});

test("large image sets retain exact counts within budget and stop before copying above budget", () => {
  let reads = 0;
  const image = { hasAttribute: () => { reads += 1; return true; } };
  const images = Array(100_000).fill(image);
  const snapshot = readDocument({ querySelectorAll: (selector) => selector === "img" ? images : [] });
  assert.equal(snapshot.imageAltAttributePresence.length, images.length);
  assert.equal(reads, images.length);
  reads = 0;
  images.push(image);
  assert.deepEqual(readDocument({ querySelectorAll: (selector) => selector === "img" ? images : [] }), { readError: "resource-limit" });
  assert.equal(reads, 0);
});

test("resource-limit output becomes an explicit access error instead of SEO passes", async () => {
  mockChrome([{ id: 1, url: "https://example.com/" }], async () => [{ frameId: 0, result: { readError: "resource-limit" } }]);
  await assert.rejects(readActivePage, (error) => error instanceof PageAccessError
    && error.message.includes("kontrol durduruldu")
    && !error.message.includes("read-page.js"));
});
