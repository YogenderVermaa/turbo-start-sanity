import {env} from "@workspace/env/server";
import {Logger} from "@workspace/logger";
import { algoliasearch } from "algoliasearch";
import { type NextRequest, NextResponse} from "next/server";

const logger = new Logger("BlogSearchAPI");

export async function GET(req: NextRequest){
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const page = Math.max(0, parseInt(searchParams.get("page") || "0",10));
  const hitsPerPage = Math.min(50,Math.max(1,parseInt(searchParams.get("hitsPerPage") || "10",10)));

  if(!query) {
    return NextResponse.json({error : "Query is required"},{status:400});
  }

  const appId =env.ALGOLIA_APP_ID;
  const searchkey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY || env.ALGOLIA_ADMIN_KEY;
  const indexName = env.ALGOLIA_INDEX_NAME || "blogs" ;

  if(!appId || !searchkey) {
    logger.error("Aloglia configuration missing for search endpoint");
    return NextResponse.json(
    {error : "Search service ubavailable"},
    {status: 503}
    );
  }

  try {
    const algolia = algoliasearch(appId, searchkey);

    const filterClause = category ? `category:"${category}"` : undefined;

    const response  = await algolia.searchSingleIndex({
      indexName,
      searchParams: {
        query,
        page,
        hitsPerPage,
        filters:filterClause,
      },
    });

    const results = (response.hits || []).map((hit:any) => ({
      _id: hit.objectID,
      title: hit.title || "Untitled",
      description : hit.description || "",
      slug: hit.slug ? (hit.slug.startsWith("/") ? hit.slug : `/blog/${hit.slug}`): "",
        category: hit.category || "",
      authors: Array.isArray(hit.authors) && hit.authors.length > 0 ? {name: hit.authors[0]}:typeof hit.authors === "string" && hit.authors ?{name:hit.authors}:null,
      publishedAt: hit.publishedAt || null,
    }));
    return NextResponse.json(results, {
      status: 200,
      headers : {
        "Cache-Control" : "public, s-maxage=60, stale-while-revalidate=300",

      },

    });

  }catch(error){
    logger.error("Algolia search query failed", {
      error: error instanceof Error ? error.message : "unknown ",query
    });
    return NextResponse.json(
      {error : "Search service temporarily unavailable"},
      { status:503}
    )
  }
}
