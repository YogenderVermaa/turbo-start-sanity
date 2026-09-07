import { timingSafeEqual } from "node:crypto";
import {env} from "@workspace/env/server";
import { Logger} from "@workspace/logger";
import {client} from "@workspace/sanity/client";
import {algoliasearch} from "algoliasearch";
import { type NextRequest, NextResponse} from "next/server";


const logger = new Logger("SearchBackfill");

function secretMatch(provided: string,expected:string):boolean{
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);

    return a.length === b.length && timingSafeEqual(a,b);
}

export async function POST(req: NextRequest) {
    const expected = env.SANITY_SEARCH_SYNC_SECRET;
    const authHeader = req.headers.get("authorization")?.replace("Bearer ","");

    if(!(expected&&authHeader) || !secretMatch(authHeader,expected)){
        logger.warn("Reject unauthorized backfill request");
        return new Response("Unauthorized", {
            status: 401
        });

    }
    if(!env.ALGOLIA_APP_ID || !env.ALGOLIA_ADMIN_KEY){
        logger.error("Algolia credentials missing");
        return NextResponse.json(
            {error: "Search service unconfigured"},{
                status: 500
            }

        );
    }

    try{
        logger.info("Starting Algolia backfill from Sanity....");
        
        const query = `*[_type =="blog" && !(_id in path("drafts.**")) && seoNoIndex != true]{
        _id,
        title,
        description,
        "slug":slug.current,
        category,
        "authors":authors[]->name,
        publishedAt}`;

        const posts = await client.fetch(query);
        logger.info(`Fetched ${posts.length} published blogs from Sanity`);

        if(!Array.isArray(posts) || posts.length === 0){
            return NextResponse.json({
                message: "No published posts found to backfill",
                count: 0
            });
        }
                        const records = posts.map((post: any) => ({
            objectID: post._id,
            title: String(post.title || "Untitled").slice(0, 300),
            description: String(post.description || "").slice(0, 1000),
            slug: String(post.slug || "").slice(0, 200),
            category: String(post.category || "").slice(0, 100),
            authors: Array.isArray(post.authors) 
                ? post.authors.map((a: any) => String(typeof a === "object" ? a.name || "" : a).slice(0, 100))
                : [],
            publishedAt: post.publishedAt || new Date().toISOString(),
        }));



        const algolia = algoliasearch(env.ALGOLIA_APP_ID,env.ALGOLIA_ADMIN_KEY);
        const indexName = env.ALGOLIA_INDEX_NAME || "blogs";

        await algolia.saveObjects({
            indexName,
            objects:records,
        });
        logger.info(`Successfully backfilled ${records.length} posts`);

        return NextResponse.json({
            success:true,
            message:`Successfully backfilled ${records.length} posts `,
            count: records.length,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "unknown";
        logger.error("Backfill failed", {
            error: errorMessage,
        });
        return NextResponse.json(
            { error: "Backfill operation failed", details: errorMessage },
            { status: 500 }
        );
    }
}