import { normalizePageData } from "../src/seo/normalize.js";
import { evaluateSeo } from "../src/seo/evaluate.js";
import { renderResults } from "../src/popup/render.js";

const frame = document.getElementById("fixture");
const report = document.getElementById("report");
const resultsElement = document.getElementById("results");
const template = document.getElementById("result-template");
const popupFrame = document.getElementById("popup-preview");
let assertions = 0;

function expect(condition, message) {
  if (!condition) throw new Error(message);
  assertions += 1;
}

function loadFixture(scenario = "") {
  return new Promise((resolve, reject) => {
    frame.onload = () => {
      if (typeof frame.contentWindow.readFixture !== "function") {
        reject(new Error("Fixture module did not load"));
        return;
      }
      resolve(frame.contentWindow.readFixture());
    };
    frame.src = `fixtures/page.html?case=${scenario}`;
  });
}

function runChecks(snapshot) {
  return evaluateSeo(normalizePageData(snapshot));
}

function contrastRatio(foreground, background) {
  function luminance(color) {
    const channels = color.match(/[\d.]+/gu).slice(0, 3).map(Number).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function loadPopup() {
  return new Promise((resolve) => {
    popupFrame.onload = () => resolve(popupFrame.contentDocument);
    popupFrame.src = "../src/popup/popup.html";
  });
}

function refreshPopup(popupDocument) {
  return new Promise((resolve) => {
    const button = popupDocument.getElementById("refresh-button");
    const observer = new MutationObserver(() => {
      if (!button.disabled) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(button, { attributes: true, attributeFilter: ["disabled"] });
    button.click();
  });
}

function setMockSnapshot(snapshot) {
  // Only this test iframe receives a mock; production code uses Chrome's real APIs.
  popupFrame.contentWindow.chrome = {
    tabs: { query: async () => [{ id: 1, url: snapshot.url }] },
    scripting: { executeScript: async () => [{ frameId: 0, result: snapshot }] },
  };
}

try {
  const complete = runChecks(await loadFixture());
  expect(complete.length === 13 && complete.every((result) => result.status === "passed"), "Complete HTML should pass");
  expect(complete.find((result) => result.id === "canonical").value.endsWith("/tests/fixtures/page.html"), "Relative canonical should resolve");
  expect(complete.find((result) => result.id === "og-title").value === "First social title", "OG selectors should match case-insensitively and use the first duplicate");
  expect(complete.find((result) => result.id === "og-image").status === "passed", "OG image should pass without URL verification");
  expect(complete.find((result) => result.id === "hreflang").value === 3, "Hreflang selector should match relation case-insensitively and count entries");
  expect(complete.find((result) => result.id === "hreflang").status === "passed", "Valid hreflang entries should pass");
  const missing = runChecks(await loadFixture("missing"));
  expect(missing.length === 11 && missing[0].status === "error", "Missing metadata should report absence");
  expect(runChecks(await loadFixture("hreflang-none")).find((result) => result.id === "hreflang").status === "passed", "No hreflang should not fail");
  expect(runChecks(await loadFixture("hreflang-empty-language")).find((result) => result.id === "hreflang").status === "warning", "Empty hreflang should warn");
  expect(runChecks(await loadFixture("hreflang-empty-href")).find((result) => result.id === "hreflang").status === "warning", "Empty href should warn");
  expect(runChecks(await loadFixture("hreflang-duplicate")).find((result) => result.id === "hreflang").status === "warning", "Duplicate hreflang should warn");
  for (const [scenario, id] of [["og-title-missing", "og-title"], ["og-description-missing", "og-description"], ["og-image-missing", "og-image"]]) {
    expect(runChecks(await loadFixture(scenario)).find((result) => result.id === id).status === "warning", `${id} should warn when missing`);
  }
  const emptyOg = runChecks(await loadFixture("og-empty"));
  expect(["og-title", "og-description", "og-image"].every((id) => emptyOg.find((result) => result.id === id).status === "warning"), "Empty OG content should warn");
  const long = runChecks(await loadFixture("long"));
  expect(long.filter((result) => result.status === "warning").length === 2, "Long metadata should warn");
  const multiple = runChecks(await loadFixture("multiple"));
  expect(multiple.find((result) => result.id === "h1-count").value === 2, "Actual DOM should expose both H1 elements");
  expect(multiple.find((result) => result.id === "canonical").status === "warning", "Duplicate canonical should warn");
  const invalid = runChecks(await loadFixture("invalid"));
  expect(invalid.find((result) => result.id === "canonical").status === "error", "Non-web canonical should fail");
  const noindex = runChecks(await loadFixture("noindex"));
  expect(noindex.find((result) => result.id === "meta-robots").status === "warning", "noindex should warn about possible indexing effects");
  const emptyRobots = runChecks(await loadFixture("empty-robots"));
  expect(emptyRobots.find((result) => result.id === "meta-robots").status === "warning", "Empty robots metadata should warn");
  const invalidLang = runChecks(await loadFixture("invalid-lang"));
  expect(invalidLang.find((result) => result.id === "html-lang").status === "error", "Malformed language tags should fail");
  expect(complete.find((result) => result.id === "html-lang").status === "passed", "Valid HTML lang should pass");
  const missingImageAlt = runChecks(await loadFixture("images-missing-alt"));
  expect(missingImageAlt.find((result) => result.id === "image-alt").value === 4, "All fixture images should be counted");
  expect(missingImageAlt.find((result) => result.id === "image-alt").status === "warning", "Missing alt attributes should warn");
  const noImages = runChecks(await loadFixture("no-images"));
  expect(noImages.find((result) => result.id === "image-alt").status === "passed", "Pages without images should not fail");
  const untrusted = runChecks(await loadFixture("untrusted"));
  renderResults(untrusted, resultsElement, template);
  expect(resultsElement.querySelector("img") === null, "Untrusted metadata must not become HTML");
  expect(resultsElement.textContent.includes("<img src="), "Untrusted metadata should remain literal text");
  const payloadSnapshot = await loadFixture();
  for (const payload of ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '"><svg onload=alert(1)>', 'javascript:alert(1)', 'Türkçe 😀 <>&"']) {
    renderResults([{ id: "security", status: "warning", title: "Metadata", value: payload, message: payload }], resultsElement, template);
    expect(resultsElement.querySelector("img, script, svg, a, [onerror], [onload]") === null, "Payloads must not create executable DOM or links");
    expect(resultsElement.querySelector(".result-value").textContent === payload, "Payloads should stay literal, including Unicode");
    renderResults(runChecks({ ...payloadSnapshot, title: payload, description: payload, htmlLang: payload,
      robotsContents: [payload], h1Texts: [payload], canonicalHrefs: [payload],
      ogTitle: { isPresent: true, value: payload }, ogDescription: { isPresent: true, value: payload }, ogImage: { isPresent: true, value: payload },
      hreflangLinks: [{ language: payload, href: payload }, { language: payload, href: payload }],
    }), resultsElement, template);
    expect(resultsElement.querySelector("img, script, svg, a, [onerror], [onload]") === null, "Page-derived payloads must remain inert across the full pipeline");
    expect(resultsElement.textContent.includes(payload), "The pipeline must preserve the payload as text");
  }
  const hugeValue = "😀".repeat(100_000);
  renderResults([{ id: "security", status: "error", title: "Metadata", value: hugeValue, message: `${hugeValue} Kontrol edin.` }], resultsElement, template);
  expect(resultsElement.querySelector(".result-value").textContent.length < 4_300, "Rendered metadata should have a bounded display size");
  expect(resultsElement.textContent.includes("yalnızca görünümde kısaltıldı"), "Display shortening must be disclosed");
  expect(resultsElement.querySelector(".result-message").textContent.endsWith("Kontrol edin."), "Long messages must retain their concluding explanation");
  frame.contentDocument.querySelector('meta[name="description" i]').setAttribute("content", "x".repeat(2_000_000));
  expect(JSON.stringify(frame.contentWindow.readFixture()) === JSON.stringify({ readError: "resource-limit" }), "Oversized real DOM metadata must not be transferred as a partial snapshot");
  const normalSnapshot = await loadFixture();
  frame.contentDocument.getElementById("change-title").click();
  expect(frame.contentWindow.readFixture().title === "Changed title", "A fresh snapshot should reflect a DOM change");
  renderResults([...runChecks(normalSnapshot), ...missing, ...invalid.filter((result) => result.id === "canonical")], resultsElement, template);
  expect(resultsElement.children.length === 25, "Render replacement should clear previous results");
  expect(resultsElement.querySelectorAll('[data-status="passed"]').length === 18, "Passed states should render");
  expect(resultsElement.querySelectorAll('[data-status="warning"]').length === 5, "Warning states should render");
  expect(resultsElement.querySelectorAll('[data-status="error"]').length === 2, "Error states should render");
  const popupDocument = await loadPopup();
  expect(!popupDocument.getElementById("access-error").hidden, "Actual popup should handle unavailable Chrome APIs");
  setMockSnapshot(normalSnapshot);
  await refreshPopup(popupDocument);
  expect(popupDocument.getElementById("results").children.length === 13, "Actual popup should run the pipeline");
  expect(popupDocument.getElementById("access-error").hidden, "Successful refresh should clear the access error");
  expect(popupDocument.getElementById("results").getAttribute("aria-busy") === "false", "Loading state should finish");
  setMockSnapshot({ ...normalSnapshot, title: "", description: "", robotsContents: [], htmlLang: "", h1Texts: [], canonicalHrefs: [] });
  await refreshPopup(popupDocument);
  expect(popupDocument.getElementById("results").children.length === 11, "Refresh should replace old results");
  setMockSnapshot({ ...normalSnapshot, readError: "resource-limit" });
  await refreshPopup(popupDocument);
  expect(popupDocument.getElementById("results").children.length === 0, "Resource failure must clear old successful results");
  expect(popupDocument.getElementById("access-error").textContent.includes("kontrol durduruldu"), "Resource failure must be explicit");
  expect(!popupDocument.getElementById("refresh-button").disabled, "Retry must remain available after a resource failure");
  setMockSnapshot({ ...normalSnapshot, baseUrl: `https://example.com/${"x".repeat(200_000)}/`, canonicalHrefs: Array(100).fill("article") });
  await refreshPopup(popupDocument);
  expect(popupDocument.getElementById("results").children.length === 0, "Canonical amplification must not leave successful cards");
  expect(popupDocument.getElementById("access-error").textContent.includes("Canonical değerleri"), "Canonical amplification must produce a safe explicit error");
  setMockSnapshot({ ...normalSnapshot, robotsContents: null });
  await refreshPopup(popupDocument);
  expect(popupDocument.getElementById("results").children.length === 0, "Malformed snapshots must fail without fabricated checks");
  expect(!popupDocument.getElementById("access-error").textContent.includes("TypeError"), "Internal errors must not expose stack or implementation details");
  setMockSnapshot(normalSnapshot);
  await refreshPopup(popupDocument);
  expect(popupDocument.documentElement.scrollWidth <= popupDocument.documentElement.clientWidth, "Popup should not overflow horizontally");
  for (const theme of ["light", "dark"]) {
    popupDocument.documentElement.dataset.theme = theme;
    renderResults(["passed", "warning", "error"].map((status) => ({ id: status, status, title: "Metadata", value: "Value", message: "Açıklama" })), popupDocument.getElementById("results"), popupDocument.getElementById("result-template"));
    for (const badge of popupDocument.querySelectorAll(".status-badge")) {
      const style = popupFrame.contentWindow.getComputedStyle(badge);
      expect(contrastRatio(style.color, style.backgroundColor) >= 4.5, `${theme} status text must retain readable contrast`);
      expect(badge.textContent.length > 0, "Status must be available as text, not only color");
    }
    const message = popupDocument.querySelector(".result-message");
    expect(contrastRatio(popupFrame.contentWindow.getComputedStyle(message).color, popupFrame.contentWindow.getComputedStyle(message.closest(".result")).backgroundColor) >= 4.5, `${theme} explanations must retain readable contrast`);
    const themeButton = popupDocument.querySelector('#theme-select [data-theme-option="light"]');
    themeButton.focus();
    expect(popupDocument.activeElement === themeButton && popupFrame.contentWindow.getComputedStyle(themeButton).outlineStyle !== "none", `${theme} keyboard focus must be visible`);
    themeButton.click();
    expect(themeButton.getAttribute("aria-pressed") === "true", `${theme} selection must expose its state to assistive technology`);
  }
  report.textContent = `${assertions} browser assertions passed`;
  document.documentElement.dataset.testStatus = "passed";
} catch (error) {
  report.textContent = `Failed: ${error.message}`;
  document.documentElement.dataset.testStatus = "failed";
}
