---
name: Triparr Visual Language
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-code:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.05em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  container-max: 1440px
  gutter: 20px
---

## Brand & Style
The design system is engineered for "Technical Utility," blending the high-precision aesthetic of modern developer tools with the immersive qualities of a media hub. It prioritizes speed, reliability, and clarity, ensuring that complex data—such as bitrate, codec info, and download threading—remains accessible at a glance.

The visual style is a hybrid of **Minimalism** and **Modern Corporate**, utilizing heavy whitespace (or "darkspace"), precise geometry, and subtle interactive affordances. The goal is to evoke a sense of high-performance infrastructure that feels invisible until needed.

## Colors
The palette is rooted in a deep charcoal foundation to minimize eye strain during long-tail media management sessions.

- **Surface Layers:** The background uses `#0A0A0A`. Elevated surfaces (cards, modals) transition to `#171717` and `#262626` to create depth without relying on traditional shadows.
- **Brand Action:** "Debrid Blue" (`#3B82F6`) is reserved for primary actions, progress bars, and active states.
- **Semantic Feedback:** 
    - **Success/Completed:** Emerald (`#10B981`) indicates finished downloads or healthy server status.
    - **Warning/Processing:** Amber (`#F59E0B`) signifies active searches, indexing, or stalling.
    - **Error/Failed:** Rose (`#F43F5E`) marks failed grabs or connection timeouts.

## Typography
This design system utilizes **Inter** for all primary interface elements due to its exceptional legibility and neutral character. To reinforce the technical nature of the tool, **JetBrains Mono** is introduced for metadata, file paths, and technical specs (e.g., "1080p HEVC x265").

- **Hierarchy:** Use tight tracking on larger headlines for a "compact" tech feel.
- **Labels:** Use `label-caps` for section headers in sidebars and `label-code` for data-heavy tags.

## Layout & Spacing
The layout uses a **Fluid Grid** model with a 12-column structure for desktop and a single column for mobile. 

- **Density:** The system prioritizes high information density. Use `16px` (md) for standard padding within cards and `8px` (sm) for internal element grouping.
- **Breakpoints:**
    - Mobile: < 640px (Margins: 16px)
    - Tablet: 640px - 1024px (Margins: 24px)
    - Desktop: > 1024px (Margins: Auto, max-width 1440px)

## Elevation & Depth
Depth is communicated through **Tonal Layers** rather than heavy shadows. 

- **Level 0 (Base):** `#0A0A0A` – Main application background.
- **Level 1 (Surface):** `#171717` – Cards, sidebar, and navigation bars. Use a subtle `1px` border of `#262626` to define edges.
- **Level 2 (Overlay):** `#262626` – Modals, dropdowns, and tooltips. These should feature a soft `20px` shadow with 40% opacity black to separate them from the Level 1 surface.
- **Interactive:** Hover states on cards should slightly brighten the background color or intensify the border contrast.

## Shapes
The shape language is "Soft" yet disciplined. 

- **Components:** Standard buttons and input fields use a `4px` (0.25rem) radius to maintain a professional, sharp appearance. 
- **Media Containers:** Movie posters and card wrappers use `8px` (0.5rem) to feel more approachable and distinct from the structural UI.
- **Progress Bars:** Use fully rounded ends (pill-shaped) to distinguish them from structural layout containers.

## Components
- **Buttons:** Primary buttons use a solid Debrid Blue fill with white text. Secondary buttons use a ghost style (border only) or a subtle grey fill (`#262626`).
- **Media Cards:** Feature a vertical aspect ratio for posters. On hover, display a subtle overlay with technical metadata (Resolution, Size, Seeders).
- **Progress Indicators:** Linear bars for downloads. Use the semantic colors: Blue (Active), Emerald (Finished), Rose (Error). Background track should be `#1F1F1F`.
- **Input Fields:** Dark backgrounds (`#0F0F0F`) with a `1px` border of `#262626`. On focus, the border transitions to Debrid Blue.
- **Status Chips:** Small, condensed pills using low-opacity backgrounds of the semantic color with high-opacity text (e.g., 10% Emerald background with 100% Emerald text).
- **Data Tables:** For file lists, use a "no-border" approach, opting for subtle row-striping (`#121212`) and clear JetBrains Mono labels for file sizes.