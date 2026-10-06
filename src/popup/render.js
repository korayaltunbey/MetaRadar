const STATUS_LABELS = Object.freeze({ passed: "Passed", warning: "Warning", error: "Error" });
const MAX_DISPLAY_CODE_UNITS = 4_096;

function limitDisplayText(text) {
  if (text.length <= MAX_DISPLAY_CODE_UNITS) return text;

  // Keep both ends of long values/messages, including the explanation after a value.
  const segmentLength = MAX_DISPLAY_CODE_UNITS / 2;
  const start = text.slice(0, segmentLength).replace(/[\uD800-\uDBFF]$/u, "");
  const end = text.slice(-segmentLength).replace(/^[\uDC00-\uDFFF]/u, "");
  return `${start}\n… [Uzun metnin orta bölümü yalnızca görünümde kısaltıldı; kontrol tam değerle yapıldı.] …\n${end}`;
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return value.join("\n");
  }

  return String(value ?? "");
}

export function renderResults(results, list, template) {
  const fragment = document.createDocumentFragment();

  for (const result of results) {
    const item = template.content.firstElementChild.cloneNode(true);
    item.dataset.status = result.status;
    item.querySelector("h3").textContent = result.title;
    item.querySelector(".status-badge").textContent = STATUS_LABELS[result.status];
    const value = formatValue(result.value);
    const valueElement = item.querySelector(".result-value");
    valueElement.textContent = limitDisplayText(value);
    valueElement.hidden = value === "";
    item.querySelector(".result-message").textContent = limitDisplayText(result.message);
    fragment.append(item);
  }

  // Page-derived strings are untrusted; render them as text, never as HTML.
  list.replaceChildren(fragment);
}
