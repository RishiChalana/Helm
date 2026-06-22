---
name: Helm
colors:
  surface: '#0e1511'
  surface-dim: '#0e1511'
  surface-bright: '#333b36'
  surface-container-lowest: '#09100c'
  surface-container-low: '#161d19'
  surface-container: '#1a211d'
  surface-container-high: '#242c27'
  surface-container-highest: '#2f3632'
  on-surface: '#dde4dd'
  on-surface-variant: '#bbcac0'
  inverse-surface: '#dde4dd'
  inverse-on-surface: '#2b322e'
  outline: '#85948b'
  outline-variant: '#3c4a42'
  surface-tint: '#45dfa4'
  primary: '#5af0b3'
  on-primary: '#003825'
  primary-container: '#34d399'
  on-primary-container: '#00563b'
  inverse-primary: '#006c4b'
  secondary: '#dcc66e'
  on-secondary: '#3a3000'
  secondary-container: '#615200'
  on-secondary-container: '#dbc66d'
  tertiary: '#ffcace'
  on-tertiary: '#67001f'
  tertiary-container: '#ffa1ab'
  on-tertiary-container: '#8e1e37'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#68fcbf'
  primary-fixed-dim: '#45dfa4'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#f9e287'
  secondary-fixed-dim: '#dcc66e'
  on-secondary-fixed: '#221b00'
  on-secondary-fixed-variant: '#534600'
  tertiary-fixed: '#ffdadc'
  tertiary-fixed-dim: '#ffb2b9'
  on-tertiary-fixed: '#400010'
  on-tertiary-fixed-variant: '#891933'
  background: '#0e1511'
  on-background: '#dde4dd'
  surface-variant: '#2f3632'
typography:
  display-xl:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-xl-mobile:
    fontFamily: Playfair Display
    fontSize: 36px
    fontWeight: '400'
    lineHeight: '1.2'
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '400'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '300'
    lineHeight: '1.6'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '300'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.15em
  data-mono:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 40px
  section-gap: 64px
  element-gap: 24px
  gutter: 16px
---

## Brand & Style

The design system embodies a "Private Wealth meets Meditation" ethos—a serene, high-end editorial environment for personal finance. It targets high-net-worth individuals or those seeking a disciplined, calm relationship with their capital. 

The aesthetic is **Minimalist-Editorial**. It prioritizes extreme negative space as a functional tool to reduce cognitive load during financial decision-making. The UI should feel like a premium physical ledger or an invitation-only digital gallery. Visual hierarchy is established through precise typography and monochromatic layering rather than heavy shadows or vibrant pops of color. Every element is deliberate, quiet, and architecturally structured.

## Colors

The palette is rooted in a deep, near-black foundation to provide a sense of infinite depth and stability. 

- **Foundation:** Background `#0e1511` — a deep forest-green near-black that anchors every surface.
- **Surfaces:** Four elevation steps: `T.card` (#161d19) → `T.surface` (#1a211d) → `T.panel` (#242c27). All via value shift, never shadows.
- **Accents:** Treated as "washes" or "glints" rather than solid fills.
    - **Muted Emerald `#5af0b3`:** Growth, positive balances, credits, secure states.
    - **Warm Gold `#dcc66e`:** Goals, premium insights, near-budget warnings (>80%).
    - **Muted Coral `#ffb4ab`:** Debits, alerts, over-budget states (>100%).
- **Borders:** `T.border` (#2f3632) for dividers; `T.borderHi` (#3c4a42) for focus rings. No rgba tricks needed — the green-tinted dark values read as subtle without opacity.

## Typography

Typography is the primary engine of the design system's luxury feel. 

- **Editorial Flourish:** Use **Playfair Display** for large currency amounts, account headings, and section titles. It should feel literary and authoritative.
- **Technical Precision:** Use **Geist** for all functional data, body copy, and labels. Its clean, technical nature balances the traditional feel of the serif.
- **Micro-Labels:** Use the `label-caps` style for section headers and metadata. The wide tracking (15%) is essential for the high-end, airy aesthetic.
- **Data Display:** For transaction lists, use `data-mono` (Geist's naturally clean terminals) to ensure numerical alignment and readability.

## Layout & Spacing

This design system utilizes a **Fixed Grid** model on desktop (max-width 1200px) and a **Fluid Grid** on mobile.

- **Negative Space:** Spacing is intentionally oversized. Avoid crowding elements. If a section feels "full," increase the `section-gap`.
- **The Golden Ratio:** Use 40px (10 units) for primary container padding to create a luxurious frame around content.
- **Mobile Reflow:** On mobile devices, margins reduce to 20px, and large display serifs scale down to ensure they do not wrap awkwardly.
- **Alignment:** Content should strictly follow a 12-column grid. Elements like "Total Balance" should occupy center-stage with massive vertical clearance (80px+) from the navigation and subsequent lists.

## Elevation & Depth

Depth is conveyed through **Low-Contrast Outlines** rather than shadows. 

- **Surface Tiering:** Four discrete levels: `T.bg` → `T.card` → `T.surface` → `T.panel`. Elevation is always a value shift, never a shadow.
- **Borders:** 1px `T.border` (#2f3632) for structural dividers. 1px `T.borderHi` (#3c4a42) for interactive focus states.
- **Zero Shadow Policy:** No drop shadows anywhere. Contrast is achieved through value shifts and borders only.
- **Glassmorphism:** Not used — backdrop-blur is unreliable across React Native versions. Avoid.

## Shapes

The geometry is architectural and sharp. 

- **Primary Radius:** Use a "Soft" radius of `4px` (`rounded-sm`) for cards and buttons. This provides just enough approachable warmth without losing the professional, structural edge.
- **Internal Elements:** Checkboxes and small inputs should remain at `2px` or `4px`.
- **Strict Prohibition:** Never use pill shapes or circular buttons (unless for icon-only actions). Rectilinear forms are required to maintain the editorial "grid" look.

## Components

- **Buttons:** Primary CTA — solid `T.emerald` background, `T.textInverse` label in `label-caps`. Secondary — `1px T.border`, transparent background. Destructive — `1px T.coral`, transparent background. Radius: `4px`.
- **Cards:** `T.card` background, `1px T.border` border, `4px` radius. Card section headers in `label-caps` (`F.sansMedium`, 11pt, 1.65 tracking) with `T.textDim` color.
- **Inputs (modal):** Full-border `T.card` background, `1px T.border`. No bottom-border-only inputs in the current screens — that style is reserved for the auth flow.
- **Lists:** Transaction rows at 16px vertical padding. `1px T.border` bottom divider spanning full width. Merchant/title in `F.mono` 14pt; category + date in `label-caps` `T.textDim`; amount in `F.mono` 14pt colored `T.coral` (debit) or `T.emerald` (credit).
- **Budget bars:** Full-width progress bar colored by pace: `T.emerald` (≤80%), `T.gold` (>80%), `T.coral` (over budget). Bar container is `T.surface`.
- **Charts:** 22-day cashflow using @shopify/react-native-skia. 1.5px line, `T.emerald` color. Area fill: emerald at 15% → 0% opacity. Axes and labels in `T.textDim`.
- **Proposal cards:** Inline in chat thread. Emerald border-left accent. Action buttons side-by-side: CONFIRM (solid emerald) / DISMISS (outline coral). After action, card collapses to a single status line.
- **Navigation:** Tab bar with `T.border` top edge. Active tab icon in `T.emerald`; inactive in `T.textDim`.

---

## React Native Implementation

All tokens are codified in `mobile/lib/design.ts` and imported as `T` (colors) and `F` (font families).

### Token map

| Design token | `T` key | Value |
|---|---|---|
| background | `T.bg` | `#0e1511` |
| surface-container-low | `T.card` | `#161d19` |
| surface-container | `T.surface` | `#1a211d` |
| surface-container-high | `T.panel` | `#242c27` |
| outline-variant | `T.border` | `#2f3632` |
| outline | `T.borderHi` | `#3c4a42` |
| on-surface | `T.textPrimary` | `#dde4dd` |
| on-surface-variant | `T.textSecondary` | `#bbcac0` |
| outline (dim) | `T.textDim` | `#85948b` |
| inverse-on-surface | `T.textInverse` | `#2b322e` |
| primary | `T.emerald` | `#5af0b3` |
| secondary | `T.gold` | `#dcc66e` |
| error | `T.coral` | `#ffb4ab` |

### Typography scale

| Style | Font | Size | Weight | Letter spacing |
|---|---|---|---|---|
| Display / hero amounts | `F.serif` (Playfair Display 400) | 36–40pt | Regular | — |
| Section headings | `F.serifMedium` (Playfair Display 500) | 24pt | Medium | — |
| Body copy | `F.sans` (Geist 300 Light) | 14–16pt | Light | — |
| Caps labels | `F.sansMedium` (Geist 500 Medium) | 11pt | Medium | 1.65pt |
| Data / numbers | `F.mono` (Geist 400 Regular) | 14pt | Regular | — |

### Critical rule — NativeWind 4.x on Android

**Never** put a custom-font NativeWind class (`font-serif`, `font-mono`, `font-sans`, `font-sans-medium`) and an inline `style` prop on the same `<Text>` component. NativeWind 4.x + Hermes crashes silently — expo-router's error boundary swallows it and renders a blank screen.

**Pattern to use:**
```tsx
// ✅ correct — pure inline style
<Text style={{ fontFamily: F.serif, fontSize: 36, color: T.textPrimary }}>
  ₹1,00,000
</Text>

// ❌ crashes on Android
<Text className="font-serif text-display" style={{ color: T.emerald }}>
  ₹1,00,000
</Text>
```

NativeWind layout classes on `<View>` components are safe.