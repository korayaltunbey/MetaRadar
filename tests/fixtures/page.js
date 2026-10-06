import { readPage } from "../../src/page/read-page.js";
import { SEO_CONFIG } from "../../src/seo/config.js";

const scenario = new URLSearchParams(location.search).get("case");
const description = document.querySelector('meta[name="description" i]');
const robotsMeta = document.querySelector('meta[name="robots" i]');
const canonical = document.querySelector('link[rel~="canonical" i]');
const ogTitleTags = Array.from(document.querySelectorAll('meta[property="og:title" i]'));
const ogDescriptionTags = Array.from(document.querySelectorAll('meta[property="og:description" i]'));
const ogImageTags = Array.from(document.querySelectorAll('meta[property="og:image" i]'));
const hreflangLinks = Array.from(document.querySelectorAll('link[rel~="alternate" i][hreflang]'));
const images = Array.from(document.querySelectorAll("img"));

if (scenario === "missing") {
  document.querySelector("title").remove();
  description.remove();
  robotsMeta.remove();
  canonical.remove();
  document.querySelector("h1").remove();
  document.documentElement.removeAttribute("lang");
} else if (scenario === "og-title-missing") {
  ogTitleTags.forEach((meta) => meta.remove());
} else if (scenario === "og-description-missing") {
  ogDescriptionTags.forEach((meta) => meta.remove());
} else if (scenario === "og-image-missing") {
  ogImageTags.forEach((meta) => meta.remove());
} else if (scenario === "og-empty") {
  [...ogTitleTags, ...ogDescriptionTags, ...ogImageTags].forEach((meta) => meta.setAttribute("content", "  "));
} else if (scenario === "hreflang-none") {
  hreflangLinks.forEach((link) => link.remove());
} else if (scenario === "hreflang-empty-language") {
  hreflangLinks[0].setAttribute("hreflang", "");
} else if (scenario === "hreflang-empty-href") {
  hreflangLinks[0].setAttribute("href", "");
} else if (scenario === "hreflang-duplicate") {
  hreflangLinks[1].setAttribute("hreflang", "EN");
} else if (scenario === "long") {
  document.title = "x".repeat(SEO_CONFIG.titleWarningLength + 1);
  description.setAttribute("content", "x".repeat(SEO_CONFIG.descriptionWarningLength + 1));
} else if (scenario === "multiple") {
  const heading = document.createElement("h1");
  heading.textContent = "Another heading";
  document.body.append(heading);
  document.head.append(canonical.cloneNode(true));
} else if (scenario === "invalid") {
  canonical.setAttribute("href", "javascript:alert(1)");
} else if (scenario === "noindex") {
  robotsMeta.setAttribute("content", "INDEX, NoIndex");
} else if (scenario === "empty-robots") {
  robotsMeta.setAttribute("content", "  ");
} else if (scenario === "invalid-lang") {
  document.documentElement.setAttribute("lang", "en_US");
} else if (scenario === "images-missing-alt") {
  document.body.append(document.createElement("img"), document.createElement("img"));
} else if (scenario === "no-images") {
  images.forEach((image) => image.remove());
} else if (scenario === "untrusted") {
  document.title = '<img src="https://external.invalid/test" onerror="alert(1)">';
}

document.getElementById("change-title").addEventListener("click", () => {
  document.title = "Changed title";
});

// Test harness entry point; this file is never loaded by the extension.
window.readFixture = readPage;
window.dispatchEvent(new Event("fixture-ready"));
