// Chrome serializes this function for injection; it must not use imports or closures.
export function readPage() {
  const supportedContentTypes = ["text/html", "application/xhtml+xml"];

  if (!supportedContentTypes.includes(document.contentType)) {
    return null;
  }

  const head = document.head;
  // Bound transport and downstream work without returning misleading partial results.
  const readLimits = {
    maxFieldCodeUnits: 262_144,
    maxMetadataCodeUnits: 1_048_576,
    maxMatchedElements: 100_000,
  };
  const resourceLimit = Symbol("resource-limit");
  let metadataCodeUnits = 0;
  let matchedElements = 0;

  function readText(value) {
    const text = value ?? "";
    metadataCodeUnits += text.length;
    if (text.length > readLimits.maxFieldCodeUnits || metadataCodeUnits > readLimits.maxMetadataCodeUnits) {
      throw resourceLimit;
    }
    return text;
  }

  function readList(nodes, readElement) {
    matchedElements += nodes.length;
    if (matchedElements > readLimits.maxMatchedElements) {
      throw resourceLimit;
    }
    return Array.from(nodes, readElement);
  }

  function readOpenGraphContent(property) {
    const meta = head?.querySelector(`meta[property="${property}" i]`);
    return { isPresent: Boolean(meta), value: readText(meta?.getAttribute("content")) };
  }

  try {
    return {
      url: readText(location.href),
      baseUrl: readText(document.baseURI),
      title: readText(head?.querySelector("title")?.textContent),
      description: readText(head?.querySelector('meta[name="description" i]')?.getAttribute("content")),
      robotsContents: readList(
        head?.querySelectorAll('meta[name="robots" i]') ?? [],
        (meta) => readText(meta.getAttribute("content")),
      ),
      ogTitle: readOpenGraphContent("og:title"),
      ogDescription: readOpenGraphContent("og:description"),
      ogImage: readOpenGraphContent("og:image"),
      htmlLang: readText(document.documentElement?.getAttribute("lang")),
      h1Texts: readList(document.querySelectorAll("h1"), (heading) => readText(heading.textContent)),
      imageAltAttributePresence: readList(
        document.querySelectorAll("img"),
        (image) => image.hasAttribute("alt"),
      ),
      canonicalHrefs: readList(
        head?.querySelectorAll('link[rel~="canonical" i]') ?? [],
        (link) => readText(link.getAttribute("href")),
      ),
      hreflangLinks: readList(
        head?.querySelectorAll('link[rel~="alternate" i][hreflang]') ?? [],
        (link) => ({
          language: readText(link.getAttribute("hreflang")),
          href: readText(link.getAttribute("href")),
        }),
      ),
    };
  } catch (error) {
    if (error === resourceLimit) {
      return { readError: "resource-limit" };
    }
    throw error;
  }
}
