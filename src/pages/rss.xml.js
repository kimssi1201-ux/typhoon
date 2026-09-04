import { getCollection } from "astro:content";
import { SITE } from "../data/site.js";
import { sortPosts } from "../lib/content.js";

const escapeXml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function GET() {
  const posts = sortPosts(await getCollection("posts"));
  const items = posts
    .map((post) => {
      const data = post.data;
      const url = `${SITE.origin}/${data.slug}`;
      return [
        "<item>",
        `<title>${escapeXml(data.title)}</title>`,
        `<link>${url}</link>`,
        `<guid isPermaLink="true">${url}</guid>`,
        `<description>${escapeXml(data.description)}</description>`,
        `<category>${escapeXml(data.category)}</category>`,
        `<pubDate>${new Date(data.datePublished).toUTCString()}</pubDate>`,
        "</item>"
      ].join("");
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${SITE.name}</title><link>${SITE.origin}/</link><description>공식 자료를 기준으로 정부지원금 신청 정보를 정리하는 블로그</description><language>ko-KR</language><atom:link href="${SITE.origin}/rss.xml" rel="self" type="application/rss+xml" />${items}</channel></rss>\n`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8"
    }
  });
}
