# SNOW Helper — Runbook

**Repository:** [github.com/dneeds52/snow-helper](https://github.com/dneeds52/snow-helper)
**Hosted at:** [dneeds52.github.io/snow-helper](https://dneeds52.github.io/snow-helper/)
**Platform:** GitHub Pages (static files, no server)

---

## What Is SNOW Helper?

SNOW Helper is a collection of browser-based tools that sit on top of ServiceNow (SNOW) to streamline ticket triage, tracking, and communication for the Epic ASAP team at UMass Memorial Health. Everything runs client-side — bookmarklets inject JavaScript into ServiceNow pages, and standalone pages are hosted on GitHub Pages.

The tools fall into three categories:

1. **Bookmarklets** — small scripts saved as browser bookmarks that run against the current ServiceNow page
2. **Overlay tools** — larger scripts loaded from GitHub Pages that create floating UI panels inside ServiceNow
3. **Standalone pages** — full HTML pages hosted on GitHub Pages (the dashboard, the triage tagger, the upgrade dashboard)

### Team Context

The tools are built around a specific assignment group (sys_id `b0f881a7db916e00cdb372fc0f961973`) and use the **Order field** as a lightweight status/priority system. The tens digit of the Order value determines the ticket's category:

| Order Range | Category | Color |
|---|---|---|
| (blank/0) | Initial Action | Purple |
| 00–19 | Update Needed | Yellow |
| 20–29 | Prioritize | Blue |
| 30–39 | Discuss | Gray |
| 40–49 | Scheduled | Green |
| 50–59 | Blocked | Red |
| 60–69 | Deferred | Light Gray |
| 70–79 | DC Move | Pink |
| 80–89 | ASAP PC | Teal |

The ones digit is preserved when moving tickets between categories (e.g., Order 83 → 13 keeps the "3" sub-priority).

### Sites

Nine hospital/campus sites are used across the tools: UNV, MEM, MARL, HALC, CLIN, HHSB, HHWEB, MRMC, NV. The Triage Tagger also includes UC (Urgent Care) and ALL.

---

## File Inventory

| File | Type | Description |
|---|---|---|
| `snow-helper.html` | Standalone page | Main dashboard — bookmarklet listings, email builder, triage guide, on-call schedule, order legend |
| `snow-helper-menu.js` | Overlay (loaded by bookmarklet) | Floating toolbar with all tools accessible from any SN page |
| `snow-helper-taskmaster.js` | Overlay (loaded by menu or bookmarklet) | Color-codes ticket list rows by Order field category |
| `snow-helper-council.js` | Overlay (loaded by menu or bookmarklet) | PC Approval — site-by-site approval tracker for a single ticket |
| `snow-helper-pc-review.js` | Overlay (loaded by menu or bookmarklet) | Post-Meeting Review — bulk review of ASAP PC and Discuss tickets |
| `snow-helper-triage-tagger.html` | Standalone page (popup) | Structured triage tool — tag picker, short description builder, description template |
| `upgrade-dashboard.html` | Standalone page | Epic upgrade tracking dashboard — milestones, tasks, Kanban board |
| `favicon.svg` | Asset | Default favicon |
| `favicon-copy.svg` | Asset | Favicon for copy operations |
| `favicon-email.svg` | Asset | Favicon for email operations |
| `favicon-taskmaster.svg` | Asset | Favicon for TaskMaster |

---

## The All-in-One Menu

**File:** `snow-helper-menu.js`
**How to install:** Save a bookmark with this URL:
```
javascript:void(function(){var d=document;if(d.getElementById('snowHelperMenu'))return d.getElementById('snowHelperMenu').remove();var s=d.createElement('script');s.src='https://dneeds52.github.io/snow-helper/snow-helper-menu.js?'+Date.now();d.body.appendChild(s)}())
```

**What it does:** Creates a floating toolbar at the top of any ServiceNow page. The toolbar contains buttons for every tool in the suite, so you only need one bookmarklet installed.

### Tools in the Menu

| Button | Icon | What It Does |
|---|---|---|
| Grab | 📋 | Copies ticket number + short description + SN link to clipboard |
| Save | 💾 | Copies a clean filename (ticket number + short description, invalid chars stripped) |
| Copy | 📄 | Copies ticket number + short description + link (shorter format) |
| Email | ✉️ | Copies a pre-formatted email template with ticket details |
| Clean | 🧹 | Reformats the description field with structured sections (Additional Info Needed / Original Description) and title-cases the short description |
| Triage | 🏷️ | Populates ticket fields from Triage Tagger payload (short description, description, MyChart field, configuration item, and applies labels via API) |
| TaskMaster | 🎨 | Color-codes the current list view by Order field |
| Stale Check | ⏰ | Finds Blocked tickets (Order 50–59) not updated in 7+ days and offers to move them to Update Needed |
| PC Review | 📊 | Opens Post-Meeting Review overlay |
| PC Approval | 🏛️ | Opens PC Approval overlay for the current ticket |
| Triage Tagger | ⚙️ | Opens the Triage Tagger in a popup window |

The menu uses `flex` layout with `overflow-x: auto` so it scrolls horizontally if the browser is narrow. Each button has `flex-shrink: 0` to prevent truncation.

### How the Menu Loads External Tools

Three tools are too large to embed in the menu script, so they're loaded dynamically:

```javascript
// Pattern used for TaskMaster, PC Review, and PC Approval
var s = document.createElement('script');
s.src = 'https://dneeds52.github.io/snow-helper/snow-helper-taskmaster.js?' + Date.now();
document.body.appendChild(s);
```

The `Date.now()` cache-buster ensures the latest version is always loaded.

The Triage Tagger opens as a popup window via `window.open()` since it's a full HTML page.

---

## Individual Bookmarklets

Each tool is also available as a standalone bookmarklet (listed on the main dashboard page). These are useful if you only want one specific tool without the full menu.

### TaskMaster

**File:** `snow-helper-taskmaster.js` (also available as inline bookmarklet `TM_HREF`)
**Works on:** ServiceNow list views (`task_list.do`)

Scans every row in a ServiceNow list view table, finds the ticket number column, the short description column (always the next column after number), and the Order column (a small integer in a right-aligned cell). Based on the Order field's tens digit, it:

1. Colors the short description cell's background and text
2. Prepends a label like `[Update Needed]` or `[ASAP PC]`
3. Truncates descriptions longer than 90 characters with a tooltip
4. Fires a confetti animation on completion

### Email Template

**Variable:** `EM_HREF` (inline bookmarklet)
**Works on:** Open ServiceNow ticket (SCTASK, INC, or CHG)

Reads the ticket's requester, number, short description, description, request number (for SCTASKs), and sys_id. Builds a formatted email template:

```
SUBJECT: REQ0012345 / SCTASK0067890 Short Description Here

Hi FirstName!

=== EMAIL INTRO GOES HERE ===

________________________________________

SCTASK0067890 Short Description Here
https://umassmemorial.service-now.com/nav_to.do?uri=sc_task.do?sys_id=abc123

Description:

[original description]
________________________________________
```

Copies the full template to clipboard.

### Clean Ticket

**Variable:** `CLEAN_HREF` (inline bookmarklet)
**Works on:** Open ServiceNow ticket (SCTASK, INC, or CHG)

Reformats the ticket's description field by prepending structured sections:

**For SCTASKs and INCs:**
```
--- ADDITIONAL INFO NEEDED ---
Department:
Epic Security Template:
Steps To Reproduce:
  1.
  2.
  3.
[Error Message / Users Affected for INCs]

--- ORIGINAL DESCRIPTION ---
[original text preserved below]
```

**For CHGs:**
```
--- ADDITIONAL INFO NEEDED ---
OneNote Documentation:
Workflow:
  1.
  2.
  3.
Rollback Plan:

--- ORIGINAL DESCRIPTION ---
[original text preserved below]
```

Also title-cases the short description.

### Stale Check

**Variable:** `STALE_HREF` (inline bookmarklet)
**Works on:** Any ServiceNow page (uses `g_ck` token)

Queries the SN REST API for tickets in the team's assignment group with Order 50–59 (Blocked) that haven't been updated in 7+ days. Shows a confirmation dialog listing the stale tickets. If confirmed, moves them all to Update Needed (changes Order tens digit from 5 to 1, preserving the ones digit).

### Copy Ticket

**Variable:** `COPY_HREF` (inline bookmarklet)
**Works on:** Open ServiceNow ticket

Copies a short reference format to clipboard:
```
SCTASK0067890 Short Description Here
https://umassmemorial.service-now.com/nav_to.do?uri=sc_task.do?sys_id=abc123
```

### PC Approval

**File:** `snow-helper-council.js` (loaded via `CA_HREF` bookmarklet)
**Works on:** Open ServiceNow ticket (needs `g_form`)

Creates a draggable overlay (420px wide, positioned center-top) for tracking per-site approvals on a ticket. Features:

- Displays ticket number and short description from `g_form`
- Shows 9 site checkboxes as styled chip labels: UNV, MEM, MARL, HALC, CLIN, HHSB, HHWEB, MRMC, NV
- Counter shows checked/total with color coding: gray (0), yellow (some), green (all)
- **All** button — checks all sites
- **Clear** button — unchecks all sites
- **Copy** button — copies a formatted summary to clipboard:
  ```
  PC Approval — SCTASK0067890 Short Description
  ✓ Approved: UNV, MEM, MARL
  ✗ Pending:  HALC, CLIN, HHSB, HHWEB, MRMC, NV
  3/9 sites approved
  ```
- **Work Note** button — writes the same summary into the ticket's work_notes field via `g_form.setValue()`
- Confetti animation when all 9 sites are approved
- Draggable by the header bar
- Toggle: clicking the bookmarklet again removes the overlay

### PC Review (Post-Meeting Review)

**File:** `snow-helper-pc-review.js` (loaded via `PC_HREF` bookmarklet)
**Works on:** Any ServiceNow page (uses `g_ck` token for API calls)

Creates a full-screen dark overlay for reviewing tickets after team meetings. Features:

- **Two tabs:** ASAP PC (Order 80–89) and Discuss / Office Hours (Order 30–39)
- Queries the SN REST API for sc_task, incident, and change_request tables filtered by the team's assignment group and the active Order range
- Shows ticket count, each ticket's number, assignee, short description, state, order value, last updated date, and a link to open it
- **Select All** checkbox
- **Move to Update Needed** button — changes Order tens digit to 1 (preserving ones digit) via PATCH API calls
- Grayed-out visual feedback on moved tickets
- **Refresh** button to re-query

---

## Triage Tagger

**File:** `snow-helper-triage-tagger.html`
**Access:** Popup window launched from the All-in-One Menu (gear icon) or directly at the GitHub Pages URL

A structured triage tool for standardizing ticket short descriptions and applying ServiceNow labels. Designed to work alongside the "SN Fill Triage" bookmarklet.

### Workflow

1. **Paste** the ticket's original short description / description text
2. The tool **auto-suggests** a topic tag and site based on keyword matching (regex rules against a validated 6,874-ticket dataset)
3. **Pick topic tags** — organized by color-coded groups that map to team members:
   - Green (David): 3rd Party, AVS, DC Help, Mobile Devices, Order, Printing, Quick Lists, Rover, weblinks
   - Blue (Darcy): Beds, BPA, Flowsheet, Narrator, Navigator, OPA, Rule, Storyboard, Track Board
   - Pink (Kelsy): Dispo, Inbasket, Notes, Workspace
   - Orange (Kelsy+): BCA, Report, Security - ASAP
   - Yellow: ASAP GAP
   - White (Council): ASAP PC
   - Light Blue (Gui/global): DC Move, State
   - None (Fallback): Other
4. The first tag selected becomes the **primary tag** (starred); additional tags are extra SN labels
5. **Pick a site** (UNV, MEM, MARL, etc.)
6. **Pick an action** (Add, Remove, Update, Fix, Grant, Build, Investigate)
7. **Add detail** (specific record, user, printer, or workflow)
8. **Preview** the formatted short description: `[Topic] Site — Action Detail`
9. **Copy short description** to clipboard

### Description Builder

Below the short description builder, there's a structured description builder with four fields:
- **CURRENT** — what's happening now (exact error text)
- **EXPECTED** — what should happen instead
- **WHO / WHERE** — users, roles, sites, workstation/printer IDs, patient example
- **RECORDS** — Epic record IDs (template, OSQ, LVN, LPP...)

You can copy just the description, or copy a **payload** for the SN Fill Triage bookmarklet (which fills the ticket's fields automatically).

### Companion Bookmarklets

The Triage Tagger page includes setup instructions for three companion bookmarklets:

1. **SN Grab Ticket** — copies the open ticket's short description + description, ready to paste into the Triage Tagger
2. **SN Save Ticket** — copies a clean filename (ticket number + short description)
3. **SN Fill Triage** — fills short description, description, MyChart field, configuration item, and applies the selected labels to the ticket via the ServiceNow REST API

### Tag-to-CI Mapping

The primary tag determines the Configuration Item set on the ticket. Defaults to "Epic - ASAP" unless overridden in the `TAG_TO_CI` config.

### Assignee Suggestion

Each color group has a default owner (configurable in `GROUP_NAMES`). When a tag is selected, the suggested assignee is shown. Per-tag overrides are possible via `ASSIGN_OVERRIDES`.

### Team Routing Warnings

Some tags trigger routing warnings (configurable in `TEAM_ROUTES`), e.g., "Printing" shows a note about routing physical hardware issues to Field Services.

---

## Main Dashboard

**File:** `snow-helper.html`
**URL:** [dneeds52.github.io/snow-helper/](https://dneeds52.github.io/snow-helper/)

The home page serves as a reference hub and setup guide. It has a sidebar navigation and several content sections:

### Sidebar

- Links to each page section
- Triage Tagger launcher (opens as popup)
- On-call schedule (shows current week with today highlighted)
- Team members list (stored in localStorage, editable)

### Content Sections

1. **All-in-One Menu** — setup instructions and the bookmarklet code to copy
2. **Individual Bookmarklets** — cards for each standalone bookmarklet (TaskMaster, Email Template, Clean Ticket, PC Review, PC Approval, Stale Check, Copy Ticket) with copy buttons
3. **Order Mapping Legend** — visual reference for the Order field color/category system
4. **Email Template Builder** — interactive form for composing ticket-related emails without needing the bookmarklet (supports SCTASK, INC, and CHG types)
5. **Triage Process Guide** — expandable accordion sections walking through the triage workflow step by step
6. **SN Filters Quick Reference** — commonly used ServiceNow filter queries

### Features

- **Timer** in the header (start/stop/reset) — for tracking time spent on triage
- **Random motivational phrase** on page load ("You're Awesome!", "Crushing It!", etc.)
- **Dark theme** throughout (matches the SN overlay tools' aesthetic)
- **Persistent schedule** saved to localStorage

---

## Upgrade Dashboard

**File:** `upgrade-dashboard.html`
**URL:** [dneeds52.github.io/snow-helper/upgrade-dashboard.html](https://dneeds52.github.io/snow-helper/upgrade-dashboard.html)

A standalone project-tracking dashboard for Epic software upgrades. This is separate from the ServiceNow tools — it's a local-first project management page.

### Features

- **Multiple upgrade tracking** — year-strip at top lets you switch between upgrades (e.g., annual Epic releases)
- **Milestones** — date-based timeline with past/next indicators
- **Progress rings** — visual completion percentages
- **Kanban board** — four-column task board (To Do, In Progress, Blocked, Done) with drag support
- **Change management tracking** — associated change tickets
- **Links management** — categorized reference links per upgrade
- **Dark/light theme toggle**
- **Import/Export** — JSON-based backup and restore
- **All data stored in localStorage** — no server, no account needed

---

## Technical Architecture

### Authentication

All ServiceNow API calls use the `g_ck` token, which is ServiceNow's built-in CSRF protection token available on any authenticated SN page. The tools grab it from `window.g_ck` (or search iframes if not found on the main window). No separate login is needed — if you're logged into ServiceNow, the tools work.

### API Calls

The tools use the ServiceNow REST API (`/api/now/table/`) for:

- **GET** queries with `sysparm_query` filters (assignment group, order ranges, active status)
- **PATCH** updates to ticket fields (primarily the Order field)

Three ticket tables are queried: `sc_task`, `incident`, `change_request`.

### Bookmarklet Pattern

Two patterns are used:

1. **Inline bookmarklets** (TaskMaster, Email, Clean, Stale, Copy) — the full JavaScript is URL-encoded in the bookmark URL. These are self-contained but harder to update (users must re-copy the bookmarklet).

2. **Script-loading bookmarklets** (All-in-One Menu, PC Approval) — the bookmark just creates a `<script>` tag pointing to GitHub Pages:
   ```javascript
   javascript:void(function(){
     var d = document;
     if(d.getElementById('overlayId')) return d.getElementById('overlayId').remove();
     var s = d.createElement('script');
     s.src = 'https://dneeds52.github.io/snow-helper/filename.js?' + Date.now();
     d.body.appendChild(s);
   }())
   ```
   These auto-update when the hosted file changes. The `Date.now()` cache-buster prevents stale cached versions.

### Form Interaction

Tools that interact with the current ticket use ServiceNow's `g_form` API:
- `g_form.getValue('field_name')` — read field values
- `g_form.setValue('field_name', value)` — write field values (e.g., work_notes)

### Label/Tag Application

The Triage Tagger's Fill bookmarklet applies ServiceNow labels via the REST API, using predefined owner sys_ids: `5bcef6801bfb4950d96b531b234bcbb3,542e894edbddaa00cdb372fc0f961903,...`

### Styling

All overlay tools use a consistent dark theme:
- Background: `#0f0f1a`
- Surface: `#1a1a2e`
- Border: `#2a2a3e`
- Text: `#e2e8f0`
- Accent colors: purple (`#a78bfa`), cyan (`#67e8f9`), green (`#34d399`), amber (`#f59e0b`)

Text sizing uses explicit pixel values (12–22px range) rather than rem units, to match ServiceNow's native form text regardless of browser zoom level.

### Confetti

Nearly every tool fires a confetti animation on completion — 30 small colored particles that fly outward and fade. It's become a signature UX element across the suite.

---

## Deployment

1. Push changes to the `main` branch of the GitHub repository
2. GitHub Pages automatically serves the updated files at `dneeds52.github.io/snow-helper/`
3. Script-loading bookmarklets (Menu, PC Approval) pick up changes immediately (cache-busted)
4. Inline bookmarklets require users to re-copy the updated code from the dashboard

No build step, no bundler, no dependencies. Every file is plain HTML/CSS/JS.

---

## Adding a New Tool

To add a new tool to the suite:

1. **Write the script** as an IIFE in a new `.js` file (follow the pattern in `snow-helper-council.js` or `snow-helper-taskmaster.js`)
2. **Add a `loadScript()` call** in `snow-helper-menu.js` to load it from the toolbar
3. **Add a standalone bookmarklet** variable in `snow-helper.html` (either inline or script-loading)
4. **Add the HTML card** in the individual bookmarklets section of `snow-helper.html`
5. **Update the `cpybm()` function** in `snow-helper.html` to handle the new key
6. **Push to GitHub** — the menu will automatically show the new button, and the dashboard will have the new bookmarklet card

---

## Configuration Reference

### `snow-helper-menu.js`

- `tools` array — defines toolbar buttons (name, icon, color, function)
- `Q` — assignment group sys_id
- `loadScript()` calls — external tool URLs

### `snow-helper-taskmaster.js`

- `styles` object — Order digit to color/label mapping

### `snow-helper-council.js`

- `SITES` array — the 9 sites for PC Approval checkboxes

### `snow-helper-triage-tagger.html`

- `GROUP_NAMES` — color group to team member mapping
- `ASSIGN_OVERRIDES` — per-tag assignee overrides
- `TEAM_ROUTES` — routing warning messages per tag
- `FILL_EXTRAS` — extra SN fields set by the Fill bookmarklet
- `TAG_TO_CI` — tag to Configuration Item mapping
- `DEFAULT_CI` — fallback CI ("Epic - ASAP")
- `TAGS` array — all tags with colors and groups
- `TOPIC_RULES` — keyword regex patterns for auto-suggesting topics
- `SITE_RULES` — keyword regex patterns for auto-suggesting sites
- `SITES`, `ACTIONS` — dropdown options

### `snow-helper-pc-review.js`

- `Q` — assignment group sys_id
- `rng` — Order ranges for each tab (`pc: '80@89'`, `discuss: '30@39'`)
