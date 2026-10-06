import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { renderResults } from "../src/popup/render.js";

afterEach(() => { delete globalThis.document; });

function createRenderEnvironment() {
  const items = [];
  globalThis.document = {
    createDocumentFragment: () => ({ append: (item) => items.push(item) }),
  };
  function createTextElement() {
    const element = { textContent: "", hidden: false };
    for (const name of ["innerHTML", "outerHTML", "src", "href"]) {
      Object.defineProperty(element, name, { set: () => assert.fail(`Unsafe sink: ${name}`) });
    }
    element.setAttribute = () => assert.fail("Metadata must not be assigned to attributes");
    element.insertAdjacentHTML = () => assert.fail("Metadata must not become HTML");
    return element;
  }
  const template = { content: { firstElementChild: { cloneNode: () => {
    const fields = new Map(["h3", ".status-badge", ".result-value", ".result-message"].map((selector) => [selector, createTextElement()]));
    return { dataset: {}, querySelector: (selector) => fields.get(selector) };
  } } } };
  const list = { replaceChildren: () => {} };
  return { items, template, list };
}

test("HTML, script, event-handler and URL payloads render only as literal text", () => {
  for (const payload of ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '"><svg onload=alert(1)>', 'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'Türkçe 😀 <>&"\'']) {
    const environment = createRenderEnvironment();
    renderResults([{ id: "untrusted", status: "warning", title: "Metadata", value: payload, message: payload }], environment.list, environment.template);
    const item = environment.items[0];
    assert.equal(item.querySelector(".result-value").textContent, payload);
    assert.equal(item.querySelector(".result-message").textContent, payload);
    assert.equal(item.querySelector(".status-badge").textContent, "Warning");
  }
});

test("oversized display text is visibly shortened without modifying evaluated values or hiding the explanation", () => {
  const environment = createRenderEnvironment();
  const value = `A${"😀".repeat(100_000)}B`;
  const result = { id: "untrusted", status: "error", title: "Metadata", value, message: `${value} — Yapılandırmayı kontrol edin.` };
  renderResults([result], environment.list, environment.template);
  const item = environment.items[0];
  for (const selector of [".result-value", ".result-message"]) {
    const text = item.querySelector(selector).textContent;
    assert.ok(text.length < 4_300);
    assert.match(text, /yalnızca görünümde kısaltıldı/u);
    assert.equal(text.includes("�"), false);
    assert.equal(/[\uD800-\uDFFF]/u.test(text), false, "Display boundaries must not split a surrogate pair");
  }
  assert.ok(item.querySelector(".result-message").textContent.endsWith("Yapılandırmayı kontrol edin."));
  assert.equal(result.value, value);
  assert.equal(item.dataset.status, "error");
  assert.equal(item.querySelector(".status-badge").textContent, "Error");
});

test("undefined and null values render as empty text and array values remain literal", () => {
  for (const value of [null, undefined, ['javascript:alert(1)', '<img src=x>']]) {
    const environment = createRenderEnvironment();
    renderResults([{ id: "value", status: "passed", title: "Metadata", value, message: "Mevcut." }], environment.list, environment.template);
    const field = environment.items[0].querySelector(".result-value");
    assert.equal(field.textContent, Array.isArray(value) ? value.join("\n") : "");
    assert.equal(field.hidden, !Array.isArray(value));
  }
});
