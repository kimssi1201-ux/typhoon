import { spawnSync } from "node:child_process";

const files = [
  "housing-dashboard.js",
  "private-rental.js",
  "housing-support.js",
  "housing-region-codes.js",
  "housing-complexes.js",
  "family-facilities.js",
  "long-term-care.js",
  "holiday-parking.js",
  "policy-news.js",
  "functions/_middleware.js",
  "functions/api/myhome-notices.js",
  "functions/api/private-rental-notices.js",
  "functions/api/private-rental-competition.js",
  "functions/api/housing-notices.js",
  "functions/api/housing-complexes.js",
  "functions/api/housing-support.js",
  "functions/api/welfare-services.js",
  "functions/api/single-parent-facilities.js",
  "functions/api/long-term-care.js",
  "functions/api/long-term-care-detail.js",
  "functions/api/holiday-parking.js",
  "functions/api/policy-news.js",
  "functions/api/coupang-partners.js",
  "app.js",
  "dashboard.js",
  "global-cyclone-tracker.js",
  "beach-dashboard.js",
  "travel-dashboard.js",
  "functions/api/health.js",
  "functions/api/typhoon.js",
  "functions/api/typhoon-list.js",
  "functions/api/typhoon-detail.js",
  "functions/api/korea-typhoons.js",
  "functions/api/current-weather.js",
  "functions/api/global-cyclones.js",
  "functions/api/tourism.js",
  "functions/api/marine.js",
  "functions/api/kma-beach.js",
  "functions/api/oceans-beach.js",
  "blog.js",
  "support-search.js",
  "coupang-partners.js",
  "scripts/check-image-alt.js",
  "scripts/compare-astro-output.mjs",
  "scripts/extract-support-posts.mjs",
  "scripts/run-js-checks.mjs",
  "scripts/sync-astro-public.mjs",
  "scripts/validate-astro-output.mjs"
];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`checked ${files.length} JavaScript files`);
