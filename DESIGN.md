---
name: AI Information Nexus
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#424754'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#727785'
  outline-variant: '#c2c6d6'
  surface-tint: '#005ac2'
  primary: '#0058be'
  on-primary: '#ffffff'
  primary-container: '#2170e4'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#6b38d4'
  on-secondary: '#ffffff'
  secondary-container: '#8455ef'
  on-secondary-container: '#fffbff'
  tertiary: '#924700'
  on-tertiary: '#ffffff'
  tertiary-container: '#b75b00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-md-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1200px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is engineered for a high-velocity AI community, blending the casual intimacy of social feeds with the curated authority of a product discovery platform. The brand personality is **Visionary, Fluid, and Accessible**. 

The visual style is a **Contemporary Corporate** aesthetic infused with **Glassmorphism** and **Soft-Tech** elements. It prioritizes clarity and whitespace to prevent information overload, ensuring that complex AI news feels digestible and engaging. The emotional response should be one of "effortless staying-informed"—a professional workspace that feels as comfortable as a personal social network.

## Colors

The palette is anchored by a **Pure White (#FFFFFF)** background to maximize legibility and "airiness." 

- **The Power Gradient:** A vibrant transition from Blue (#3B82F6) to Purple (#8B5CF6) is reserved for high-intent actions (CTAs), brand markers, and active states.
- **Neutrals:** Use a cool-toned slate palette for borders and secondary text to maintain the "tech" feel without the harshness of pure black.
- **Functional Colors:** Success (Emerald), Warning (Amber), and Error (Rose) should be used sparingly, following the same saturation levels as the primary blue to ensure harmony.

## Typography

This design system uses **Plus Jakarta Sans** for its friendly, modern geometric curves which excel in tech-focused interfaces. 

For Chinese characters, prioritize system-native sans-serif fonts (PingFang SC, Hiragino Sans GB) to ensure a professional yet non-academic tone. 
- **Hierarchy:** Use bold weights (700-800) for headlines to create strong anchors in the information flow.
- **Body Text:** Maintain a 1.5x to 1.6x line height for long-form AI summaries to ensure high readability.
- **Labels:** Use uppercase for small labels and metadata to create visual distinction from the body narrative.

## Layout & Spacing

The layout utilizes a **hybrid-fluid model**. On desktop, content is centered within a 1200px container with a 12-column grid. On mobile, it transitions to a single-column "infinite flow."

- **The Feed Column:** The primary information stream should occupy a 6-column center span (approx 680px) on desktop to mimic the focused reading experience of mobile.
- **Rhythm:** Utilize an 8px base grid. Generous vertical spacing (32px+) between feed cards is essential to maintain the "clean" aesthetic and prevent visual clutter.
- **Sidebars:** Reserve the outer columns for discovery widgets and trending tags, using "sticky" positioning to keep them accessible during long scrolls.

## Elevation & Depth

Visual hierarchy is achieved through **Soft Ambient Shadows** and **Tonal Layering** rather than heavy borders.

- **Level 0 (Background):** Pure White (#FFFFFF).
- **Level 1 (Cards/Feed Items):** White surface with a very subtle 1px border (#F1F5F9) and a soft shadow (0px 4px 20px rgba(0, 0, 0, 0.03)).
- **Level 2 (Hover/Active):** Slightly deeper shadow with a hint of primary tint (0px 10px 25px rgba(59, 130, 246, 0.08)) to indicate interactivity.
- **Overlays:** Use a background blur (12px) for navigation bars and modals to create a sense of depth and modern sophistication.

## Shapes

The shape language is defined by **Exaggerated Roundness** to evoke a friendly, community-centric feel.

- **Base Radius:** 16px for standard cards and containers.
- **Large Radius:** 24px for featured sections, profile headers, and main search bars.
- **Pill Shapes:** Always use fully rounded (999px) corners for tags, chips, and primary action buttons to make them feel "touchable" and distinct from content containers.

## Components

### Buttons
Primary buttons use the **Blue-to-Purple Gradient** with white text. Secondary buttons use a subtle light blue tint (#EFF6FF) with blue text. Transitions should be smooth (200ms) with a slight scale-up on hover (1.02x).

### Feed Cards
Cards are the core of the system. They must have 24px internal padding. The "Moment-style" interaction bar (Like, Comment, Share) should be placed at the bottom with low-contrast icons that light up in brand colors upon interaction.

### Inputs
Search bars and text fields use a subtle grey background (#F8FAFC) that turns white with a 1px primary border on focus. Use a 20px corner radius for search bars to differentiate them from square-ish content cards.

### Chips & Tags
Use soft, desaturated background colors for tags (e.g., #F1F5F9) to keep the focus on the content title. High-trending AI topics can use a "glowing" border or a subtle gradient outline.

### Loading States
Utilize "Skeleton" screens that mimic the card layout to maintain the "flow" sensation even during data fetching.