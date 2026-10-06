import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTheme } from "../src/popup/theme.js";

afterEach(() => {
  delete globalThis.chrome;
  delete globalThis.document;
});

function createThemeEnvironment(initialValues = {}) {
  const storedValues = { ...initialValues };
  const calls = [];
  const listeners = {};
  const themeButtons = ["system", "light", "dark"].map((themeOption) => {
    const themeButton = {
      dataset: { themeOption },
      attributes: {},
      addEventListener: (eventName, listener) => { listeners[themeOption] = listener; },
      setAttribute: (name, value) => { themeButton.attributes[name] = value; },
    };
    return themeButton;
  });
  const root = { dataset: {} };

  globalThis.document = {
    documentElement: root,
    querySelectorAll: (selector) => {
      assert.equal(selector, "#theme-select [data-theme-option]");
      return themeButtons;
    },
  };
  globalThis.chrome = {
    storage: {
      local: {
        get: (key, callback) => {
          calls.push({ operation: "get", key });
          callback({ [key]: storedValues[key] });
        },
        set: (values, callback) => {
          calls.push({ operation: "set", values: { ...values } });
          Object.assign(storedValues, values);
          callback?.();
        },
      },
    },
    runtime: {},
  };

  return { calls, listeners, root, storedValues, themeButtons };
}

test("first popup open defaults to System and reads only the theme preference", async () => {
  const environment = createThemeEnvironment();
  await initializeTheme();

  assert.equal(environment.root.dataset.theme, "system");
  assert.equal(environment.themeButtons[0].attributes["aria-pressed"], "true");
  assert.deepEqual(environment.calls, [{ operation: "get", key: "themePreference" }]);
});

test("stored Light and Dark preferences are restored when the popup opens", async () => {
  for (const theme of ["light", "dark"]) {
    const environment = createThemeEnvironment({ themePreference: theme });
    await initializeTheme();
    assert.equal(environment.root.dataset.theme, theme);
    assert.equal(environment.themeButtons.find((button) => button.dataset.themeOption === theme).attributes["aria-pressed"], "true");
  }
});

test("changing the theme updates the popup and stores only the selected preference", async () => {
  const environment = createThemeEnvironment();
  await initializeTheme();

  environment.listeners.dark();

  assert.equal(environment.root.dataset.theme, "dark");
  assert.deepEqual(environment.storedValues, { themePreference: "dark" });
  assert.deepEqual(environment.calls.at(-1), { operation: "set", values: { themePreference: "dark" } });
});

test("a saved preference survives closing and reopening the popup", async () => {
  const firstOpen = createThemeEnvironment();
  await initializeTheme();
  firstOpen.listeners.light();

  const reopened = createThemeEnvironment(firstOpen.storedValues);
  await initializeTheme();
  assert.equal(reopened.root.dataset.theme, "light");
  assert.equal(reopened.themeButtons.find((button) => button.dataset.themeOption === "light").attributes["aria-pressed"], "true");
});

test("System mode follows the operating system through the native color-scheme media query", async () => {
  const environment = createThemeEnvironment({ themePreference: "system" });
  await initializeTheme();
  const css = await readFile(new URL("../src/popup/popup.css", import.meta.url), "utf8");

  assert.equal(environment.root.dataset.theme, "system");
  assert.match(css, /@media \(prefers-color-scheme: dark\)/u);
  assert.match(css, /:root:not\(\[data-theme="light"\]\)/u);
});

test("unknown stored theme values fall back to System", async () => {
  const environment = createThemeEnvironment({ themePreference: "unexpected" });
  await initializeTheme();
  assert.equal(environment.root.dataset.theme, "system");
  assert.equal(environment.themeButtons[0].attributes["aria-pressed"], "true");
});

test("manipulated stored preferences cannot become markup or arbitrary theme attributes", async () => {
  for (const value of [null, undefined, false, 1, [], {}, { __proto__: { theme: "dark" } }, "__proto__", "constructor", '<img src=x onerror=alert(1)>', "dark\" onclick=alert(1)"]) {
    const environment = createThemeEnvironment({ themePreference: value });
    await initializeTheme();
    assert.equal(environment.root.dataset.theme, "system");
    assert.equal(environment.themeButtons[0].attributes["aria-pressed"], "true");
    assert.equal(environment.calls.filter((call) => call.operation === "set").length, 0);
  }
});

test("storage errors fall back safely and a failed write does not break the current popup", async () => {
  const environment = createThemeEnvironment();
  chrome.storage.local.get = () => { throw new Error("Internal storage details"); };
  chrome.storage.local.set = () => { throw new Error("Internal storage details"); };
  await initializeTheme();
  assert.equal(environment.root.dataset.theme, "system");
  assert.doesNotThrow(() => environment.listeners.dark());
  assert.equal(environment.root.dataset.theme, "dark");

  const unavailable = createThemeEnvironment({ themePreference: "light" });
  chrome.runtime.lastError = { message: "Internal storage details" };
  await initializeTheme();
  assert.equal(unavailable.root.dataset.theme, "system");
});
