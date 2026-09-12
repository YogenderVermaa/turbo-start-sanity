import { env } from "@workspace/env/server";
import { Logger } from "@workspace/logger";
import { algoliasearch } from "algoliasearch";
import { type NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const logger = new Logger("BlogSearchAPI");

export async function GET(req: NextRequest) {
  // Rate limiting: 60 search requests per minute per IP
  const clientIp = getClientIp(req.headers);
  const rateLimitResult = checkRateLimit(`search:${clientIp}`, {
    limit: 60,
    windowSeconds: 60,
  });

  if (!rateLimitResult.allowed) {
    logger.warn("Search request rate limited", { ip: clientIp });
    return NextResponse.json(
      { error: "Too many search requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.reset),
        },
      }
    );
  }

  const { searchParams } = new URL(req.url);
  const rawQuery = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();

  // Bounded query and pagination inputs
  const page = Math.min(50, Math.max(0, parseInt(searchParams.get("page") || "0", 10)));
  const hitsPerPage = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("hitsPerPage") || "10", 10))
  );

  if (!rawQuery) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  // Bound query length to 100 characters to prevent expensive malicious expressions
  const query = rawQuery.slice(0, 100);

  const appId = env.ALGOLIA_APP_ID;
  const searchKey =
    process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY || env.ALGOLIA_ADMIN_KEY;
  const indexName = env.ALGOLIA_INDEX_NAME || "blogs";

  if (!appId || !searchKey) {
    logger.error("Algolia configuration missing for search endpoint");
    return NextResponse.json(
      { error: "Search service unavailable" },
      { status: 503 }
    );
  }

  try {
    const algolia = algoliasearch(appId, searchKey);

    const filterClause = category ? `category:"${category}"` : undefined;

    const response = await algolia.searchSingleIndex({
      indexName,
      searchParams: {
        query,
        page,
        hitsPerPage,
        filters: filterClause,
      },
    });

    const results = (response.hits || []).map((hit: any) => ({
      _id: hit.objectID,
      title: hit.title || "Untitled",
      description: hit.description || "",
      slug: hit.slug
        ? hit.slug.startsWith("/")
          ? hit.slug
          : `/blog/${hit.slug}`
        : "",
      category: hit.category || "",
      authors:
        Array.isArray(hit.authors) && hit.authors.length > 0
          ? { name: hit.authors[0] }
          : typeof hit.authors === "string" && hit.authors
            ? { name: hit.authors }
            : null,
      publishedAt: hit.publishedAt || null,
    }));

    return NextResponse.json(results, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "X-RateLimit-Limit": "60",
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      },
    });
  } catch (error) {
    logger.error("Algolia search query failed", {
      error: error instanceof Error ? error.message : "unknown",
      query,
    });
    return NextResponse.json(
      { error: "Search service temporarily unavailable" },
      { status: 503 }
    );
  }
}
