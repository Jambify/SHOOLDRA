// scripts/prerender.mjs
import { chromium } from "playwright";
import chromiumBinary from "@sparticuz/chromium";
import { preview } from "vite";
import fs from "node:fs";
import path from "node:path";

const ALL_SUBJECTS = [
  "Biology", "Chemistry", "Commerce", "CRS", "Economics", "English",
  "Geography", "Government", "History", "IRS", "Literature",
  "Mathematics", "Physics",
];

// "/" is the ONLY route needing bot-vs-human differentiation via rewrite.
// /signin and /signup were dropped from this system: Google renders them
// fine via headless Chromium regardless, and no one shares sign-in links
// for a preview card. Removing them removes two more places this exact
// class of bug (static-file-shadows-rewrite) could recur.
const CRITICAL_ROUTES = ["/"];

const OTHER_ROUTES = [
  "/about", // founder/entity page — must be a physical prerendered file so
  // non-JS-executing crawlers (LinkedIn, X, most SEO bots) see the founder
  // bio + structured data instead of the bare SPA shell.
  "/guest",
  "/guest/quiz",
  "/guest/mock",
  "/guest/past-questions",
  ...ALL_SUBJECTS.map((s) => `/guest/past-questions/${s.toLowerCase()}`),
  "/guest/privacy-policy",
  "/guest/terms-of-service",
];

const routes = [...CRITICAL_ROUTES, ...OTHER_ROUTES];

// Moves og:*/twitter:* meta tags to immediately after <meta name="description">
// instead of leaving them wherever react-helmet-async appended them (near the
// END of <head>, after all asset links — confirmed at ~byte 6500 of a 42KB+
// file). Facebook's crawler sometimes sends Range: bytes=0-5000, which can
// truncate the response before reaching tags that far down. Moving them up
// front makes them survive a Range-limited fetch.
function hoistSocialTagsEarly(html) {
  const socialTagPattern = /<meta\s+(?:property|name)=["'](?:og:|twitter:)[^"']*["'][^>]*>\s*/gi;
  const socialTags = html.match(socialTagPattern);
  if (!socialTags || socialTags.length === 0) return html;

  let stripped = html.replace(socialTagPattern, "");

  const descriptionAnchor = /<meta\s+name=["']description["'][^>]*>\s*/i;
  if (descriptionAnchor.test(stripped)) {
    return stripped.replace(
      descriptionAnchor,
      (match) => match + socialTags.join("")
    );
  }

  // Fallback: no description tag found — insert right after <title>.
  const titleAnchor = /<\/title>\s*/i;
  return stripped.replace(titleAnchor, (match) => match + socialTags.join(""));
}

async function main() {
  console.log("Starting local preview server of dist/ ...");
  const server = await preview({ preview: { port: 4173 } });
  const base = "http://localhost:4173";

  const pristineIndex = path.join("dist", "index.html");
  const appShell = path.join("dist", "app.html");
  fs.copyFileSync(pristineIndex, appShell);
  console.log(`Preserved pristine SPA shell → ${appShell}`);

  console.log("Launching headless browser...");
  const browser = await chromium.launch(
    process.env.VERCEL
      ? {
          args: chromiumBinary.args,
          executablePath: await chromiumBinary.executablePath(),
          headless: true,
        }
      : {
          ...(process.env.USE_SYSTEM_CHROME ? { channel: "chrome" } : {}),
          headless: true,
        }
  );

  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("fonts.googleapis.com") && text.includes("MIME type")) return;
    if (msg.type() === "error") {
      console.log(`  [browser console error] ${text}`);
    } else {
      console.log(`  [browser console] ${msg.type()}: ${text}`);
    }
  });

  page.on("pageerror", (err) => {
    console.log(`  [browser uncaught error] ${err.message}`);
  });

  // Track per-route outcome instead of letting one failure kill the whole
  // run — a prior run died on /guest/past-questions/history mid-list and
  // silently skipped "/" entirely because it came last in the array.
  const results = { succeeded: [], failed: [] };

  for (const route of routes) {
    const url = `${base}${route}`;
    console.log(`Rendering ${url} ...`);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

      console.log(`  [title right after load] ${await page.title()}`);

      if (route.startsWith("/guest/past-questions")) {
        try {
          await page.waitForSelector(
            '[data-testid="question-card"], [data-testid="no-results"]',
            { timeout: 15000 }
          );
        } catch {
          console.log(`  ⚠ Timed out waiting for question content on ${route} — saving whatever rendered.`);
        }
      } else {
        await page.waitForTimeout(600);
      }

      console.log(`  [title after wait] ${await page.title()}`);

      const html = await page.content();

      const titleMatches = [...html.matchAll(/<title>.*?<\/title>/gs)];
      const cleanedHtml =
        titleMatches.length > 1
          ? titleMatches.slice(1).reduce((acc, m) => acc.replace(m[0], ""), html)
          : html;

      const liveTitle = await page.title();
      const escapedLiveTitle = liveTitle
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      if (titleMatches.length > 0 && !cleanedHtml.includes(`<title>${escapedLiveTitle}</title>`)) {
        console.log(`  ⚠ MISMATCH on ${route}: kept title doesn't match live page.title() ("${liveTitle}").`);
      }

      const finalHtml = hoistSocialTagsEarly(cleanedHtml);

      // Only "/" needs the special dance of writing into dist/seo/ AND
      // deleting the physical root index.html afterward (see below) — that
      // deletion is what actually lets Vercel's "has: user-agent" rewrite
      // for "/" get evaluated at all, since Vercel serves an exact-matching
      // physical file before it ever consults rewrites.
      const isCritical = CRITICAL_ROUTES.includes(route);
      const outDir = isCritical
        ? path.join("dist", "seo")
        : path.join("dist", route.replace(/^\//, ""));
      const outFile = isCritical ? "home.html" : "index.html";

      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, outFile), finalHtml);

      console.log(`  → saved to ${path.join(outDir, outFile)}`);
      results.succeeded.push(route);
    } catch (err) {
      console.log(`  ✗ FAILED to render ${route}: ${err.message}`);
      results.failed.push(route);
    }
  }

  await context.close();
  await browser.close();
  await server.httpServer.close();

  // The one step that actually fixes the shadowing bug: remove the physical
  // root index.html so nothing sits at the literal "/" path for Vercel's
  // static-file lookup to match before rewrites run. app.html (copied above)
  // is now the only copy of the SPA shell, served via the catch-all rewrite.
  if (results.succeeded.includes("/")) {
    fs.unlinkSync(pristineIndex);
    console.log(`Removed ${pristineIndex} — "/" now has no physical file, so Vercel's crawler-UA rewrite to /seo/home.html can actually be evaluated.`);
  } else {
    console.log(`⚠ Skipped deleting ${pristineIndex} because "/" failed to prerender — deleting it now would leave "/" with NO file at all for anyone.`);
  }

  console.log("\n── Prerender summary ──");
  console.log(`Succeeded (${results.succeeded.length}):`, results.succeeded.join(", "));
  if (results.failed.length > 0) {
    console.log(`Failed (${results.failed.length}):`, results.failed.join(", "));
  }

  const criticalFailures = results.failed.filter((r) => CRITICAL_ROUTES.includes(r));
  if (criticalFailures.length > 0) {
    console.error(`\n✗ Critical route(s) failed to prerender: ${criticalFailures.join(", ")}. Failing the build.`);
    process.exit(1);
  }

  console.log("Prerendering complete.");
}

main().catch((err) => {
  console.error("Prerender script failed:", err);
  process.exit(1);
});
