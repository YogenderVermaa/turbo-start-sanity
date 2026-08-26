import { createHash} from "node:crypto";
import { env } from "@workspace/env/server";
import { Logger } from "@workspace/logger";
import { client } from "@workspace/sanity/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error } from "node:console";

const logger = new Logger("Newsletter")

const NewsletterSchema  = z.object({
    email : z
    .string({error:"Email is required"})
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .max(254, "Email exceeds maximum length")
})

export async function POST( req:NextRequest) {
    let json : unknown;
    try {
        json = await req.json()
    } catch (error) {
        logger.warn("newsletter request rejected: Invalid JSON body");
        return NextResponse.json(
            { error : "Bad Request : Body must be a valid json"},
            { status: 400}
        )

    }
    
    const result  = NewsletterSchema.safeParse(json);
    if(!result.success) {
        const errorMessage = result.error.issues[0]?.message || "invalid input";
        logger.warn("Newsletter validation failed" , {error:errorMessage});
        return NextResponse.json({
            error: errorMessage 
        },
    {
        status:400
    });
    }

    const email = result.data?.email

    if(!env.SANITY_API_WRITE_TOKEN){
        logger.error("SANITY_API_WRITE_TOKEN is missing");
        return NextResponse.json(
            { error : "Internal Server Error" },
            { status : 500 }
        )
    }

    const writeClient = client.withConfig({
        token  : env.SANITY_API_WRITE_TOKEN,
        useCdn : false
    })
    

    const emailHash = createHash("sha256").update(email).digest("hex");

    const documentId = `subscriber-${emailHash}`;

    try {
        const existing = await writeClient.getDocument(documentId);
        if(existing) {
            logger.info("Subscriber already exists", {emailHash});
            return NextResponse.json(
                {message: "Already subscribed", subscribed: true},
                {status: 200}
            );
        }

        await writeClient.createIfNotExists({
            _id: documentId,
            _type: "subscriber",
            email,
            subscribedAt: new Date().toISOString(),
        });

        logger.info("New Subscriber created Successfully" , {emailHash});

        return nextResponse
        
    }



    
}




