import { readPage } from "./read-page.js";

const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);

export class PageAccessError extends Error {
  constructor(message) {
    super(message);
    this.name = "PageAccessError";
  }
}

function isSupportedUrl(value) {
  try {
    return SUPPORTED_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

export async function readActivePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !Number.isInteger(tab.id)) {
    throw new PageAccessError("Aktif sekme bulunamadı. Normal bir web sayfası açıp tekrar deneyin.");
  }

  if (!isSupportedUrl(tab.url)) {
    throw new PageAccessError("Bu sayfa desteklenmiyor. MetaRadar normal HTTP ve HTTPS web sayfalarında çalışır.");
  }

  let injections;

  try {
    injections = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "ISOLATED",
      func: readPage,
    });
  } catch {
    throw new PageAccessError("Chrome bu sayfaya erişime izin vermedi veya sekme değişti. Web Store ve korumalı sayfalarda kontrol yapılamaz. Normal bir web sayfasında tekrar deneyin.");
  }

  const snapshot = injections.find((injection) => injection.frameId === 0)?.result;

  if (snapshot?.readError === "resource-limit") {
    throw new PageAccessError("Sayfadaki metadata veya element sayısı güvenli işleme sınırını aştı. Kısmi veya yanıltıcı sonuç göstermemek için kontrol durduruldu.");
  }

  if (!snapshot) {
    throw new PageAccessError("HTML sayfa verisi okunamadı. PDF ve diğer belge türleri desteklenmiyor.");
  }

  return snapshot;
}
