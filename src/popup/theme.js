const THEME_STORAGE_KEY = "themePreference";
const DEFAULT_THEME = "system";
const THEME_OPTIONS = new Set(["system", "light", "dark"]);

function normalizeTheme(value) {
  return THEME_OPTIONS.has(value) ? value : DEFAULT_THEME;
}

function applyTheme(theme, root, themeButtons) {
  root.dataset.theme = theme;
  for (const button of themeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.themeOption === theme));
  }
}

function readStoredTheme() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(THEME_STORAGE_KEY, (storedValues) => {
        if (chrome.runtime?.lastError) {
          resolve(DEFAULT_THEME);
          return;
        }

        resolve(normalizeTheme(storedValues?.[THEME_STORAGE_KEY]));
      });
    } catch (error) {
      reject(error);
    }
  });
}

function storeTheme(theme) {
  try {
    chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme }, () => {
      void chrome.runtime?.lastError;
    });
  } catch {
    // Keep the selected theme active for this popup session if storage is unavailable.
  }
}

export async function initializeTheme() {
  const root = document.documentElement;
  const themeButtons = [...document.querySelectorAll("#theme-select [data-theme-option]")];
  let theme = DEFAULT_THEME;

  try {
    theme = await readStoredTheme();
  } catch {
    // The system theme remains usable even if stored preferences cannot be read.
  }

  applyTheme(theme, root, themeButtons);
  for (const button of themeButtons) {
    button.addEventListener("click", () => {
      theme = normalizeTheme(button.dataset.themeOption);
      applyTheme(theme, root, themeButtons);
      storeTheme(theme);
    });
  }
}
