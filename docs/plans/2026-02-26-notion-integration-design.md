# Notion Integration Design

**Status:** Roadmap (not yet scheduled)
**Date:** 2026-02-26
**Approach:** OAuth per-user (Approach B)

## Summary

Add a Notion integration that lets users publish collaborative reports directly to their Notion workspace. Reports render as native Notion content (callout blocks, tables, toggle sections) — fully editable and commentable by team members.

This is the first connector in a new **Integrations tab** in the sidebar, designed to be extensible for future services (Slack, Google Sheets, etc.).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth model | OAuth per-user | Each user controls where reports go; multi-workspace support |
| Graphics approach | Native Notion blocks | Callout blocks for KPIs, native tables for data — editable, no image hosting needed |
| UI location | Integrations tab in sidebar | Separate from ExportWizard; extensible for future connectors |
| SDK | `@notionhq/client` | Official Notion SDK, server-side on Express |

## Architecture

### Data Model

```
UserIntegration
  id          String   @id @default(cuid())
  userId      Int
  provider    String   // 'notion' | 'slack' | 'google_sheets' (extensible)
  accessToken String   // encrypted at rest
  workspaceId String?  // Notion workspace ID
  workspaceName String? // display name
  metadata    Json?    // provider-specific data (e.g., default parent page)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id])
  @@unique([userId, provider])
  @@index([provider])
```

### Backend Routes

```
POST   /api/integrations/notion/connect     → Initiate OAuth flow (returns redirect URL)
GET    /api/integrations/notion/callback     → OAuth callback (stores token)
DELETE /api/integrations/notion/disconnect   → Remove token
GET    /api/integrations/notion/status       → Check connection status
POST   /api/integrations/notion/publish      → Create report page in Notion
GET    /api/integrations/notion/pages        → List user's Notion pages (for page picker)
```

### Notion Page Structure

When a user publishes a report, the created Notion page contains:

1. **Header** — Module name, date, company name (as H1 + subtitle)
2. **KPI Summary** — Dashboard metrics as Notion callout blocks (icon + value + label)
3. **Data Table** — Native Notion table built from export columns/rows
4. **AI Summary** — Toggle block with Gemini-generated summary (if enabled)
5. **Footer** — Generation metadata (timestamp, module, user)

### Frontend Components

```
src/components/integrations/
  IntegrationsTab.tsx          — Sidebar tab listing all connectors
  ConnectorCard.tsx            — Reusable card: icon, name, status badge, connect/disconnect
  NotionPublishDialog.tsx      — Module-specific: page picker, content options, publish button
  NotionPagePicker.tsx         — Dropdown/search to select target Notion page
```

### Connector Pattern (extensible)

Each future integration follows the same shape:

```typescript
interface IntegrationConnector {
  provider: string
  displayName: string
  icon: LucideIcon
  connectUrl: string
  disconnectUrl: string
  statusUrl: string
  isConnected: boolean
}
```

### Notion Block Builder

New library that transforms existing `ExportData` types into Notion API block objects:

```
src/lib/notionPageBuilder.ts
  buildNotionPage(data: ExportData) → NotionBlock[]
    → headerBlocks()       — heading_1, paragraph (subtitle)
    → kpiBlocks()          — callout blocks with emoji icons
    → tableBlock()         — table with table_row children
    → aiSummaryBlock()     — toggle with paragraph children
    → footerBlock()        — divider + paragraph
```

Reuses `ExportColumn`, `ExportData`, and `ExportColumn[]` types from `src/lib/exportGenerators.ts`.

## OAuth Flow

1. User clicks "Connect Notion" in Integrations tab
2. Frontend calls `POST /api/integrations/notion/connect`
3. Server returns Notion OAuth authorize URL with state param (JWT-encoded userId)
4. User authorizes in Notion, redirected to `/api/integrations/notion/callback`
5. Server exchanges code for access token, stores encrypted in `UserIntegration`
6. Redirect back to app with success status
7. Integrations tab shows "Connected" badge with workspace name

## Security Considerations

- OAuth tokens encrypted at rest (AES-256 or similar)
- State parameter in OAuth flow prevents CSRF
- Token refresh handled on 401 responses from Notion API
- Users can only disconnect their own integrations
- No admin override — each user manages their own connections

## Dependencies

- `@notionhq/client` — Official Notion SDK
- Notion OAuth app registration (requires Notion developer account)
- Environment variables: `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI`

## Out of Scope (for v1)

- Recurring/scheduled sync to Notion
- Two-way sync (Notion → app)
- Notion database creation (reports are pages, not database rows)
- Embedded chart images (using native blocks only)
- Bulk export (one module at a time)
