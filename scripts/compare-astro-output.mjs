import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");

const readJsonDir = async (dir) => {
  const files = (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(join(dir, file), "utf8"))));
};

const routeHtmlPath = (route) => {
  if (route === "/") return "index.html";
  return `${route.replace(/^\/|\/$/g, "")}.html`;
};

const field = {
  title: (html) => html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "",
  description: (html) => html.match(/<meta\s+name=(["'])description\1\s+content=(["'])([\s\S]*?)\2/i)?.[3] || "",
  canonical: (html) => html.match(/<link\s+rel=(["'])canonical\1\s+href=(["'])([\s\S]*?)\2/i)?.[3] || "",
  h1: (html) => html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || ""
};

const visibleText = (html = "") =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const sorted = (value) => {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  }
  return value;
};

const schemas = (html) => {
  const found = [];
  for (const match of html.matchAll(/<script\s+type=(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)) {
    const parsed = JSON.parse(match[2]);
    if (Array.isArray(parsed["@graph"])) found.push(...parsed["@graph"]);
    else found.push(parsed);
  }
  return sorted(found);
};

const comparePage = (sourceHtml, generatedHtml, label, options = {}) => {
  const { compareBody = false, compareH1 = true } = options;
  for (const key of ["title", "description", "canonical", "h1"]) {
    if (key === "h1" && !compareH1) continue;
    assert.equal(field[key](generatedHtml), field[key](sourceHtml), `${label} ${key} changed`);
  }
  assert.deepEqual(schemas(generatedHtml), schemas(sourceHtml), `${label} JSON-LD changed`);
  if (compareBody) {
    const sourceArticle = sourceHtml.match(/<section\s+class=(["'])article-content\1[\s\S]*?<\/section>/i)?.[0] || "";
    const sourceBody = visibleText(sourceArticle.replace(/<aside\s+class=(["'])key-facts\1[\s\S]*?<\/aside>/i, ""));
    const generatedArticle = generatedHtml.match(/<article\s+class=(["'])content-area single-post hentry\1[\s\S]*?<\/article>/i)?.[0] || generatedHtml;
    const generatedBody = visibleText(generatedArticle);
    const fragments = sourceBody
      .split(/(?<=다\.)\s+|(?<=요\.)\s+|(?<=니다\.)\s+/)
      .map((fragment) => fragment.trim())
      .filter((fragment) => fragment.length >= 28)
      .slice(0, 80);
    for (const fragment of fragments) {
      assert.match(generatedBody, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${label} keeps body text: ${fragment.slice(0, 30)}`);
    }
  }
};

const posts = await readJsonDir(join(root, "src", "content", "posts"));
const pages = await readJsonDir(join(root, "src", "content", "pages"));

comparePage(
  await readFile(join(root, "index.html"), "utf8"),
  await readFile(join(dist, "index.html"), "utf8"),
  "home",
  { compareH1: false }
);
comparePage(
  await readFile(join(root, "support-archive.page"), "utf8"),
  await readFile(join(dist, routeHtmlPath("/지원금")), "utf8"),
  "support archive",
  { compareH1: false }
);

for (const post of posts) {
  comparePage(
    await readFile(join(root, post.sourceFile), "utf8"),
    await readFile(join(dist, routeHtmlPath(`/${post.slug}`)), "utf8"),
    post.slug,
    { compareBody: true }
  );
}

for (const page of pages) {
  comparePage(
    await readFile(join(root, page.sourceFile), "utf8"),
    await readFile(join(dist, routeHtmlPath(`/${page.slug}`)), "utf8"),
    page.slug,
    { compareBody: true }
  );
}

console.log(`compared legacy HTML with Astro output for ${posts.length + pages.length + 2} routes`);
