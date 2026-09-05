# CRM 3S — Design system reference

Reverse-engineered from the live app at `people.techcoop.vn/3s` on 3 Sep 2026.
Pages inspected: `projects`, `operation-report`, `weekly-report`,
`service-performance`, `compliance-tracker`, `tickets`.

Companion files:

- `crm3s-design-tokens.css` — all 594 tokens, ready to import
- `tailwind.config.js` — Tailwind v3 config wired to those tokens

---

## 1. What the app is built on

| Layer | What it is |
|---|---|
| Backend | Frappe app `techcoop_frappe` |
| Frontend | Vue 3 SPA served at `/3s`, bundle `crm3s` |
| UI kit | **frappe-ui v2** (`fui-` component classes, Espresso token names) |
| CSS | Tailwind v4 |
| Toasts | Sonner |
| Font | Inter, self-hosted at `/assets/techcoop_frappe/crm3s/assets/Inter-*.woff2` (9 weights + italics, plus the `InterVar` variable face) |

If you are building a sibling app, installing `frappe-ui` gets you this
token system for free. These files exist for the case where you want the
same visual language *outside* the Frappe stack.

## 2. Token architecture

Three semantic namespaces, each with a neutral ramp plus 11 hue ramps:

```
--ink-*      text and icons        gray 1–9,  hues 1–10
--surface-*  backgrounds           gray 1–10, hues 1–10, + alpha ramp
--outline-*  borders and dividers  gray 1–9,  hues 1–10, + alpha ramp
```

They all resolve to a shared 12×11 base palette (`--gray-50 … --violet-950`)
declared in oklch. The mapping is offset per namespace, which is easy to get
wrong by hand:

| Token | Resolves to |
|---|---|
| `--ink-gray-1 … 9` | `gray-200 … gray-950` |
| `--surface-gray-1 … 10` | `gray-50 … gray-900` |
| `--outline-gray-1 … 9` | `gray-200 … gray-950` |
| `--ink-{hue}-1` | white |
| `--ink-{hue}-2 … 10` | `{hue}-100 … {hue}-900` |
| `--surface-{hue}-1 … 10` | `{hue}-50, {hue}-100 … {hue}-900` |
| `--outline-{hue}-1 … 10` | `{hue}-100 … {hue}-950` |

The `alpha` ramps (`--surface-alpha-gray-*`, `--outline-alpha-gray-*`) are
`oklch(0 0 0 / x)` — they tint whatever is underneath instead of painting over
it. Use them for hover states on coloured rows; use the solid ramps on white.

There is **no dark theme** on the live site. No `.dark` ruleset was served.

### Neutrals you will actually reach for

| Token | oklch | ≈ hex | Used for |
|---|---|---|---|
| `--surface-base` | `1 0 0` | `#FFFFFF` | page, cards, table |
| `--surface-sidebar` | `.979 0 0` | `#F8F8F8` | ⚠️ **KHÔNG dùng trong dự án này** — xem ghi chú §4 |
| `--surface-gray-2` | `.964 0 0` | `#F3F3F3` | input background |
| `--surface-gray-3` | `.946 0 0` | `#EBEBEB` | hover |
| `--outline-gray-2` | `.913 0 0` | `#E2E2E2` | card border |
| `--ink-gray-4` | `.683 0 0` | — | placeholder |
| `--ink-gray-5` | `.586 0 0` | `#7C7C7C` | labels, subtitles |
| `--ink-gray-8` | `.205 0 0` | `#383838` | body text |
| `--ink-gray-9` | `.168 0 0` | `#171717` | primary button fill |

Hex values are the measured sRGB conversions; oklch is the source of truth.

### Accent

The UI is monochrome except for status pills and charts. The chart ramp is
hardcoded in the app's JS, not in CSS:

`#008282` · `#006F6F` · `#24948F` · `#4AA6A0` · `#78BAB5`, axes in `#6B7280`.

Teal is effectively the brand accent. Nothing else in the chrome is coloured.

## 3. Typography

```
family:  InterVar, ui-sans-serif, system-ui, sans-serif
```

| Role | Size / line-height / weight / tracking |
|---|---|
| Label, badge, subtitle | 12 / 13.8 / 420 / 0.24 |
| Table cell | 13 / 14.95 / 400–420 / 0.26 |
| Body, buttons, inputs | 14 / 16.1 / 420 / 0.28 |
| Column header, emphasis | 14 / 16.1 / 600 / 0.21 |
| Page title, KPI number | 18 / 20.7 / 600 / 0.18 |

Two things carry most of the character:

- **Weight 420**, not 400 or 500. It is an InterVar variable-axis value.
  Rounding it to a static weight is the single fastest way to look off.
- **Line-height ≈ 1.15**, much tighter than Tailwind's default 1.5, with
  positive letter-spacing on small sizes. This is what makes the tables
  read as dense without feeling cramped.

## 4. Component recipes (measured, not guessed)

### Shell

```
┌──────────────┬──────────────────────────────────────────────┐
│ CRM3S        │ Page title                    [+ Action]     │  topbar
│              ├──────────────────────────────────────────────┤
│ Reports &    │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐          │  KPI row
│  Analytics   │  └────┘ └────┘ └────┘ └────┘ └────┘          │
│  · item      ├──────────────────────────────────────────────┤
│  · item      │  [search………………]  filter  filter  Clear       │  filter bar
│              ├──────────────────────────────────────────────┤
│ Operations   │  table                                       │
│  · item      │                                              │
│              │                                              │
│ Collapse     │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

Every one of the six pages uses this exact frame. Only Operation Report adds
a "Business Drivers" band of charts between the KPI row and the table.

| Part | Spec |
|---|---|
| **Sidebar** | width ≈ 192px, **no border**, `transition-[width] 300ms ease-in-out`, hidden below the `sm` breakpoint. Section headings 12px in sentence case; items 13–14px with 16px line icons.<br>⚠️ **Nền sidebar trong POS Ngọc Sơn là teal đậm `#033a3a`, không phải `--surface-sidebar` #F8F8F8.** Tài liệu này reverse-engineer từ CRM 3S; dự án này giữ nhận diện teal của v1 theo `phase-2.md` và `05-giao-dien.md`. Dùng biến `--sidebar*` trong `globals.css` (`bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-accent`), **không** dùng `--surface-sidebar`. |
| **Topbar** | ~48px tall, white, title 18px/600 left, primary action right. |
| **KPI card** | white, radius **12px**, border **0.8px** `outline-gray-2`, padding 16px, **no shadow**, height ≈ 73px. Label 12px `ink-gray-5`, value 18px/600, optional third line for delta or context in a status colour. |
| **Primary button** | `bg: ink-gray-9` (#171717), white text, height **28px**, padding `0 8px`, radius 8px, 14px/420, no shadow. |
| **Search input** | height 28px, radius 8px, `bg-surface-gray-2`, border 0.8px in the *same* colour as the fill, `padding-inline-start: 32px` for the icon, placeholder `ink-gray-4`. Hover → `bg-surface-gray-3` + `border-outline-elevation-2`. Focus → `--focus-default` ring. |
| **Status pill** | `rounded-full`, height **20px**, padding `0 6px`, 12px/420, border 0.8px. Colour formula: text = hue at full strength, background = hue at **11%** alpha, border = hue at **28%** alpha. Ready-made `.pill` classes are in the CSS file. |
| **Table row** | two-line primary cell — title 14px `ink-gray-8`, subline (record code + customer) 12px `ink-gray-5`. Column headers 13px with a sort chevron. Row divider 1px `outline-gray-1`. Progress shown as a thin grey track with a dark fill plus a right-aligned percentage. |
| **Avatar** | 24px circle, initial letter on `surface-gray-3`, or photo. |

### Status colour map observed in production

| State | Hue |
|---|---|
| Implementation | teal |
| Intake, Discovery | blue |
| Completed, Done | green |
| Postponed | orange |
| Overdue, Missing | red |
| Open, neutral | slate |

## 5. Rules that are easy to miss

1. **Borders are 0.8px**, everywhere. Not 1px.
2. **Cards use a border, not a shadow.** The elevation tokens are reserved for
   popovers, dropdowns and modals.
3. **Every shadow starts with `inset 0 .25px 1.5px #ffffff29`** — a white top
   highlight. Drop it and floating surfaces look flat.
4. **Controls are 28px tall**, buttons and inputs alike. This is what keeps the
   filter bar on one tight line.
5. **Radius is hierarchical**: 8px for controls, 12px for cards, full for pills.
   Do not apply one radius to everything.
6. **Filter chips are removable pills with an ×**, sitting inline with plain-text
   "All X" dropdown triggers and a plain "Clear filters" action. No button chrome.

## 6. Tailwind v4

If you are on v4, skip `tailwind.config.js` and put this next to the token
import instead:

```css
@import "tailwindcss";
@import "./crm3s-design-tokens.css";

@theme inline {
  --font-sans: InterVar, ui-sans-serif, system-ui, sans-serif;

  --color-ink-gray-5: var(--ink-gray-5);
  --color-ink-gray-8: var(--ink-gray-8);
  --color-ink-gray-9: var(--ink-gray-9);
  --color-surface-base: var(--surface-base);
  /* --color-surface-sidebar: KHÔNG map. Sidebar dùng --sidebar (teal #033a3a). */
  --color-surface-gray-2: var(--surface-gray-2);
  --color-surface-gray-3: var(--surface-gray-3);
  --color-outline-gray-1: var(--outline-gray-1);
  --color-outline-gray-2: var(--outline-gray-2);
  /* …repeat per ramp step you use, or generate the list from the token file */

  --text-base: 14px;
  --text-base--line-height: 16.1px;
  --text-base--letter-spacing: 0.28px;

  --radius-lg: 12px;
  --default-border-width: 0.8px;
}
```

`@theme inline` is required so the values stay as `var()` references rather
than being frozen at build time.

## 7. Provenance

- Colour, radius, elevation and focus tokens: read from
  `getComputedStyle(document.documentElement)` — exact values, not sampled.
- Semantic-to-base mapping: verified programmatically for the blue and green
  ramps, then applied to the remaining nine hues on the assumption the system is
  uniform. Worth spot-checking if a specific hue matters to you.
- Typography, component sizing and the pill tint formula: computed styles of the
  real rendered elements.
- Chart palette: sampled from rendered SVG fills. The app's own source constant
  may contain more entries than the five in use on the pages inspected.
