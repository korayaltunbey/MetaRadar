import { PageAccessError, readActivePage } from "../page/active-page.js";
import { normalizePageData, PageDataLimitError } from "../seo/normalize.js";
import { evaluateSeo } from "../seo/evaluate.js";
import { initializeTheme } from "./theme.js";
import { renderResults } from "./render.js";

const elements = {
  pageHost: document.getElementById("page-host"),
  refreshButton: document.getElementById("refresh-button"),
  feedback: document.getElementById("feedback"),
  accessError: document.getElementById("access-error"),
  results: document.getElementById("results"),
  template: document.getElementById("result-template"),
};

function setLoading() {
  elements.refreshButton.disabled = true;
  elements.results.setAttribute("aria-busy", "true");
  elements.results.replaceChildren();
  elements.accessError.hidden = true;
  elements.accessError.textContent = "";
  elements.pageHost.textContent = "Sayfa okunuyor…";
  elements.feedback.textContent = "Sayfa etiketleri okunuyor…";
}

function showAccessError(error) {
  elements.pageHost.textContent = "Sayfa incelenemedi";
  elements.feedback.textContent = "SEO sonuçları oluşturulamadı.";
  elements.accessError.textContent = error instanceof PageAccessError || error instanceof PageDataLimitError
    ? error.message
    : "Kontrol tamamlanamadı. Sayfanın yüklenmesini bekleyip tekrar deneyin.";
  elements.accessError.hidden = false;
}

async function inspectPage() {
  setLoading();

  try {
    const snapshot = await readActivePage();
    const page = normalizePageData(snapshot);
    const results = evaluateSeo(page);
    elements.pageHost.textContent = new URL(page.url).hostname;
    renderResults(results, elements.results, elements.template);
    elements.feedback.textContent = `${results.length} kontrol tamamlandı. Sayfanın mevcut DOM'u incelendi.`;
  } catch (error) {
    showAccessError(error);
  } finally {
    elements.results.setAttribute("aria-busy", "false");
    elements.refreshButton.disabled = false;
  }
}

elements.refreshButton.addEventListener("click", inspectPage);
await initializeTheme();
inspectPage();
