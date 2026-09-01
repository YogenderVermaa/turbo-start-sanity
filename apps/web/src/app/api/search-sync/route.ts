import { timingSafeEqual } from "node:crypto";
import { env } from "@workspace/env/server";
import { Logger } from "@workspace/logger";
import {algoliasearch} from  "algoliasearch";
import { NextRequest, NextResponse } from "next/server";

const logger = new Logger("SearchSync");

function secretsMatch(provided: string,expected: string):boolean {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a,b);

}

export async function POST(req: NextRequest){
    const expected = env.SANITY_SEARCH_SYNC_SECRET;
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");

    if(!(expected && authHeader) || !secretsMatch(authHeader,expected)){
        logger.warn("Reject unauthorized search-sync request",{
            hasAuthHeader: Boolean(authHeader),
            secretConfigured:Boolean(expected),
        });
        return new Response("Unauthorized",{status:401});


    }

    if(!env.ALGOLIA_APP_ID || !env.ALGOLIA_ADMIN_KEY ){
        logger.error("Algolia configuration missing in environment")
        return NextResponse.json(
            {error : "Search service unconfigured"},{status:500}
        );
    }

    let body : any;

    try {
        body = await req.json();
    } catch  {
        return new Response("Bad Request : body must be a valid JSON",{status:400});
        
    }

    const { _id,_type,_deleted,seoNoIndex, title, description, slug ,authors,publishedAt,category} = body;

    if(_type !== "blog") {
        return NextResponse.json({skipped:true,reason:"unsupported_type",type:_type})
    }

    if (!_id || typeof _id !== "string") {
    return NextResponse.json({ error: "Missing document _id" }, { status: 400 });
  }

  const isDraft = _id.startsWith("drafts.");
  const canonicalId = _id.replace(/^drafts\./,"");

  if(isDraft){
    logger.info("Skipping draft document", {id: _id});
    return NextResponse.json({skipped:true,reason:"draft_ignored",id:_id});
  }

  const algolia = algoliasearch(env.ALGOLIA_APP_ID, env.ALGOLIA_ADMIN_KEY);
  const indexName = env.ALGOLIA_INDEX_NAME || "blogs";

  try{
    if(_deleted === true || seoNoIndex === true) {
        await algolia.deleteObject({
            indexName,
            objectID:canonicalId,
        });
        logger.info("Removed document form Algolia", {
            id:canonicalId,
            reason: _deleted ? "deleted": "noIndex",
        });
        return NextResponse.json({action:"deleted", id : canonicalId});
    }

    const record  = {
        objectID : canonicalId,
        title: title || "Untitled",
        description : description || "",
        slug : typeof slug === "object" ? slug.current : slug || "",
        category: category || "",
        authors : Array.isArray(authors) ? authors.map((a: any) => typeof a === "object" ? a.name || a.title || "" : a).filter(Boolean):[],
        publishedAt: publishedAt  || new Date().toISOString(),
    };
    await  algolia.saveObject({
        indexName,
        body: record,
    });
    logger.info("Synchorinized document to Algolia", { id:canonicalId});
    return NextResponse.json({
        action:"indexed",id:canonicalId
    })
    
  }catch(err){
    logger.error("Failed to sync document to Algolia", {id :canonicalId,
        error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
        {
            error : "Failed to update search index"},
           {status:500
        },
        
    )

  }
  
}
