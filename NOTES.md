# Project Evaluation & Architecture Notes

**Production Web URL:** https://turbo-start-sanity-web-olxq.vercel.app  
**Sanity Studio URL:** https://yogi-turbo-sanity.sanity.studio  
**Algolia Application ID:** QWFA8XWS6M  
**Algolia Index Name:** blogs  
**Algolia Search-Only Key:** fe5a4f0bcfb60dfde797697f60609839  

---

## 1. What I Built and Why

### Search Sync Webhook (`/api/search-sync`)
I built an atomic, idempotent synchronization route that bridges Sanity document lifecycle events directly into Algolia.
- **Security:** Incoming requests are authenticated against `SANITY_SEARCH_SYNC_SECRET` using `crypto.timingSafeEqual` over buffers to prevent timing attacks.
- **Draft Isolation:** Sanity generates `drafts.<id>` documents during live edits. The webhook explicitly filters out any document where `_id` begins with `drafts.`, ensuring unpublished drafts never leak to public search.
- **Atomic Deletions & NoIndex Pruning:** When a document has `_deleted: true` or `seoNoIndex: true`, the handler calls Algolia's `deleteObject` using the canonical ID (`_id.replace(/^drafts\./, "")`).
- **Idempotency:** By mapping Sanity's canonical `_id` directly to Algolia's `objectID`, repeated deliveries update in place without creating duplicate search records.

### Paginated Blog Search API (`/api/blog/search`)
I implemented a public REST search endpoint leveraging Algolia's search client (`searchSingleIndex`).
- **Query & Faceting:** Supports full-text search `q`, page-based pagination (`page`, `hitsPerPage`), and optional `category` filtering.
- **Robust Failure Modes:** Returns explicit status codes (400 for missing query parameter, 503 if Algolia credentials are unconfigured or remote index unavailable) rather than crashing or returning generic 500 errors.
- **Edge Caching:** Attached `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` headers to ensure fast repeat query response times while keeping edge caches warm.

### Sanity Studio SEO & Search Index Inspector (`apps/studio/components/seo-and-index-view.tsx`)
I created a custom document view component attached to `blog` and `page` document types.
- **Real-Time SERP Simulation:** Subscribed directly to `props.document.displayed` so character length counters and Google snippet previews update dynamically as editors type, before saving or publishing.
- **Live Search Verification:** Directly queries Algolia's public REST API (`https://<APP_ID>-dsn.algolia.net/1/indexes/...`) with the search-only key to report whether the canonical document ID is live in the index.

---

## 2. What I Noticed (Codebase Observations & Feedback)

1. **Tailwind v4 Workspace Scanning (`globals.css` @source paths):**
   - The initial `@source` directives in `packages/ui/src/styles/globals.css` referenced `../../../sanity-blocks/src` instead of `../../../packages/sanity-blocks/src`. Because Tailwind v4 evaluates `@source` relative to the CSS file, dead paths silently prevent Tailwind from generating utility classes for shared block components in production builds. Standardizing `@source "../../../packages/**/*.{ts,tsx}";` solved this globally across all workspace packages.
2. **Turbopack PostCSS Sandboxing & Monorepo Package Resolution:**
   - In `apps/web`, Turbopack was unable to resolve bare `@import "tw-animate-css";` when imported from within a workspace package (`@workspace/ui`). Like `@tailwindcss/typography`, using relative module path resolution or hoisting catalog dependencies ensures non-hoisted pnpm workspaces compile reliably in Next.js Turbopack serverless environments.
3. **Draft Document Filtering in Sanity Webhooks:**
   - In Sanity, webhooks can trigger on both draft and published transactions. While the endpoint handles `_id.startsWith("drafts.")`, configuring the webhook filter in Sanity Manage (`!(_id in path("drafts.**")) && _type == "blog"`) reduces unnecessary serverless invocations and saves compute on draft autosaves.
4. **Vercel Framework Auto-Detection with Monorepos:**
   - When importing a Turborepo containing both a Vite app (`apps/studio`) and a Next.js app (`apps/web`), Vercel initially guessed `Vite` as the framework preset when selecting the root. Explicitly setting the framework preset to `Next.js` and root directory to `apps/web` is essential for the Next.js App Router build pipeline to activate.

---

## 3. What I'd Do With More Time

1. **Full-Text Chunking for PortableText:**
   - Currently, indexing extracts the `title` and `description`. For long-form technical blogs, I would parse PortableText blocks into semantic sections (anchored by headings) and index each section as a distinct child record with parent document linkage, enabling direct deep-linking from search results to specific paragraphs.
2. **Batch Backfill Background Worker with Rate Limiting:**
   - Expand `/api/search/backfill` to use a paginated cursor or queue to backfill datasets with thousands of documents, including progress tracking and automatic batch chunking (e.g. 100 documents per Algolia `saveObjects` call).
3. **Algolia Synonyms & Ranking Configuration via Code:**
   - Implement an automated index initialization script that sets Algolia ranking criteria (`customRanking: ["desc(publishedAt)"]`), searchable attributes, and query synonyms directly from the repository.
