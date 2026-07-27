# Prometheus — UI redesign brief

This is a visual and structural redesign pass on the existing MVP. Data model, calculations, and existing functionality should not change — this is about how it looks and how the pages are organized. Apply changes incrementally (one section/page at a time) rather than all at once, so each can be reviewed before moving on.

## Concept

Prometheus is a household finance tracker. Name reference: Prometheus, Titan of fire, and also one of Saturn's moons — the design should nod to both without being literal or cartoonish (no illustrated flames or planets). Think: dark, calm, "night sky," with one warm accent color standing in for fire against the dark.

## Theme

- Dark mode by default (light mode not required for this pass).
- Overall mood: calm, minimal, similar to Copilot Money or YNAB — flat surfaces, no gradients or heavy shadows, generous padding, thin hairline borders instead of visual clutter.

## Color palette

| Role | Color | Usage |
|---|---|---|
| Page background | `#12141C` | outermost background |
| Card surface | `#1A1D28` | cards, panels |
| Border / hairline | `#262A38` | 0.5px borders between/around elements |
| Text primary | `#F0F1F5` | headings, key numbers |
| Text secondary | `#8B92A5` | supporting text |
| Text muted | `#6B7280` | labels, captions, placeholders |
| Accent — primary ("fire") | `#E8935C` / `#F0A868` | primary actions, key totals (e.g. leftover), "+Add" links, active nav item |
| Accent — secondary ("moon/ice") | `#7DC9E8` | used sparingly — goal progress rings, subtle highlights only. Not a general-purpose color. |

## Typography & components

- Clean sans-serif. Two weights only: regular for body/labels, medium (500) for headings and key numbers.
- Small-caps or letter-spaced uppercase for section labels (e.g. "Active this month").
- Corner radius: 12px on cards, 8-10px on smaller controls.
- Borders: 0.5px hairlines, not shadows, to separate elements.
- Icons: simple outline style, used sparingly (calendar, flag, chevrons, section icons in nav).

## Thematic details

- Small ringed-planet mark next to the "Prometheus" wordmark in the header (a simple circle with a thin surrounding ellipse — not a literal illustrated planet).
- Goal progress shown as circular "orbit" rings rather than horizontal progress bars — a recurring motif for progress states generally, not just goals.

## Month selector (top of page)

Replace the current three-separate-controls layout with a single grouped pill:

- Prev/next chevrons and the month label (e.g. "July 2026", not "2026-07") combined into one pill-shaped control with a small calendar icon.
- Add a "Today" quick-jump button next to it.
- Replace the bare "YYYY-MM" input + "Go" button with an inline search-style field ("Jump to YYYY-MM") with a search icon, no separate button.
- Add a visual divider, then the "goal(s) pending" badge on the right with a flag icon — should read as a distinct status indicator, not something floating unrelated in the bar.

## Layout & information architecture

Move from a single long page to a **persistent left sidebar + focused main content area** (same pattern as YNAB/Copilot), so each feature has room to grow as more are added later.

**Sidebar sections:**
1. Overview (default landing page)
2. Income
3. Expenses
4. Goals
5. Members (lower priority — could live under Settings instead if preferred)
6. Settings

**Overview page** — read-only glance, no editing controls:
- Month selector bar (as redesigned above)
- Balance cards per member + household total
- Active expenses summary
- Goal progress at a glance (orbit rings)
- Leftover breakdown per member (income − shares − goals = leftover)

**Income / Expenses / Goals / Members pages** — each houses its own full management UI (the add/edit/rename/end controls currently crammed into the dashboard). These can grow independently (e.g. Expenses could later add filters, categories, history) without affecting Overview's layout.

**Decision on quick-add:** no quick-add / shortcut actions on the Overview page for now. Keep one entry point per action (its dedicated page) rather than duplicating add-flows in two places. Revisit only if usage shows one specific action (most likely "add expense") is frequent enough to deserve a global shortcut later.

## Wireframes (text reference)

These are rough layout sketches to convey structure and spacing since no image is being shared.

### Month selector bar

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────┐   ┌───────┐  │  🔍 Jump to YYYY-MM    │
│  │ ◀  📅 July 2026  ▶       │   │ Today │  │              🚩 1 goal │
│  └──────────────────────────┘   └───────┘  │              pending  │
└─────────────────────────────────────────────────────────────────────┘
```
- Left cluster: chevron/label/chevron grouped in one bordered pill (rounded ~10px), with a calendar icon before the label.
- "Today" is a separate ghost button right next to the pill.
- Vertical divider, then an inline search-style jump field (icon + placeholder text, no separate box or button).
- Right-aligned: goal-pending badge, pill-shaped, flag icon, warm accent background/text.

### Overall page layout (sidebar + Overview)

```
┌────────────┬──────────────────────────────────────────────────────┐
│ Prometheus │  [month selector bar — full width of content area]   │
│            │                                                      │
│ ▸Overview  │  ┌───────────┐ ┌───────────┐ ┌───────────┐          │
│  Income    │  │ Augusto   │ │João Vitor │ │ Household │          │
│  Expenses  │  │ R$1,962   │ │ R$4,053   │ │ R$6,015   │          │
│  Goals     │  └───────────┘ └───────────┘ └───────────┘          │
│  Members   │                                                      │
│            │  ┌────────────────────┐ ┌────────────────────┐      │
│            │  │ Active expenses    │ │ Goal progress       │      │
│            │  │ Full rent R$4,342  │ │ ◔ Travel Júlia 10%  │      │
│            │  └────────────────────┘ └────────────────────┘      │
│  Settings  │                                                      │
└────────────┴──────────────────────────────────────────────────────┘
```
- Sidebar: fixed width (~200px), icon + label per item, active item highlighted with accent-tinted background and accent text color.
- Main content: month selector full-width at top, then a 3-column row of balance cards, then a 2-column row of summary cards below.
- Settings pinned to the bottom of the sidebar, separated from the main nav items.

### Leftover breakdown (per member, side by side on Overview or its own section)

```
Augusto                          João Vitor
Income          R$3,890.00       Income          R$6,818.00
− Shares        R$1,577.41       − Shares        R$2,764.73
− Goals         R$350.00         ─────────────────────────
─────────────────────────        = Leftover      R$4,053.27
= Leftover      R$1,962.59
```
- Simple right-aligned number columns, hairline divider before the final "= Leftover" line, that line in the accent color and medium weight to stand out from the rest.
