import { getCollection } from "astro:content";
import { SITE } from "../data/site.js";
import { archivePosts } from "../lib/content.js";

export async function GET() {
  const posts = archivePosts(await getCollection("posts"));
  const pages = await getCollection("pages");
  const paths = ["/", "/지원금", ...posts.map((post) => `/${post.data.slug}`), ...pages.map((page) => `/${page.data.slug}`)];
  const urls = paths
    .map((path) => `<url><loc>${SITE.origin}${path === "/" ? "/" : path}</loc></url>`)
    .join("");

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`, {
    headers: {
      "content-type": "application/xml; charset=utf-8"
    }
  });
}
