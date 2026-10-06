import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname, relative } from "node:path";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, "MetaRadar");
assert.match(manifest.version, /^\d+\.\d+\.\d+$/u);
assert.equal(manifest.version, packageJson.version, "Manifest and package versions must match");
assert.ok(manifest.description.length <= 132, "Manifest description must fit the Chrome Web Store short description limit");
assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "scripting", "storage"].sort());
const expectedIcons = {
  16: "assets/icons/icon-16.png",
  32: "assets/icons/icon-32.png",
  48: "assets/icons/icon-48.png",
  128: "assets/icons/icon-128.png"
};
assert.deepEqual(manifest.icons, expectedIcons, "Manifest extension icons must use the checked-in PNG set");
assert.deepEqual(manifest.action.default_icon, expectedIcons, "Action icons must use the checked-in PNG set");
for (const [size, path] of Object.entries(expectedIcons)) {
  await checkLocalFile(root, path);
  const image = await readFile(resolve(root, path));
  assert.equal(image.toString("hex", 0, 8), "89504e470d0a1a0a", `Icon must be PNG: ${path}`);
  assert.equal(image.readUInt32BE(16), Number(size), `Icon width must be ${size}px: ${path}`);
  assert.equal(image.readUInt32BE(20), Number(size), `Icon height must be ${size}px: ${path}`);
}
for (const key of ["host_permissions", "optional_host_permissions", "optional_permissions", "background", "content_scripts", "web_accessible_resources", "externally_connectable", "sandbox"]) {
  assert.equal(manifest[key], undefined, `Unexpected manifest key: ${key}`);
}
assert.equal(manifest.content_security_policy.extension_pages, "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
assert.equal(Object.keys(packageJson.dependencies ?? {}).length, 0);
assert.equal(Object.keys(packageJson.devDependencies ?? {}).length, 0);
assert.deepEqual(packageJson.scripts, { test: "node --test", check: "node scripts/check-project.js" });

async function checkLocalFile(fromDirectory, path) {
  assert.ok(!/^(?:[a-z]+:|\/\/)/iu.test(path), `External asset: ${path}`);
  const absolutePath = resolve(fromDirectory, path);
  assert.ok(!relative(root, absolutePath).startsWith(".."), `Asset escapes project: ${path}`);
  await access(absolutePath);
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? listFiles(resolve(directory, entry.name))
    : resolve(directory, entry.name)));
  return nested.flat();
}

const popupPath = resolve(root, manifest.action.default_popup);
await checkLocalFile(root, manifest.action.default_popup);
const html = await readFile(popupPath, "utf8");
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/gu)) {
  await checkLocalFile(dirname(popupPath), match[1]);
}
assert.ok(!/<script\b(?![^>]*\bsrc=)/iu.test(html), "Inline scripts are not permitted");
assert.ok(!/\son\w+\s*=/iu.test(html), "Inline event handlers are not permitted");

const sourceFiles = await listFiles(resolve(root, "src"));
const developmentFiles = [...await listFiles(resolve(root, "tests")), ...await listFiles(resolve(root, "scripts"))];
for (const path of [...sourceFiles, ...developmentFiles].filter((path) => path.endsWith(".js"))) {
  execFileSync(process.execPath, ["--check", path], { stdio: "pipe" });
  if (!sourceFiles.includes(path)) continue;
  const source = await readFile(path, "utf8");
  for (const match of source.matchAll(/\bfrom\s+"([^"]+)"/gu)) {
    assert.ok(match[1].startsWith("."), `Non-local import: ${match[1]}`);
    await checkLocalFile(dirname(path), match[1]);
  }
  assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|eval|Function)\s*\(/u.test(source), `Unexpected network or dynamic execution API: ${path}`);
  assert.ok(!/\bimport\s*\(/u.test(source), `Unexpected dynamic import: ${path}`);
  assert.ok(!/\b(?:innerHTML|outerHTML|insertAdjacentHTML|DOMParser)\b|\bdocument\.(?:write|writeln)\s*\(/u.test(source), `Unsafe HTML sink: ${path}`);
  assert.ok(!/\bconsole\s*\./u.test(source), `Unexpected production logging: ${path}`);
  assert.ok(!/\b(?:sendMessage|onMessage|onMessageExternal|onConnectExternal|connect)\s*[.(]/u.test(source), `Unexpected messaging: ${path}`);
  assert.ok(!/\b(?:localStorage|sessionStorage|indexedDB)\b|chrome\.history\b/u.test(source), `Unexpected persistence API: ${path}`);
  if (/\bchrome\.storage\b/u.test(source)) {
    assert.equal(relative(root, path).replaceAll("\\", "/"), "src/popup/theme.js", "Storage access is limited to the theme module");
    assert.ok(!/\bchrome\.storage\.(?!local\b)/u.test(source), "Only chrome.storage.local is permitted");
    assert.equal([...source.matchAll(/\bchrome\.storage\.local\.(?:get|set)\(/gu)].length, 2, "Theme preferences use one read and one write call");
    assert.match(source, /const THEME_STORAGE_KEY = "themePreference"/u);
  }
}
const css = await readFile(resolve(root, "src/popup/popup.css"), "utf8");
assert.ok(!/@import\b|\burl\s*\(/iu.test(css), "Popup CSS must not load external resources");
for (const name of ["README.md", "docs/index.html", "docs/styles.css", "docs/privacy-policy.md", "docs/privacy-policy-tr.md"]) {
  await access(resolve(root, name));
}
console.log(`Project checks passed: Manifest V3, three permissions, theme-only local storage, local assets, no dependencies, syntax (${sourceFiles.length} source files).`);
