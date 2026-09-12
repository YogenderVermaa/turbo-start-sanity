# Project Evaluation & Architecture Notes

**Production Web URL:** https://robotostudio.vercel.app  
**Sanity Studio URL:** https://yogi-turbo-sanity.sanity.studio  
**Algolia Application ID:** QWFA8XWS6M  
**Algolia Index Name:** blogs  
**Algolia Search-Only Key:** fe5a4f0bcfb60dfde797697f60609839  

---

## 1. What I Built and Why

### Task 1: Newsletter Signup (`/api/newsletter`)
- **Schema & Storage:** Created a `subscriber` document type in Sanity Studio recording the subscriber's email, subscription ISO timestamp (`subscribedAt`), and status (`active`).
- **Idempotency:** Generated a deterministic document ID from a SHA-256 hash of the normalized email (`subscriber-${sha256(email)}`) and used `createIfNotExists` to guarantee that duplicate submissions update in place and never create duplicate entries.
- **Input & Format Handling:** Validated emails using Zod and supported both `application/json` and `application/x-www-form-urlencoded` / `multipart/form-data` payloads so browser form posts and programmatic requests work interchangeably.
- **Rate Limiting:** Implemented a sliding window in-memory rate limiter in [`apps/web/src/lib/rate-limit.ts`](file:///c:/Users/yogen/Desktop/New%20folder/turbo-start-sanity/apps/web/src/lib/rate-limit.ts) capped at **5 requests per 60 seconds per IP** with `429 Too Many Requests` and `Retry-After` headers to protect against spam submissions.
- **UI Integration:** Wired the `SubscribeNewsletter` block in `packages/sanity-blocks/src/subscribe-newsletter` with optimistic loading states, accessible feedback badges, and inline error handling.

### Task 2: Algolia Search & Synchronization Pipeline
- **Search Sync Webhook (`/api/search-sync`):**
  - **Fail-Closed Security:** Authenticates incoming webhooks with constant-time buffer comparison (`crypto.timingSafeEqual`) against `SANITY_SEARCH_SYNC_SECRET` to prevent timing attacks.
  - **Draft Isolation:** Explicitly ignores documents with `_id` starting with `drafts.`, ensuring unpublished drafts never leak to public search results.
  - **Deletions & SEO Suppression:** When `_deleted: true` or `seoNoIndex: true`, the document is automatically pruned from Algolia using its canonical ID (`_id.replace(/^drafts\./, "")`).
  - **Content Filtering:** Safely skips non-blog content types without throwing errors.
- **Code-Based Index Settings & Backfill (`/api/search/backfill`):**
  - Programmatically defines and enforces Algolia index settings in code (`searchableAttributes: ["title", "description", "category", "authors"]`, `attributesForFaceting: ["filterOnly(category)", "filterOnly(authors)"]`, and `customRanking: ["desc(publishedAt)"]`).
  - Populates the index from published Sanity blogs and is completely safe to run repeatedly.
- **Public Search API (`/api/blog/search`):**
  - Uses the public search-only Algolia key, keeping admin keys strictly on the server.
  - Supports full-text queries (`q`), pagination (`page`, `hitsPerPage`), and `category` faceting.
  - Bounded input lengths (`q` capped at 100 characters, `page` capped at 50) and rate limited to **60 requests per minute per IP** in `apps/web/src/lib/rate-limit.ts`.
  - Cached at the edge with `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.

### Task 3: Sanity Studio SEO & Search Index Inspector (`apps/studio/components/seo-and-index-view.tsx`)
- Added a read-only **"SEO & Index"** tab to `blog` and `page` document structure in Studio.
- **Live SERP Preview:** Subscribed directly to `props.document.displayed` so meta titles, URLs, and descriptions update in real-time as the editor types without requiring save or publish actions.
- **Validation Checks & Length Justifications:**
  - **Meta Description (140-160 chars):** Exactly aligns with the opinion and validation rules configured in the `blog` schema (`apps/studio/schemaTypes/documents/blog.ts`).
  - **Meta Title (30-60 chars):** Since the schema enforces no length bounds on titles, we enforce a 30-60 character standard justified by modern Google SERP display width (~600px desktop / ~550px mobile) where titles longer than 60 characters are truncated with an ellipsis.
  - **Images & Robots:** Verifies image presence (`image`, `seoImage`) and flags pages where `seoNoIndex` is enabled.
- **Live Algolia Discrepancy Detection:** Queries Algolia with the search-only key to compare the document's current live index status against its Sanity state, immediately alerting editors if a published post is missing from search or if a `noIndex` post is inadvertently present.
- **Algolia Outage Strategy:** When Algolia encounters downtime or connectivity issues, `/api/blog/search` catches the error, logs it securely to server structured logs, and returns a clean `503 Service Unavailable` (`{"error": "Search service temporarily unavailable"}`). The frontend search component gracefully handles this with a non-blocking error badge while the main blog listing and category navigation (rendered from Sanity) continue functioning without interruption.

---

## 2. What I Noticed (Codebase Observations & Feedback)

1. **Turbopack PostCSS Sandboxing & Monorepo Package Scanning:**
   - In Next.js 16 with Turbopack, dynamic Tailwind v4 source scanning through PostCSS inside workspace subdirectories (`apps/web`) is sandboxed from traversing parent directories (`packages/ui`, `packages/sanity-blocks`). Introducing a dedicated `@tailwindcss/cli` prebuild step (`pnpm prebuild`) that compiles the full 128 KB Tailwind utility stylesheet deterministically before `next build` guarantees reliable production deployments on Linux/Vercel environments.
2. **Relative File Paths in Turbopack CSS Imports:**
   - Turbopack inside Next.js rejects bare module specifiers in CSS (e.g. `@import "tw-animate-css";`). Referencing the exact distributed stylesheet file path (`../../node_modules/tw-animate-css/dist/tw-animate.css`) resolves the dependency cleanly across monorepo workspace packages.
3. **Draft Mutation Invocations in Sanity Webhooks:**
   - Sanity webhooks trigger on both draft and published transactions. While the `/api/search-sync` endpoint safely skips drafts via `_id.startsWith("drafts.")`, configuring the webhook filter directly in Sanity Manage (`!(_id in path("drafts.**")) && _type == "blog"`) reduces unnecessary serverless invocations and saves compute on draft autosaves.
4. **Vercel Framework Auto-Detection in Turborepos:**
   - When importing a monorepo with multiple apps (`apps/studio` with Vite, `apps/web` with Next.js), selecting `apps/web` as the root directory with source inclusion enabled allows Vercel to correctly invoke Turborepo's dependency pipeline without requiring brittle root `vercel.json` overrides.

---

## 3. What I'd Do With More Time

1. **Section-Level PortableText Search Indexing:**
   - Currently, indexing extracts top-level `title`, `description`, and `category`. For in-depth technical articles, I would parse PortableText blocks into semantic sections keyed by heading anchors, indexing each section as an individual search record with deep-links directly to the relevant heading on the page.
2. **Distributed Redis Rate Limiting (Upstash / KV):**
   - The current rate limiter uses an in-memory sliding window, which is efficient per serverless instance. In high-traffic distributed deployments, I would connect it to an Upstash Redis or Vercel KV store for shared state across all edge regions.
3. **Automated Synonyms & Search Telemetry:**
   - Add automated synonym mapping in Algolia configuration and integrate search analytics telemetry to track popular zero-result queries for editorial content planning.
