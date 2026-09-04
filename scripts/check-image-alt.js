import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const files = (await readdir(root)).filter((file) => extname(file) === ".html");
const warnings = [];

const checkHtml = (label, html) => {
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const alt = tag.match(/\salt=(["'])(.*?)\1/i);
    if (!alt || !alt[2].trim()) {
      warnings.push(`${label}: image tag needs non-empty alt text`);
    }
  }
};

for (const file of files) {
  checkHtml(file, await readFile(join(root, file), "utf8"));
}

for (const dir of [join(root, "src", "content", "posts"), join(root, "src", "content", "pages")]) {
  if (!existsSync(dir)) continue;
  const contentFiles = (await readdir(dir)).filter((file) => file.endsWith(".json"));
  for (const file of contentFiles) {
    const data = JSON.parse(await readFile(join(dir, file), "utf8"));
    checkHtml(file, [data.bodyHtml, data.officialSourcesHtml, data.mainInnerHtml].filter(Boolean).join("\n"));
  }
}

for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}
