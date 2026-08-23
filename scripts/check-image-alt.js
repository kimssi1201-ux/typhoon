import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const files = (await readdir(root)).filter((file) => extname(file) === ".html");
const warnings = [];

for (const file of files) {
  const html = await readFile(join(root, file), "utf8");
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const alt = tag.match(/\salt=(["'])(.*?)\1/i);
    if (!alt || !alt[2].trim()) {
      warnings.push(`${file}: image tag needs non-empty alt text`);
    }
  }
}

for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}
