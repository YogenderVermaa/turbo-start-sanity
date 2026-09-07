import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Spinner,
  Stack,
  Text,
} from "@sanity/ui";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  Image as ImageIcon,
  RefreshCw,
  Search,
  ShieldAlert,
  Type,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import type { UserViewComponent } from "sanity/structure";

const ALGOLIA_APP_ID = process.env.SANITY_STUDIO_ALGOLIA_APP_ID;
const ALGOLIA_SEARCH_KEY = process.env.SANITY_STUDIO_ALGOLIA_SEARCH_KEY;
const ALGOLIA_INDEX_NAME = process.env.SANITY_STUDIO_ALGOLIA_INDEX_NAME || "blogs";
const RAW_SITE_URL = process.env.SANITY_STUDIO_PRESENTATION_URL || "http://localhost:3000";

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESC_MIN = 120;
const DESC_MAX = 160;

type AlgoliaStatus = "loading" | "indexed" | "not_indexed" | "error";

function getSiteUrl(): { url: URL | null; raw: string | undefined; valid: boolean } {
  if (!RAW_SITE_URL) return { url: null, raw: RAW_SITE_URL, valid: false };
  try {
    return { url: new URL(RAW_SITE_URL), raw: RAW_SITE_URL, valid: true };
  } catch {
    return { url: null, raw: RAW_SITE_URL, valid: false };
  }
}

export const SeoAndIndexView: UserViewComponent = (props) => {
  const displayed = props.document.displayed as any;
  const canonicalId = (displayed?._id || "").replace(/^drafts\./, "");
  const isDraft = (displayed?._id || "").startsWith("drafts.");

  const title =
    displayed?.ogTitle || displayed?.seoTitle || displayed?.title || "Untitled Document";

  const rawDescription =
    displayed?.ogDescription || displayed?.seoDescription || displayed?.description || "";
  const description =
    rawDescription ||
    "No description provided. Add a description to help search engines understand the page.";

  const rawSlug =
    typeof displayed?.slug === "object"
      ? displayed?.slug?.current ?? ""
      : displayed?.slug ?? "";
  const slug = rawSlug
    ? rawSlug.startsWith("/")
      ? rawSlug
      : `/blog/${rawSlug}`
    : "/blog/your-slug";

  const hasImage = Boolean(
    displayed?.image?.asset || displayed?.seoImage?.asset || displayed?.ogImage?.asset
  );
  const isNoIndex = Boolean(displayed?.seoNoIndex);

  const titleLength = title.length;
  const titleValid = titleLength >= TITLE_MIN && titleLength <= TITLE_MAX;

  const descLength = description.length;
  const descValid = descLength >= DESC_MIN && descLength <= DESC_MAX;

  const { url: siteUrl, valid: siteUrlValid } = getSiteUrl();
  const fullUrl = `${siteUrl ? siteUrl.origin : "http://localhost:3000"}${slug}`;

  const missingConfig: string[] = [
    !siteUrlValid && "Site URL",
    !ALGOLIA_APP_ID && "Algolia App ID",
    !ALGOLIA_SEARCH_KEY && "Algolia Search Key",
    !ALGOLIA_INDEX_NAME && "Algolia Index Name",
  ].filter(Boolean) as string[];

  const [algoliaStatus, setAlgoliaStatus] = useState<AlgoliaStatus>("loading");
  const [algoliaRecord, setAlgoliaRecord] = useState<any>(null);

  const requestIdRef = useRef(0);

  const checkAlgoliaIndex = async () => {
    const requestId = ++requestIdRef.current;

    if (!canonicalId || !ALGOLIA_APP_ID || !ALGOLIA_SEARCH_KEY || !ALGOLIA_INDEX_NAME) {
      setAlgoliaStatus("error");
      return;
    }

    setAlgoliaStatus("loading");

    try {
      const url = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX_NAME}/${encodeURIComponent(canonicalId)}`;
      const res = await fetch(url, {
        headers: {
          "X-Algolia-Application-Id": ALGOLIA_APP_ID,
          "X-Algolia-API-Key": ALGOLIA_SEARCH_KEY,
        },
      });

      if (requestId !== requestIdRef.current) return;

      if (res.ok) {
        const data = await res.json();
        if (requestId !== requestIdRef.current) return;
        setAlgoliaRecord(data);
        setAlgoliaStatus("indexed");
      } else if (res.status === 404) {
        setAlgoliaRecord(null);
        setAlgoliaStatus("not_indexed");
      } else {
        setAlgoliaStatus("error");
      }
    } catch {
      if (requestId === requestIdRef.current) setAlgoliaStatus("error");
    }
  };

  useEffect(() => {
    checkAlgoliaIndex();
  }, [canonicalId]);

  return (
    <Box padding={[4, 5, 6]} style={{ maxWidth: 880, margin: "0 auto" }}>
      <Stack space={5}>
        <Flex justify="space-between" align="center">
          <Stack space={2}>
            <Heading size={2}>SEO & Search Index Inspector</Heading>
            <Text size={1} muted>
              Real-time Google search snippet preview, SEO checklist, and live Algolia index verification.
            </Text>
          </Stack>
        </Flex>

        {missingConfig.length > 0 && (
          <Card padding={3} radius={2} tone="critical" border>
            <Flex align="center" gap={3}>
              <AlertCircle size={18} />
              <Text size={1}>
                Missing configuration: <strong>{missingConfig.join(", ")}</strong>.
              </Text>
            </Flex>
          </Card>
        )}

        <Card padding={4} radius={3} tone="default" border>
          <Stack space={4}>
            <Flex align="center" justify="space-between">
              <Flex align="center" gap={2}>
                <Search size={16} />
                <Heading size={1}>Google Search Preview</Heading>
              </Flex>
              <Badge tone="default" mode="outline">SERP Simulation</Badge>
            </Flex>

            <div
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "10px",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                fontFamily: "Arial, sans-serif",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    flexShrink: 0,
                  }}
                >
                  🌐
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#e8eaed",
                      lineHeight: "1.2",
                    }}
                  >
                    {siteUrlValid && siteUrl ? siteUrl.hostname : "localhost"}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#9aa0a6",
                      lineHeight: "1.2",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {siteUrlValid && siteUrl ? `${siteUrl.origin}` : "http://localhost:3000"}
                    {slug
                      .split("/")
                      .filter(Boolean)
                      .map((s: string) => ` › ${s}`)
                      .join("")}
                  </span>
                </div>
              </div>

              <div>
                <a
                  href={fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#8ab4f8",
                    fontSize: "20px",
                    fontWeight: 400,
                    textDecoration: "none",
                    lineHeight: "1.3",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  <span>{title}</span>
                  <ExternalLink size={15} style={{ opacity: 0.7, flexShrink: 0 }} />
                </a>
              </div>

              <div
                style={{
                  fontSize: "14px",
                  color: "#bdc1c6",
                  lineHeight: "1.5",
                  wordBreak: "break-word",
                }}
              >
                {description}
              </div>
            </div>
          </Stack>
        </Card>

        <Card padding={4} radius={3} tone="default" border>
          <Stack space={4}>
            <Flex align="center" gap={2}>
              <CheckCircle2 size={16} />
              <Heading size={1}>SEO Health Checklist</Heading>
            </Flex>

            <Grid columns={[1, 2]} gap={3}>
              <Card padding={3} radius={2} tone={titleValid ? "positive" : "caution"} border>
                <Stack space={3}>
                  <Flex justify="space-between" align="center">
                    <Flex align="center" gap={2}>
                      <Type size={14} />
                      <Text size={1} weight="semibold">Meta Title</Text>
                    </Flex>
                    <Badge tone={titleValid ? "positive" : "caution"}>
                      {titleValid ? "Optimal" : titleLength < TITLE_MIN ? "Too Short" : "Too Long"}
                    </Badge>
                  </Flex>
                  <Text size={1} muted>
                    {titleLength} / {TITLE_MAX} chars (Recommended: {TITLE_MIN}-{TITLE_MAX})
                  </Text>
                  <div style={{ height: 4, width: "100%", backgroundColor: "rgba(128,128,128,0.2)", borderRadius: 2 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, (titleLength / TITLE_MAX) * 100)}%`,
                        backgroundColor: titleValid ? "#22c55e" : "#f59e0b",
                        borderRadius: 2,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </Stack>
              </Card>

              <Card padding={3} radius={2} tone={rawDescription ? (descValid ? "positive" : "caution") : "critical"} border>
                <Stack space={3}>
                  <Flex justify="space-between" align="center">
                    <Flex align="center" gap={2}>
                      <FileText size={14} />
                      <Text size={1} weight="semibold">Meta Description</Text>
                    </Flex>
                    <Badge tone={rawDescription ? (descValid ? "positive" : "caution") : "critical"}>
                      {rawDescription ? (descValid ? "Optimal" : descLength < DESC_MIN ? "Too Short" : "Too Long") : "Missing"}
                    </Badge>
                  </Flex>
                  <Text size={1} muted>
                    {rawDescription ? `${descLength} / ${DESC_MAX} chars (Recommended: ${DESC_MIN}-${DESC_MAX})` : "No description set"}
                  </Text>
                  <div style={{ height: 4, width: "100%", backgroundColor: "rgba(128,128,128,0.2)", borderRadius: 2 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, (descLength / DESC_MAX) * 100)}%`,
                        backgroundColor: descValid ? "#22c55e" : rawDescription ? "#f59e0b" : "#ef4444",
                        borderRadius: 2,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </Stack>
              </Card>

              <Card padding={3} radius={2} tone={hasImage ? "positive" : "caution"} border>
                <Stack space={3}>
                  <Flex justify="space-between" align="center">
                    <Flex align="center" gap={2}>
                      <ImageIcon size={14} />
                      <Text size={1} weight="semibold">Social Sharing Image</Text>
                    </Flex>
                    <Badge tone={hasImage ? "positive" : "caution"}>
                      {hasImage ? "Attached" : "Missing"}
                    </Badge>
                  </Flex>
                  <Text size={1} muted>
                    {hasImage ? "Featured/OG image attached" : "No image attached"}
                  </Text>
                </Stack>
              </Card>

              <Card padding={3} radius={2} tone={isNoIndex ? "critical" : "positive"} border>
                <Stack space={3}>
                  <Flex justify="space-between" align="center">
                    <Flex align="center" gap={2}>
                      <Bot size={14} />
                      <Text size={1} weight="semibold">Search Engine Robots</Text>
                    </Flex>
                    <Badge tone={isNoIndex ? "critical" : "positive"}>
                      {isNoIndex ? "NoIndex" : "Index"}
                    </Badge>
                  </Flex>
                  <Text size={1} muted>
                    {isNoIndex ? "Blocked from search engines" : "Indexable (Public)"}
                  </Text>
                </Stack>
              </Card>
            </Grid>
          </Stack>
        </Card>

        <Card padding={4} radius={3} tone="default" border>
          <Stack space={4}>
            <Flex justify="space-between" align="center">
              <Flex align="center" gap={2}>
                <Globe size={16} />
                <Heading size={1}>Algolia Search Index Status</Heading>
              </Flex>
              <Button
                mode="ghost"
                icon={RefreshCw}
                text="Refresh Status"
                onClick={checkAlgoliaIndex}
                disabled={algoliaStatus === "loading"}
              />
            </Flex>

            {algoliaStatus === "loading" && (
              <Flex align="center" justify="center" gap={3} padding={4}>
                <Spinner />
                <Text size={1} muted>Checking Algolia search servers...</Text>
              </Flex>
            )}

            {algoliaStatus === "indexed" && (
              <Card padding={3} radius={2} tone="positive" border>
                <Flex align="center" justify="space-between">
                  <Flex align="center" gap={3}>
                    <CheckCircle2 size={20} color="#15803d" />
                    <Stack space={1}>
                      <Flex align="center" gap={2}>
                        <Text size={1} weight="bold">Live in Algolia Search Index</Text>
                        <Badge tone="primary" mode="outline">Index: {ALGOLIA_INDEX_NAME}</Badge>
                      </Flex>
                      <Text size={1} muted>
                        ObjectID: <code style={{ fontSize: "11px" }}>{canonicalId}</code>
                      </Text>
                    </Stack>
                  </Flex>
                  <Badge tone="positive">Indexed</Badge>
                </Flex>
              </Card>
            )}

            {algoliaStatus === "not_indexed" && (
              <Card padding={3} radius={2} tone={isNoIndex ? "critical" : "caution"} border>
                <Flex align="center" justify="space-between">
                  <Flex align="center" gap={3}>
                    {isNoIndex ? <ShieldAlert size={20} color="#dc2626" /> : <AlertCircle size={20} color="#d97706" />}
                    <Stack space={1}>
                      <Text size={1} weight="bold">
                        {isNoIndex
                          ? "Excluded from Search (seoNoIndex is True)"
                          : isDraft
                            ? "Draft Post (Not published yet)"
                            : "Not Found in Algolia Index"}
                      </Text>
                      <Text size={1} muted>
                        Publishing this document in Sanity will automatically sync it to Algolia.
                      </Text>
                    </Stack>
                  </Flex>
                  <Badge tone={isNoIndex ? "critical" : "caution"}>
                    {isNoIndex ? "NoIndex" : "Not In Search"}
                  </Badge>
                </Flex>
              </Card>
            )}

            {algoliaStatus === "error" && (
              <Card padding={3} radius={2} tone="critical" border>
                <Flex align="center" gap={3}>
                  <AlertCircle size={20} color="#dc2626" />
                  <Stack space={1}>
                    <Text size={1} weight="semibold">Unable to verify Algolia index status</Text>
                    <Text size={1} muted>
                      {missingConfig.some((c) => c.startsWith("Algolia"))
                        ? `Missing: ${missingConfig.filter((c) => c.startsWith("Algolia")).join(", ")}`
                        : "Check network connectivity or API credentials."}
                    </Text>
                  </Stack>
                </Flex>
              </Card>
            )}
          </Stack>
        </Card>
      </Stack>
    </Box>
  );
};
