import { createHash } from "node:crypto";
import { env } from "@workspace/env/server";
import { Logger } from "@workspace/logger";
import { client } from "@workspace/sanity/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const logger = new Logger("Newsletter");

const NewsletterSchema = z.object({
  email: z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .max(254, "Email exceeds maximum length"),
});

export async function POST(req: NextRequest) {
  // Rate limiting: 5 requests per 60 seconds per IP
  const clientIp = getClientIp(req.headers);
  const rateLimitResult = checkRateLimit(`newsletter:${clientIp}`, {
    limit: 5,
    windowSeconds: 60,
  });

  if (!rateLimitResult.allowed) {
    logger.warn("Newsletter request rate limited", { ip: clientIp });
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.reset),
        },
      }
    );
  }

  let rawEmail: string | undefined;

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const json = await req.json();
      rawEmail = json?.email;
    } catch {
      logger.warn("Newsletter request rejected: Invalid JSON body");
      return NextResponse.json(
        { error: "Bad Request: Body must be a valid JSON" },
        { status: 400 }
      );
    }
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const formData = await req.formData();
      rawEmail = formData.get("email")?.toString();
    } catch {
      logger.warn("Newsletter request rejected: Invalid Form Data");
      return NextResponse.json(
        { error: "Bad Request: Invalid Form Data" },
        { status: 400 }
      );
    }
  } else {
    // Fallback: attempt to parse as JSON first, then text
    try {
      const json = await req.json();
      rawEmail = json?.email;
    } catch {
      return NextResponse.json(
        { error: "Bad Request: Unsupported Content-Type" },
        { status: 400 }
      );
    }
  }

  const result = NewsletterSchema.safeParse({ email: rawEmail });
  if (!result.success) {
    const errorMessage = result.error.issues[0]?.message || "Invalid input";
    logger.warn("Newsletter validation failed", { error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  const email = result.data.email;

  if (!env.SANITY_API_WRITE_TOKEN) {
    logger.error("SANITY_API_WRITE_TOKEN is missing");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }

  const writeClient = client.withConfig({
    token: env.SANITY_API_WRITE_TOKEN,
    useCdn: false,
  });

  const emailHash = createHash("sha256").update(email).digest("hex");
  const documentId = `subscriber-${emailHash}`;

  try {
    const existing = await writeClient.getDocument(documentId);
    if (existing) {
      logger.info("Subscriber already exists", { emailHash });
      return NextResponse.json(
        { message: "Already subscribed", subscribed: true },
        { status: 200 }
      );
    }

    await writeClient.createIfNotExists({
      _id: documentId,
      _type: "subscriber",
      email,
      subscribedAt: new Date().toISOString(),
      status: "active",
    });

    logger.info("New Subscriber created Successfully", { emailHash });

    return NextResponse.json(
      { message: "Subscribed successfully", subscribed: true },
      { status: 201 }
    );
  } catch (err) {
    logger.error("Failed to save subscriber to sanity", {
      error: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json(
      { error: "Failed to process subscription" },
      { status: 500 }
    );
  }
}
