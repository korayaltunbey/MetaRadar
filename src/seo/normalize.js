const MAX_CANONICAL_CODE_UNITS = 1_048_576;

export class PageDataLimitError extends Error {
  constructor() {
    super("Canonical değerleri güvenli işleme sınırını aştı. Kısmi veya yanıltıcı sonuç göstermemek için kontrol durduruldu.");
    this.name = "PageDataLimitError";
  }
}

export function normalizeText(value) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

function normalizeAttributeValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function countCharacters(value) {
  let count = 0;
  for (const character of value) {
    count += 1;
  }
  return count;
}

function normalizeCanonical(value, baseUrl) {
  const href = typeof value === "string" ? value.trim() : "";

  if (!href) {
    return { href, url: "", isValid: false };
  }

  try {
    const url = new URL(href, baseUrl);
    return { href, url: url.href, isValid: ["http:", "https:"].includes(url.protocol) };
  } catch {
    return { href, url: "", isValid: false };
  }
}

function normalizeCanonicals(values, baseUrl) {
  let codeUnits = 0;
  return values.map((value) => {
    const canonical = normalizeCanonical(value, baseUrl);
    // Relative links can multiply a long base URL far beyond the raw snapshot size.
    codeUnits += canonical.href.length + canonical.url.length;
    if (codeUnits > MAX_CANONICAL_CODE_UNITS) throw new PageDataLimitError();
    return canonical;
  });
}

function normalizeRobotsContents(contents) {
  return {
    values: contents.map(normalizeText),
    directives: [...new Set(contents.flatMap((content) =>
      normalizeText(content).toLowerCase().split(/[\s,]+/u).filter(Boolean)))],
  };
}

function normalizeLanguage(value) {
  const language = normalizeText(value);

  if (!language) {
    return { value: language, isValid: false };
  }

  try {
    Intl.getCanonicalLocales(language);
    return { value: language, isValid: true };
  } catch {
    return { value: language, isValid: /^x(?:-[a-z0-9]{1,8})+$/iu.test(language) };
  }
}

function normalizeOpenGraphValue(value, normalize) {
  return {
    isPresent: value.isPresent,
    value: normalize(value.value),
  };
}

function normalizeHreflangLinks(links) {
  return links.map(({ language, href }) => ({
    language: normalizeAttributeValue(language),
    href: normalizeAttributeValue(href),
  }));
}

export function normalizePageData(snapshot) {
  const title = normalizeText(snapshot.title);
  const description = normalizeText(snapshot.description);
  const robots = normalizeRobotsContents(snapshot.robotsContents);
  const imageCount = snapshot.imageAltAttributePresence.length;

  return {
    url: snapshot.url,
    title,
    titleLength: countCharacters(title),
    description,
    descriptionLength: countCharacters(description),
    robotsContents: robots.values,
    robotsDirectives: robots.directives,
    ogTitle: normalizeOpenGraphValue(snapshot.ogTitle, normalizeText),
    ogDescription: normalizeOpenGraphValue(snapshot.ogDescription, normalizeText),
    ogImage: normalizeOpenGraphValue(snapshot.ogImage, normalizeAttributeValue),
    htmlLang: normalizeLanguage(snapshot.htmlLang),
    imageCount,
    missingAltCount: snapshot.imageAltAttributePresence.filter((hasAltAttribute) => !hasAltAttribute).length,
    h1Texts: snapshot.h1Texts.map(normalizeText),
    canonicals: normalizeCanonicals(snapshot.canonicalHrefs, snapshot.baseUrl),
    hreflangLinks: normalizeHreflangLinks(snapshot.hreflangLinks),
  };
}
