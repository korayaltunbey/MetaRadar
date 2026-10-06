import { SEO_CHECKS } from "./checks.js";

export function evaluateSeo(page) {
  return SEO_CHECKS.flatMap((check) => check(page));
}
