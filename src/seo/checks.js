import { RESULT_STATUS, SEO_CONFIG } from "./config.js";

function createResult(id, status, title, value, message) {
  return { id, status, title, value, message };
}

function checkTitle(page) {
  return createResult(
    "title-presence",
    page.title ? RESULT_STATUS.PASSED : RESULT_STATUS.ERROR,
    "Page title",
    page.title,
    page.title ? "Page title mevcut." : "Page title bulunamadı veya boş.",
  );
}

function checkDescription(page) {
  return createResult(
    "description-presence",
    page.description ? RESULT_STATUS.PASSED : RESULT_STATUS.WARNING,
    "Meta description",
    page.description,
    page.description
      ? "Meta description mevcut."
      : "Meta description bulunamadı veya boş. Arama motorları sayfa içeriğinden bir açıklama oluşturabilir.",
  );
}

function checkRobots(page) {
  const title = "Meta robots";
  const value = page.robotsContents.join(" | ");

  if (page.robotsContents.length === 0) {
    return createResult("meta-robots", RESULT_STATUS.WARNING, title, "", "Meta robots etiketi bulunamadı. Bu kontrol, sayfanın indekslenebileceğini tek başına doğrulamaz.");
  }

  if (page.robotsContents.every((content) => !content)) {
    return createResult("meta-robots", RESULT_STATUS.WARNING, title, "", "Meta robots etiketi boş. İndeksleme yönergeleri açıkça belirtilmemiş.");
  }

  if (page.robotsDirectives.some((directive) => ["noindex", "none"].includes(directive))) {
    return createResult("meta-robots", RESULT_STATUS.WARNING, title, value, "Meta robots noindex veya none yönergesi içeriyor. Bu, arama motorlarının sayfayı indekslemesini engelleyebilir; yönergenin amaçlandığını kontrol edin.");
  }

  return createResult("meta-robots", RESULT_STATUS.PASSED, title, value, "Meta robots içinde noindex veya none yönergesi bulunamadı. Bu kontrol indekslenmeyi veya başka robots yönergelerinin etkisini doğrulamaz.");
}

function checkHtmlLang(page) {
  const { value, isValid } = page.htmlLang;

  if (!value) {
    return createResult("html-lang", RESULT_STATUS.WARNING, "HTML lang", "", "HTML lang attribute bulunamadı veya boş. Belge dili açıkça tanımlanmamış.");
  }

  if (!isValid) {
    return createResult("html-lang", RESULT_STATUS.ERROR, "HTML lang", value, `HTML lang değeri "${value}" geçerli bir BCP 47 dil etiketi biçiminde görünmüyor. Yazımını kontrol edin.`);
  }

  return createResult("html-lang", RESULT_STATUS.PASSED, "HTML lang", value, `HTML lang değeri "${value}" geçerli bir dil etiketi biçiminde görünüyor. Sayfa içeriğinin dili ayrıca doğrulanmadı.`);
}

function checkImageAlt(page) {
  const title = "Image alt attributes";

  if (page.imageCount === 0) {
    return createResult("image-alt", RESULT_STATUS.PASSED, title, 0, "Sayfada incelenecek img elementi bulunamadı.");
  }

  if (page.missingAltCount > 0) {
    return createResult(
      "image-alt",
      RESULT_STATUS.WARNING,
      title,
      page.imageCount,
      `${page.missingAltCount} görselde alt attribute bulunamadı (${page.imageCount} görsel incelendi). Bu görsellerin anlamlı içerik taşıyıp taşımadığını kontrol edin.`,
    );
  }

  return createResult(
    "image-alt",
    RESULT_STATUS.PASSED,
    title,
    page.imageCount,
    `Tüm ${page.imageCount} görselde alt attribute mevcut. Boş alt değerleri dekoratif görseller için bilinçli olarak kullanılmış olabilir.`,
  );
}

function checkOpenGraphTag(id, title, tag, socialPreviewLabel) {
  const { isPresent, value } = tag;

  if (value) {
    return createResult(id, RESULT_STATUS.PASSED, title, value, `${title} mevcut.`);
  }

  const message = isPresent
    ? `${title} content değeri boş. Sosyal platformlardaki paylaşım ${socialPreviewLabel} için kontrol edebilirsiniz.`
    : `${title} bulunamadı. Sosyal platformlardaki paylaşım ${socialPreviewLabel} için kontrol edebilirsiniz.`;

  return createResult(id, RESULT_STATUS.WARNING, title, value, message);
}

function checkOgTitle(page) {
  return checkOpenGraphTag("og-title", "og:title", page.ogTitle, "başlığı");
}

function checkOgDescription(page) {
  return checkOpenGraphTag("og-description", "og:description", page.ogDescription, "açıklaması");
}

function checkOgImage(page) {
  const { isPresent, value } = page.ogImage;

  if (value) {
    return createResult("og-image", RESULT_STATUS.PASSED, "og:image", value, "og:image mevcut.");
  }

  return createResult(
    "og-image",
    RESULT_STATUS.WARNING,
    "og:image",
    "",
    isPresent
      ? "og:image content değeri boş. Sosyal platformlardaki paylaşım görselini kontrol edebilirsiniz."
      : "og:image bulunamadı. Sosyal platformlardaki paylaşım görseli için kontrol edebilirsiniz.",
  );
}

function checkTextLength(id, title, text, length, warningLength, label) {
  if (!text) {
    return [];
  }

  const isLong = length > warningLength;

  return createResult(
    id,
    isLong ? RESULT_STATUS.WARNING : RESULT_STATUS.PASSED,
    title,
    length,
    isLong
      ? `${label} ${length} karakter. Arama sonuçlarında tamamı görüntülenmeyebilir.`
      : `${label} ${length} karakter. Yapılandırılmış uzunluk uyarısı eşiği aşılmadı; arama sonuçlarında görünüm değişebilir.`,
  );
}

function checkTitleLength(page) {
  return checkTextLength("title-length", "Title length", page.title, page.titleLength, SEO_CONFIG.titleWarningLength, "Title");
}

function checkDescriptionLength(page) {
  return checkTextLength("description-length", "Description length", page.description, page.descriptionLength, SEO_CONFIG.descriptionWarningLength, "Meta description");
}

function checkH1(page) {
  const count = page.h1Texts.length;
  let message = "H1 bulunamadı. Ana başlığın yapısını gözden geçirin.";

  if (count > SEO_CONFIG.recommendedH1Count) {
    message = `${count} H1 mevcut. Başlık hiyerarşisini gözden geçirin; birden fazla H1 tek başına sıralama sorunu anlamına gelmez.`;
  } else if (count === SEO_CONFIG.recommendedH1Count) {
    message = page.h1Texts[0] ? "Bir H1 mevcut." : "Bir H1 mevcut ancak metni boş. Başlığı gözden geçirin.";
  }

  const hasSingleNonemptyHeading = count === SEO_CONFIG.recommendedH1Count && Boolean(page.h1Texts[0]);

  return createResult("h1-count", hasSingleNonemptyHeading ? RESULT_STATUS.PASSED : RESULT_STATUS.WARNING, "H1 headings", count, message);
}

function checkCanonical(page) {
  const title = "Canonical URL";

  if (page.canonicals.length === 0) {
    return createResult("canonical", RESULT_STATUS.WARNING, title, "", "Canonical URL bulunamadı. Yinelenen URL'ler varsa tercih edilen adresi belirtmeyi değerlendirin.");
  }

  if (page.canonicals.some((canonical) => !canonical.isValid)) {
    return createResult("canonical", RESULT_STATUS.ERROR, title, page.canonicals.map((canonical) => canonical.href), "Canonical etiketi boş veya geçerli bir HTTP/HTTPS URL'sine çözümlenemiyor.");
  }

  const urls = page.canonicals.map((canonical) => canonical.url);

  if (urls.length > 1) {
    return createResult("canonical", RESULT_STATUS.WARNING, title, urls, "Birden fazla canonical etiketi mevcut. Tercih edilen adresin tutarlı olduğunu kontrol edin.");
  }

  return createResult("canonical", RESULT_STATUS.PASSED, title, urls[0], "Canonical URL mevcut. Hedefin erişilebilirliği ve arama motorlarının seçimi doğrulanmadı.");
}

function findDuplicateHreflang(languages) {
  const seenLanguages = new Set();

  for (const language of languages) {
    const normalizedLanguage = language.toLowerCase();
    if (seenLanguages.has(normalizedLanguage)) {
      return language;
    }
    seenLanguages.add(normalizedLanguage);
  }

  return "";
}

function checkHreflang(page) {
  const links = page.hreflangLinks;
  const title = "Hreflang";

  if (links.length === 0) {
    return createResult(
      "hreflang",
      RESULT_STATUS.PASSED,
      title,
      0,
      "Hreflang etiketi bulunamadı. Bu yalnızca çok dilli veya bölgesel sayfalarda gerekli olabilir.",
    );
  }

  const issues = [];
  const emptyLanguageCount = links.filter((link) => !link.language).length;
  const emptyHrefCount = links.filter((link) => !link.href).length;
  const duplicateLanguage = findDuplicateHreflang(links.map((link) => link.language).filter(Boolean));

  if (emptyLanguageCount > 0) {
    issues.push(`${emptyLanguageCount === 1 ? "Bir" : `${emptyLanguageCount}`} hreflang etiketi hreflang değeri olmadan tanımlanmış.`);
  }
  if (emptyHrefCount > 0) {
    issues.push(`${emptyHrefCount === 1 ? "Bir" : `${emptyHrefCount}`} hreflang etiketi href değeri olmadan tanımlanmış.`);
  }
  if (duplicateLanguage) {
    issues.push(`${duplicateLanguage} hreflang değeri birden fazla kez tanımlanmış. Yapılandırmayı kontrol edin.`);
  }

  const hasWarnings = issues.length > 0;
  const hasXDefault = links.some((link) => link.language.toLowerCase() === "x-default");
  const message = hasWarnings
    ? `${links.length} hreflang etiketi bulundu. ${issues.join(" ")}`
    : `${links.length} hreflang etiketi bulundu.${hasXDefault ? " x-default tanımı mevcut." : ""}`;

  return createResult(
    "hreflang",
    hasWarnings ? RESULT_STATUS.WARNING : RESULT_STATUS.PASSED,
    title,
    links.length,
    message,
  );
}

export const SEO_CHECKS = Object.freeze([
  checkTitle,
  checkTitleLength,
  checkDescription,
  checkDescriptionLength,
  checkRobots,
  checkHtmlLang,
  checkImageAlt,
  checkOgTitle,
  checkOgDescription,
  checkOgImage,
  checkH1,
  checkCanonical,
  checkHreflang,
]);
