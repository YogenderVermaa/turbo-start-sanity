# Verification Proofs (VERIFY.md)

This document contains the exact commands executed against the live production deployment and the actual responses returned.

- **Live Production URL:** `https://turbo-start-sanity-web-olxq.vercel.app`
- **Sanity Studio URL:** `https://yogi-turbo-sanity.sanity.studio`
- **Algolia Application ID:** `QWFA8XWS6M`
- **Algolia Index Name:** `blogs`
- **Algolia Search-Only API Key:** `fe5a4f0bcfb60dfde797697f60609839`

---

## 1. Publishing a post puts it in the index

**Command:**
```powershell
$headers = @{
    "Authorization" = "Bearer E2HjRfvp7eiRoBKu6PPbuk699wq1aCcCLXciI/piMEQ="
    "Content-Type"  = "application/json"
}
$body = @{
    _id = "test-verify-1"
    _type = "blog"
    title = "Deploying Modern Sanity Turborepos"
    description = "A comprehensive guide to deploying Next.js and Sanity Studio."
    slug = "deploying-modern-sanity"
    category = "Engineering"
    authors = @("John Doe")
    publishedAt = "2026-09-08T12:00:00Z"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://turbo-start-sanity-web-olxq.vercel.app/api/search-sync" -Method POST -Headers $headers -Body $body | ConvertTo-Json
```

**Actual Output:**
```json
{
    "action":  "indexed",
    "id":  "test-verify-1"
}
```

---

## 2. Unpublishing or deleting it removes it

**Command:**
```powershell
$headers = @{
    "Authorization" = "Bearer E2HjRfvp7eiRoBKu6PPbuk699wq1aCcCLXciI/piMEQ="
    "Content-Type"  = "application/json"
}
$body = @{
    _id = "test-verify-1"
    _type = "blog"
    _deleted = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://turbo-start-sanity-web-olxq.vercel.app/api/search-sync" -Method POST -Headers $headers -Body $body | ConvertTo-Json
```

**Actual Output:**
```json
{
    "action":  "deleted",
    "id":  "test-verify-1"
}
```

---

## 3. A draft post never appears in search results

**Command:**
```powershell
$headers = @{
    "Authorization" = "Bearer E2HjRfvp7eiRoBKu6PPbuk699wq1aCcCLXciI/piMEQ="
    "Content-Type"  = "application/json"
}
$body = @{
    _id = "drafts.secret-article-123"
    _type = "blog"
    title = "Confidential Draft"
    slug = "confidential-draft"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://turbo-start-sanity-web-olxq.vercel.app/api/search-sync" -Method POST -Headers $headers -Body $body | ConvertTo-Json
```

**Actual Output:**
```json
{
    "skipped":  true,
    "reason":  "draft_ignored",
    "id":  "drafts.secret-article-123"
}
```

---

## 4. The same webhook delivery twice leaves one entry, not two (Idempotency)

**Command:**
```powershell
$headers = @{
    "Authorization" = "Bearer E2HjRfvp7eiRoBKu6PPbuk699wq1aCcCLXciI/piMEQ="
    "Content-Type"  = "application/json"
}
$body = @{
    _id = "idempotent-post-test"
    _type = "blog"
    title = "Idempotency Test"
    description = "Delivered twice"
    slug = "idempotency-test"
    publishedAt = "2026-09-08T12:00:00Z"
} | ConvertTo-Json

# Send delivery 1
$res1 = Invoke-RestMethod -Uri "https://turbo-start-sanity-web-olxq.vercel.app/api/search-sync" -Method POST -Headers $headers -Body $body
# Send delivery 2 (identical)
$res2 = Invoke-RestMethod -Uri "https://turbo-start-sanity-web-olxq.vercel.app/api/search-sync" -Method POST -Headers $headers -Body $body

[PSCustomObject]@{ FirstDelivery = $res1; SecondDelivery = $res2 } | ConvertTo-Json
```

**Actual Output:**
```json
{
    "FirstDelivery":  {
                          "action":  "indexed",
                          "id":  "idempotent-post-test"
                      },
    "SecondDelivery":  {
                           "action":  "indexed",
                           "id":  "idempotent-post-test"
                       }
}
```

**Index Query Verification:**
```powershell
Invoke-RestMethod -Uri "https://turbo-start-sanity-web-olxq.vercel.app/api/blog/search?q=Idempotency" | ConvertTo-Json
```

**Actual Output:**
```json
{
    "value":  [
                  {
                      "_id":  "idempotent-post-test",
                      "title":  "Idempotency Test",
                      "description":  "Delivered twice",
                      "slug":  "/blog/idempotency-test",
                      "category":  "",
                      "authors":  null,
                      "publishedAt":  "2026-09-08T12:00:00Z"
                  }
              ],
    "Count":  1
}
```
*(Confirms that Algolia maps `canonicalId` directly to `objectID`, leaving exactly 1 record).*

---

## 5. `/api/blog/search` returns page 2 of a result set

**Command:**
```powershell
Invoke-RestMethod -Uri "https://turbo-start-sanity-web-olxq.vercel.app/api/blog/search?q=a&page=1&hitsPerPage=2" | ConvertTo-Json
```

**Actual Output:**
```json
[
    {
        "_id":  "0b11eb66-6973-481f-bd4c-18c3bf5b1ae1",
        "title":  "Open-architected Mobile Microservice",
        "description":  "Administratio spes voluntarius pax. Vulgaris utrimque a uberrime antea caritas vero. Alter perspiciatis suffoco acquiro utrimque.",
        "slug":  "/blog/open-architected-mobile-microservice",
        "category":  "",
        "authors":  {
                        "name":  "Ramon Ritchie"
                    },
        "publishedAt":  "2024-11-01"
    },
    {
        "_id":  "b64b001f-9b5b-4d72-9577-1cf2f160a9af",
        "title":  "Self-enabling Asymmetric Portal",
        "description":  "Denuncio temperantia angustus dolorem vulgus modi condico auctus. Deprimo nobis atrox via minima templum dolorum credo spiculum. Tepidus valetudo virga talis adsidue consequatur admiratio defendo casso.",
        "slug":  "/blog/self-enabling-asymmetric-portal",
        "category":  "",
        "authors":  {
                        "name":  "Ramon Ritchie"
                    },
        "publishedAt":  "2025-05-07"
    }
]
```

---

## 6. A request with no valid key is rejected (401)

**Command:**
```powershell
$headers = @{
    "Authorization" = "Bearer invalid-or-missing-secret"
    "Content-Type"  = "application/json"
}
$body = @{ _id = "test"; _type = "blog" } | ConvertTo-Json

try {
    Invoke-WebRequest -Uri "https://turbo-start-sanity-web-olxq.vercel.app/api/search-sync" -Method POST -Headers $headers -Body $body
} catch {
    $_.Exception.Response.StatusCode.value__
}
```

**Actual Output:**
```
401
```

---

## 7 & 8. Studio Tab Real-Time Updates & Index Reporting

- **Screen Recording Link:** [Add your Loom / CleanShot link here]
- **Video Description:**
  - Demonstrates editing title and description in the Sanity Studio left pane with real-time update in the **SEO & Index** SERP simulation view before saving.
  - Demonstrates one published blog post showing **"Live in Algolia Search Index"** (green check) and one draft/unpublished post showing **"Draft Post / Not Found in Algolia Index"** (badge status).
