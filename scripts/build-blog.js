// scripts/build-blog.js
//
// What this does, in plain language:
// 1. Reads every .md (Markdown) file inside content/posts
// 2. Reads the little info-card at the top of each file (the "frontmatter":
//    title, date, excerpt, keywords, image, video)
// 3. Turns the article text into real HTML
// 4. Writes a finished, ready-to-read HTML page for each post into
//    public/blog/<post-name>/index.html
// 5. Writes a listing page into public/blog/index.html that shows all posts
// 6. Writes a sitemap.xml so Google knows every blog page exists
//
// These files land inside "public" because Vite automatically copies
// anything in "public" straight into the final "dist" folder untouched.
// That means these blog pages become real, plain HTML files on the live
// site — no JavaScript required for Google (or WhatsApp, or Bing) to read
// the title, description, and keywords.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "content", "posts");
const OUTPUT_DIR = path.join(ROOT, "public", "blog");

// Change this if the site's real, live web address is ever different.
const SITE_URL = "https://djtony.qa";
const SITE_NAME = "Tony Schwery";
const DEFAULT_IMAGE = "/images/TONY SCHWERY EFFECT 1-MAIN-DESKTOP.jpg";

// ---------- Small helper: read the frontmatter "info card" ----------
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: raw };
  }
  const [, frontmatterBlock, content] = match;
  const data = {};

  frontmatterBlock.split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (value.startsWith("[") && value.endsWith("]")) {
      // A list, like: ["DJ Doha", "Qatar nightlife"]
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      // A plain quoted or unquoted value
      value = value.replace(/^["']|["']$/g, "");
    }

    data[key] = value;
  });

  return { data, content };
}

function slugify(filename) {
  return filename
    .replace(/\.md$/, "")
    // strip a leading date like "2026-07-28-" if present
    .replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function videoEmbedHtml(video) {
  if (!video) return "";
  // Accepts a full YouTube URL and turns it into an embedded player.
  const idMatch = video.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/
  );
  if (!idMatch) return "";
  const videoId = idMatch[1];
  return `<div class="video-wrapper">
  <iframe
    src="https://www.youtube.com/embed/${videoId}"
    title="Video"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
    loading="lazy">
  </iframe>
</div>`;
}

// ---------- The HTML "shell" every page is wrapped in ----------
function pageShell({ title, description, keywords, url, image, bodyHtml }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="keywords" content="${escapeHtml(keywords)}" />
<meta name="author" content="${SITE_NAME}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${url}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />

<meta property="og:type" content="article" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${image}" />
<meta property="og:url" content="${url}" />

<meta property="twitter:card" content="summary_large_image" />
<meta property="twitter:title" content="${escapeHtml(title)}" />
<meta property="twitter:description" content="${escapeHtml(description)}" />
<meta property="twitter:image" content="${image}" />

<link rel="stylesheet" href="/blog/blog.css" />
</head>
<body>
<nav class="blog-nav">
  <a href="/" class="blog-nav-logo">${SITE_NAME}</a>
  <a href="/blog/" class="blog-nav-link">Blog</a>
</nav>
<main class="blog-main">
${bodyHtml}
</main>
<footer class="blog-footer">
  <a href="/">&larr; Back to the main site</a>
</footer>
</body>
</html>
`;
}

// ---------- A simple stylesheet, matching the main site's look ----------
const BLOG_CSS = `
:root {
  --bg-color: #0b0c10;
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --accent-color: #fff200;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg-color);
  color: var(--text-primary);
  font-family: 'Outfit', Arial, sans-serif;
  line-height: 1.7;
}
a { color: var(--accent-color); text-decoration: none; }
.blog-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 2rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.blog-nav-logo { font-weight: 800; font-size: 1.1rem; color: var(--text-primary); }
.blog-nav-link { font-weight: 600; }
.blog-main {
  max-width: 800px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
}
.blog-footer {
  text-align: center;
  padding: 2rem 1rem 3rem;
  color: var(--text-secondary);
}
h1 { font-size: 2rem; margin-bottom: 0.25rem; }
.post-meta { color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem; }
.post-image { width: 100%; border-radius: 12px; margin-bottom: 1.5rem; }
.video-wrapper { position: relative; padding-bottom: 56.25%; height: 0; margin: 1.5rem 0; border-radius: 12px; overflow: hidden; }
.video-wrapper iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }

.post-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}
.post-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  overflow: hidden;
  display: block;
  transition: transform 0.15s ease;
}
.post-card:hover { transform: translateY(-4px); }
.post-card img { width: 100%; height: 160px; object-fit: cover; }
.post-card-body { padding: 1rem; }
.post-card-title { font-weight: 800; font-size: 1.05rem; margin-bottom: 0.4rem; color: var(--text-primary); }
.post-card-excerpt { color: var(--text-secondary); font-size: 0.9rem; }
`;

// ---------- Main build ----------
function build() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`No posts folder found at ${POSTS_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, "blog.css"), BLOG_CSS.trim());

  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse(); // newest-dated filenames first

  const posts = [];

  for (const filename of files) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, filename), "utf-8");
    const { data, content } = parseFrontmatter(raw);
    const slug = slugify(filename);

    const title = data.title || slug;
    const date = data.date || "";
    const excerpt = data.excerpt || "";
    const keywords = Array.isArray(data.keywords)
      ? data.keywords.join(", ")
      : data.keywords || "";
    const image = data.image || DEFAULT_IMAGE;
    const video = data.video || "";
    const url = `${SITE_URL}/blog/${slug}/`;

    const bodyHtml = marked.parse(content);

    const postHtml = pageShell({
      title: `${title} | ${SITE_NAME} Blog`,
      description: excerpt,
      keywords,
      url,
      image,
      bodyHtml: `
<article>
  <h1>${escapeHtml(title)}</h1>
  <p class="post-meta">${escapeHtml(date)}</p>
  ${image ? `<img class="post-image" src="${image}" alt="${escapeHtml(title)}" />` : ""}
  ${videoEmbedHtml(video)}
  ${bodyHtml}
</article>`,
    });

    const postDir = path.join(OUTPUT_DIR, slug);
    fs.mkdirSync(postDir, { recursive: true });
    fs.writeFileSync(path.join(postDir, "index.html"), postHtml);

    posts.push({ slug, title, date, excerpt, image, url });
    console.log(`Built post: /blog/${slug}/`);
  }

  // ---- Listing page ----
  const cardsHtml = posts
    .map(
      (p) => `
  <a class="post-card" href="/blog/${p.slug}/">
    <img src="${p.image}" alt="${escapeHtml(p.title)}" loading="lazy" />
    <div class="post-card-body">
      <div class="post-card-title">${escapeHtml(p.title)}</div>
      <div class="post-card-excerpt">${escapeHtml(p.excerpt)}</div>
    </div>
  </a>`
    )
    .join("\n");

  const listingHtml = pageShell({
    title: `Blog | ${SITE_NAME}`,
    description: `News, mixes, and stories from ${SITE_NAME} — Lebanese DJ, VJ, and producer in Doha, Qatar.`,
    keywords: "DJ Doha, Tony Schwery, Qatar nightlife, Lebanese DJ",
    url: `${SITE_URL}/blog/`,
    image: DEFAULT_IMAGE,
    bodyHtml: `<h1>Blog</h1><div class="post-grid">${cardsHtml}</div>`,
  });

  fs.writeFileSync(path.join(OUTPUT_DIR, "index.html"), listingHtml);
  console.log("Built listing page: /blog/");

  // ---- Sitemap ----
  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/blog/`,
    ...posts.map((p) => p.url),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, "public", "sitemap.xml"), sitemap);
  console.log("Built sitemap.xml");

  console.log(`\nDone. ${posts.length} post(s) built.`);
}

build();
