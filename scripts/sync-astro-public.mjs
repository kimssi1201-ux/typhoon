import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(root, "public");
const postsDir = join(root, "src", "content", "posts");
const pagesDir = join(root, "src", "content", "pages");

const copyFiles = [
  "404.html",
  "ads.txt",
  "blog.css",
  "blog.js",
  "CNAME",
  "coupang-partners.js",
  "robots.txt",
  "support-search.js",
  "_headers"
];

const readJsonFiles = async (dir) => {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(
    files.map(async (file) => JSON.parse(await readFile(join(dir, file), "utf8")))
  );
};

const uniqueLines = (lines) => {
  const seen = new Set();
  return lines.filter((line) => {
    const key = line.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

await mkdir(publicDir, { recursive: true });

for (const file of copyFiles) {
  const source = join(root, file);
  if (existsSync(source)) {
    await cp(source, join(publicDir, basename(file)), { force: true });
  }
}

if (existsSync(join(root, "assets"))) {
  await cp(join(root, "assets"), join(publicDir, "assets"), {
    recursive: true,
    force: true
  });
}

const redirects = existsSync(join(root, "_redirects"))
  ? await readFile(join(root, "_redirects"), "utf8")
  : "";
const posts = await readJsonFiles(postsDir);
const pages = await readJsonFiles(pagesDir);

const canonicalRedirects = [
  "/지원금.html /지원금 301",
  "/support /지원금 301",
  "/support/ /지원금 301",
  "/support.html /지원금 301",
  ...posts.map((post) => `/${post.slug}.html /${post.slug} 301`),
  ...pages.map((page) => `/${page.slug}.html /${page.slug} 301`)
];

const output = [
  redirects.trimEnd(),
  "",
  "# Astro canonical routes",
  ...uniqueLines(canonicalRedirects)
].join("\n");

await writeFile(join(publicDir, "_redirects"), `${output}\n`);

console.log(`synced public assets and ${canonicalRedirects.length} Astro redirects`);
