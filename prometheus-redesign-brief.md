# Prometheus — Design brief

## Concept

Prometheus is a household finance tracker. The name references Prometheus, Titan of fire, and also one of Saturn's moons — the design should nod to both without being literal or cartoonish (no illustrated flames or planets). Think: dark, calm, "night sky," with one warm accent color standing in for fire against the dark.

## Theme

- Dark mode by default (light mode not required).
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

## Layout

The Month dashboard's layout is settled in [ADR-0010](./docs/adr/0010-month-dashboard-layout.md): a pinned left rail (Leftover Balances, review meter, Month facts), Expenses in the centre, Income and Savings Goals on the right, with the Month's name centred in the header. Panels are flat surfaces separated by hairlines, and a Month fits one desktop window.

## Typography & components

- Clean sans-serif. Two weights only: regular for body/labels, medium (500) for headings and key numbers.
- Small-caps or letter-spaced uppercase for section labels (e.g. "Active this month").
- Corner radius: 12px on cards, 8-10px on smaller controls.
- Borders: 0.5px hairlines, not shadows, to separate elements.
- Icons: simple outline style, used sparingly (calendar, flag, chevrons, section icons in nav).
