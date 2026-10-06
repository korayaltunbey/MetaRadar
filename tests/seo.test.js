import test from "node:test";
import assert from "node:assert/strict";
import { normalizePageData, PageDataLimitError } from "../src/seo/normalize.js";
import { evaluateSeo } from "../src/seo/evaluate.js";
import { SEO_CONFIG } from "../src/seo/config.js";

function createSnapshot(overrides = {}) {
  return {
    url: "https://example.com/article",
    baseUrl: "https://example.com/",
    title: "Example title",
    description: "Example description",
    robotsContents: ["index, follow"],
    ogTitle: { isPresent: true, value: "Example social title" },
    ogDescription: { isPresent: true, value: "Example social description" },
    ogImage: { isPresent: true, value: "https://example.com/social.png" },
    htmlLang: "en-US",
    imageAltAttributePresence: [true, true],
    h1Texts: ["Example heading"],
    canonicalHrefs: ["/article"],
    hreflangLinks: [{ language: "en", href: "/en" }, { language: "tr", href: "/tr" }, { language: "x-default", href: "/" }],
    ...overrides,
  };
}

function getResults(overrides = {}) {
  return evaluateSeo(normalizePageData(createSnapshot(overrides)));
}

function findResult(results, id) {
  return results.find((result) => result.id === id);
}

test("complete metadata yields thirteen passed results with stable IDs and standard shape", () => {
  const results = getResults();
  assert.equal(results.length, 13);
  assert.equal(new Set(results.map((result) => result.id)).size, results.length);
  for (const result of results) {
    assert.equal(result.status, "passed");
    assert.deepEqual(Object.keys(result), ["id", "status", "title", "value", "message"]);
    assert.equal(typeof result.message, "string");
  }
});

test("pages without hreflang pass with a neutral multilingual context", () => {
  const result = findResult(getResults({ hreflangLinks: [] }), "hreflang");
  assert.equal(result.status, "passed");
  assert.equal(result.value, 0);
  assert.match(result.message, /yalnızca çok dilli veya bölgesel sayfalarda gerekli olabilir/u);
});

test("one and multiple valid hreflang entries pass and report their count", () => {
  for (const hreflangLinks of [
    [{ language: "tr", href: "/tr" }],
    [{ language: "en", href: "/en" }, { language: "tr", href: "/tr" }],
  ]) {
    const result = findResult(getResults({ hreflangLinks }), "hreflang");
    assert.equal(result.status, "passed");
    assert.equal(result.value, hreflangLinks.length);
    assert.match(result.message, new RegExp(`${hreflangLinks.length} hreflang etiketi bulundu`, "u"));
  }
});

test("x-default is optional and reported when present", () => {
  const withDefault = findResult(getResults({ hreflangLinks: [{ language: "x-default", href: "/" }] }), "hreflang");
  const withoutDefault = findResult(getResults({ hreflangLinks: [{ language: "en", href: "/en" }] }), "hreflang");
  assert.equal(withDefault.status, "passed");
  assert.match(withDefault.message, /x-default tanımı mevcut/u);
  assert.equal(withoutDefault.status, "passed");
});

test("empty hreflang and href values warn independently", () => {
  const emptyLanguage = findResult(getResults({ hreflangLinks: [{ language: "", href: "/tr" }] }), "hreflang");
  const emptyHref = findResult(getResults({ hreflangLinks: [{ language: "tr", href: "" }] }), "hreflang");
  assert.equal(emptyLanguage.status, "warning");
  assert.match(emptyLanguage.message, /hreflang değeri olmadan/u);
  assert.equal(emptyHref.status, "warning");
  assert.match(emptyHref.message, /href değeri olmadan/u);
});

test("duplicate language values warn without case sensitivity", () => {
  const page = normalizePageData(createSnapshot({
    hreflangLinks: [{ language: "tr-TR", href: "/tr" }, { language: "TR-tr", href: "/tr-TR" }],
  }));
  const result = findResult(evaluateSeo(page), "hreflang");
  assert.equal(result.status, "warning");
  assert.match(result.message, /TR-tr hreflang değeri birden fazla kez/u);
});

test("Open Graph tags pass and preserve their values", () => {
  const results = getResults();
  for (const [id, value] of [
    ["og-title", "Example social title"],
    ["og-description", "Example social description"],
    ["og-image", "https://example.com/social.png"],
  ]) {
    const result = findResult(results, id);
    assert.equal(result.status, "passed");
    assert.equal(result.value, value);
  }
  assert.equal(findResult(results, "og-image").message, "og:image mevcut.");
});

test("missing Open Graph tags warn with social preview context", () => {
  for (const [field, id, tag] of [
    ["ogTitle", "og-title", "og:title"],
    ["ogDescription", "og-description", "og:description"],
    ["ogImage", "og-image", "og:image"],
  ]) {
    const result = findResult(getResults({ [field]: { isPresent: false, value: "" } }), id);
    assert.equal(result.status, "warning");
    assert.match(result.message, new RegExp(`${tag} bulunamadı`, "u"));
    assert.match(result.message, /sosyal platformlardaki paylaşım/iu);
    assert.doesNotMatch(result.message, /sıralama|SEO hatası/u);
  }
});

test("empty Open Graph content warns distinctly from a missing tag", () => {
  for (const [field, id, tag] of [
    ["ogTitle", "og-title", "og:title"],
    ["ogDescription", "og-description", "og:description"],
    ["ogImage", "og-image", "og:image"],
  ]) {
    const result = findResult(getResults({ [field]: { isPresent: true, value: " \n\t " } }), id);
    assert.equal(result.status, "warning");
    assert.match(result.message, new RegExp(`${tag} content değeri boş`, "u"));
    assert.doesNotMatch(result.message, new RegExp(`${tag} bulunamadı`, "u"));
  }
});

test("Open Graph text is normalized while image content is not URL-validated", () => {
  const page = normalizePageData(createSnapshot({
    ogTitle: { isPresent: true, value: "  Social\n title  " },
    ogDescription: { isPresent: true, value: "  A\t description " },
    ogImage: { isPresent: true, value: "  not a validated URL  " },
  }));
  assert.deepEqual(page.ogTitle, { isPresent: true, value: "Social title" });
  assert.deepEqual(page.ogDescription, { isPresent: true, value: "A description" });
  assert.deepEqual(page.ogImage, { isPresent: true, value: "not a validated URL" });
  assert.equal(findResult(evaluateSeo(page), "og-image").status, "passed");
});

test("blank metadata reports absence without fabricated length passes", () => {
  const results = getResults({ title: " \n ", description: "\t", h1Texts: [], canonicalHrefs: [], robotsContents: [], htmlLang: "" });
  assert.equal(results.length, 11);
  assert.equal(findResult(results, "title-presence").status, "error");
  assert.equal(findResult(results, "description-presence").status, "warning");
  assert.equal(findResult(results, "h1-count").status, "warning");
  assert.equal(findResult(results, "canonical").status, "warning");
  assert.equal(findResult(results, "image-alt").status, "passed");
  assert.equal(findResult(results, "title-length"), undefined);
  assert.equal(findResult(results, "description-length"), undefined);
});

for (const [field, id, threshold] of [
  ["title", "title-length", SEO_CONFIG.titleWarningLength],
  ["description", "description-length", SEO_CONFIG.descriptionWarningLength],
]) {
  test(`${field} warns only above its advisory threshold`, () => {
    assert.equal(findResult(getResults({ [field]: "x".repeat(threshold) }), id).status, "passed");
    const result = findResult(getResults({ [field]: "x".repeat(threshold + 1) }), id);
    assert.equal(result.status, "warning");
    assert.equal(result.value, threshold + 1);
    assert.match(result.message, /görüntülenmeyebilir/u);
  });
}

test("whitespace normalization and Unicode code points define the reported length", () => {
  const page = normalizePageData(createSnapshot({ title: "  SEO\n  radar 😀  ", description: " A\t B " }));
  assert.equal(page.title, "SEO radar 😀");
  assert.equal(page.titleLength, 11);
  assert.equal(page.description, "A B");
  assert.equal(page.descriptionLength, 3);
});

test("missing, multiple and empty H1 are warnings without a ranking penalty claim", () => {
  for (const h1Texts of [[], ["   "], ["One", "Two"]]) {
    const result = findResult(getResults({ h1Texts }), "h1-count");
    assert.equal(result.status, "warning");
    assert.equal(result.value, h1Texts.length);
  }
  assert.match(findResult(getResults({ h1Texts: ["One", "Two"] }), "h1-count").message, /tek başına sıralama sorunu anlamına gelmez/u);
});

test("robots directives are normalized across case, whitespace, commas and repeated tags", () => {
  const page = normalizePageData(createSnapshot({ robotsContents: [" INDEX,   follow ", "NoIndex", "follow"] }));
  assert.deepEqual(page.robotsContents, ["INDEX, follow", "NoIndex", "follow"]);
  assert.deepEqual(page.robotsDirectives, ["index", "follow", "noindex"]);
});

test("robots noindex and none warn about possible indexing effects", () => {
  for (const robotsContents of [["noindex"], ["NoIndex, follow"], ["none"], ["index, NONE"]]) {
    const result = findResult(getResults({ robotsContents }), "meta-robots");
    assert.equal(result.status, "warning");
    assert.match(result.message, /indekslemesini engelleyebilir/u);
  }
});

test("robots without noindex pass while explicitly limiting the conclusion", () => {
  for (const robotsContents of [["index, follow"], ["nofollow"], ["max-snippet:50"]]) {
    const result = findResult(getResults({ robotsContents }), "meta-robots");
    assert.equal(result.status, "passed");
    assert.match(result.message, /indekslenmeyi.*doğrulamaz/u);
  }
});

test("missing and blank robots metadata receive explanatory warnings", () => {
  for (const robotsContents of [[], [""], ["  \n "]]) {
    assert.equal(findResult(getResults({ robotsContents }), "meta-robots").status, "warning");
  }
});

test("common BCP 47 language tags and private-use tags pass without claiming content validation", () => {
  for (const htmlLang of ["en", "en-US", "zh-Hant-TW", "de-1996", "es-419", "x-private"]) {
    const result = findResult(getResults({ htmlLang }), "html-lang");
    assert.equal(result.status, "passed", htmlLang);
    assert.match(result.message, /içeriğinin dili ayrıca doğrulanmadı/u);
  }
});

test("missing and malformed HTML lang values report their distinct states", () => {
  for (const htmlLang of ["", "  "]) {
    assert.equal(findResult(getResults({ htmlLang }), "html-lang").status, "warning");
  }
  for (const htmlLang of ["en_US", "en--US", "123"]) {
    assert.equal(findResult(getResults({ htmlLang }), "html-lang").status, "error", htmlLang);
  }
});

test("an image with a present alt attribute passes", () => {
  const page = normalizePageData(createSnapshot({ imageAltAttributePresence: [true] }));
  const result = findResult(evaluateSeo(page), "image-alt");
  assert.equal(page.imageCount, 1);
  assert.equal(page.missingAltCount, 0);
  assert.equal(result.status, "passed");
  assert.equal(result.value, 1);
});

test("alt empty string remains a present attribute and does not warn", () => {
  // An empty value is intentional for decorative images, so attribute presence is enough.
  const page = normalizePageData(createSnapshot({ imageAltAttributePresence: [true] }));
  const result = findResult(evaluateSeo(page), "image-alt");
  assert.equal(page.missingAltCount, 0);
  assert.equal(result.status, "passed");
  assert.match(result.message, /dekoratif görseller için bilinçli/u);
});

test("an image with no alt attribute warns", () => {
  const page = normalizePageData(createSnapshot({ imageAltAttributePresence: [false] }));
  const result = findResult(evaluateSeo(page), "image-alt");
  assert.equal(page.imageCount, 1);
  assert.equal(page.missingAltCount, 1);
  assert.equal(result.status, "warning");
  assert.match(result.message, /1 görselde alt attribute bulunamadı/u);
});

test("multiple images report the total and missing counts", () => {
  const page = normalizePageData(createSnapshot({ imageAltAttributePresence: [true, true, false, false] }));
  const result = findResult(evaluateSeo(page), "image-alt");
  assert.equal(page.imageCount, 4);
  assert.equal(page.missingAltCount, 2);
  assert.equal(result.status, "warning");
  assert.match(result.message, /2 görselde alt attribute bulunamadı \(4 görsel incelendi\)/u);
});

test("a page with no images passes without claiming an image was inspected", () => {
  const page = normalizePageData(createSnapshot({ imageAltAttributePresence: [] }));
  const result = findResult(evaluateSeo(page), "image-alt");
  assert.equal(page.imageCount, 0);
  assert.equal(page.missingAltCount, 0);
  assert.equal(result.status, "passed");
  assert.match(result.message, /img elementi bulunamadı/u);
});

test("relative canonical honors base URI and preserves encoded URL whitespace", () => {
  const page = normalizePageData(createSnapshot({ baseUrl: "https://example.com/content/", canonicalHrefs: [" ./my%20article "] }));
  assert.equal(page.canonicals[0].url, "https://example.com/content/my%20article");
  assert.equal(findResult(evaluateSeo(page), "canonical").status, "passed");
});

test("canonical can point to another host without claiming the target was checked", () => {
  const result = findResult(getResults({ canonicalHrefs: ["https://other.example/article"] }), "canonical");
  assert.equal(result.status, "passed");
  assert.match(result.message, /doğrulanmadı/u);
});

test("blank, malformed and non-web canonical URLs are errors", () => {
  for (const href of ["", "  ", "http://[", "javascript:alert(1)", "mailto:hello@example.com", "data:text/html,test"]) {
    assert.equal(findResult(getResults({ canonicalHrefs: [href] }), "canonical").status, "error", href);
  }
});

test("multiple canonical tags warn even when their URLs are identical; invalid takes precedence", () => {
  assert.equal(findResult(getResults({ canonicalHrefs: ["/article", "/article"] }), "canonical").status, "warning");
  assert.equal(findResult(getResults({ canonicalHrefs: ["/article", ""] }), "canonical").status, "error");
});

test("normalization and evaluation do not mutate the snapshot", () => {
  const snapshot = createSnapshot();
  const original = structuredClone(snapshot);
  evaluateSeo(normalizePageData(snapshot));
  assert.deepEqual(snapshot, original);
});

test("missing primitive metadata is handled without interpreting objects or markup", () => {
  for (const value of [null, undefined, {}, 123]) {
    const results = getResults({ title: value, description: value, htmlLang: value });
    assert.equal(findResult(results, "title-presence").status, "error");
    assert.equal(findResult(results, "description-presence").status, "warning");
    assert.equal(findResult(results, "html-lang").status, "warning");
  }
  // A malformed internal snapshot must fail rather than fabricate successful checks.
  for (const snapshot of [null, undefined, {}]) {
    assert.throws(() => normalizePageData(snapshot));
  }
});

test("long Unicode values retain their full evaluated length and warning status", () => {
  const title = "😀".repeat(100_000);
  const results = getResults({ title });
  assert.equal(findResult(results, "title-presence").value, title);
  assert.equal(findResult(results, "title-length").value, 100_000);
  assert.equal(findResult(results, "title-length").status, "warning");
});

test("relative canonical expansion cannot amplify a long base URL without bound", () => {
  const snapshot = createSnapshot({
    baseUrl: `https://example.com/${"x".repeat(200_000)}/`,
    canonicalHrefs: Array(100).fill("article"),
  });
  assert.throws(() => normalizePageData(snapshot), PageDataLimitError);
  const normal = normalizePageData(createSnapshot({ canonicalHrefs: Array(100).fill("article") }));
  assert.equal(normal.canonicals.length, 100);
});

test("prototype-like language values remain plain data in duplicate detection", () => {
  for (const language of ["__proto__", "constructor", "prototype"]) {
    const result = findResult(getResults({ hreflangLinks: [
      { language, href: "javascript:alert(1)" }, { language, href: "data:text/html,test" },
    ] }), "hreflang");
    assert.equal(result.status, "warning");
    assert.match(result.message, /birden fazla kez/u);
    assert.equal(Object.prototype.polluted, undefined);
  }
});
