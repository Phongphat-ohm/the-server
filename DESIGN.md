---
version: alpha
name: REALMS
description: >-
  A Minecraft server hosting platform designed for Thai players, blending gaming culture with accessible cloud
  infrastructure. The brand voice is energetic yet trustworthy, targeting casual and competitive players seeking
  affordable, automated server management.
logo:
  src: https://realms.in.th/wp-content/uploads/2025/12/cropped-Untitled-design-5-300x300.webp
colors:
  surface: '#0a0e1a'
  surface-dim: '#050709'
  surface-bright: '#1a1f2e'
  surface-container-lowest: '#030507'
  surface-container-low: '#0f1419'
  surface-container: '#151b28'
  surface-container-high: '#1f2633'
  surface-container-highest: '#2a313f'
  on-surface: '#ffffff'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#f5f5f5'
  inverse-on-surface: '#1a1a1a'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#8fcdff'
  primary: '#8fcdff'
  on-primary: '#0d2a3d'
  primary-container: '#1a4d6d'
  on-primary-container: '#c6e7ff'
  inverse-primary: '#0055a8'
  secondary: '#0693e3'
  on-secondary: '#ffffff'
  secondary-container: '#0055a8'
  on-secondary-container: '#c6e7ff'
  tertiary: '#7bdcb5'
  on-tertiary: '#0d3d2a'
  tertiary-container: '#1a6d4d'
  on-tertiary-container: '#a8f5d8'
  error: '#cf2e2e'
  on-error: '#ffffff'
  error-container: '#9b0000'
  on-error-container: '#ffb4ab'
  primary-fixed: '#c6e7ff'
  primary-fixed-dim: '#8fcdff'
  on-primary-fixed: '#001d33'
  on-primary-fixed-variant: '#003d66'
  secondary-fixed: '#c6e7ff'
  secondary-fixed-dim: '#0693e3'
  on-secondary-fixed: '#001d33'
  on-secondary-fixed-variant: '#003d66'
  tertiary-fixed: '#a8f5d8'
  tertiary-fixed-dim: '#7bdcb5'
  on-tertiary-fixed: '#001d14'
  on-tertiary-fixed-variant: '#003d2a'
  background: '#0a0e1a'
  on-background: '#ffffff'
  surface-variant: '#444748'
typography:
  display:
    fontFamily: IBM Plex Sans Thai
    fontSize: 60px
    fontWeight: '700'
    lineHeight: 68px
    letterSpacing: '-0.04em'
  headline-lg:
    fontFamily: IBM Plex Sans Thai
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: '-0.02em'
  headline-md:
    fontFamily: IBM Plex Sans Thai
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: '-0.01em'
  title-lg:
    fontFamily: IBM Plex Sans Thai
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0em
  body-lg:
    fontFamily: IBM Plex Sans Thai
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0.01em
  body-md:
    fontFamily: IBM Plex Sans Thai
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.01em
  label-md:
    fontFamily: IBM Plex Sans Thai
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: IBM Plex Sans Thai
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  container-max: 1320px
elevation:
  sm: 0 1px 2px rgba(0, 0, 0, 0.06)
  md: 0 3px 8px rgba(0, 0, 0, 0.15)
  lg: 0 8px 24px rgba(0, 0, 0, 0.25)
layout:
  containerMaxWidth: 1320px
  gridColumns: 12
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.label-md}'
    rounded: '{rounded.xl}'
    padding: 8px 32px
    height: 44px
    boxShadow: 0 3px 8px rgba(0, 0, 0, 0.15)
  button-primary-hover:
    backgroundColor: '#7ab8e8'
    textColor: '{colors.on-primary}'
    boxShadow: 0 6px 16px rgba(143, 205, 255, 0.25)
  button-primary-active:
    backgroundColor: '#6aa3d3'
    textColor: '{colors.on-primary}'
  button-secondary:
    backgroundColor: transparent
    textColor: '{colors.primary}'
    typography: '{typography.label-md}'
    rounded: '{rounded.xl}'
    padding: 8px 32px
    height: 44px
    border: 2px solid {colors.primary}
  button-secondary-hover:
    backgroundColor: rgba(143, 205, 255, 0.1)
    textColor: '{colors.primary}'
  card-standard:
    backgroundColor: '{colors.surface-container}'
    rounded: '{rounded.lg}'
    padding: '{spacing.md}'
    boxShadow: '{elevation.md}'
    border: 1px solid {colors.outline-variant}
  card-hover:
    backgroundColor: '{colors.surface-container-high}'
    boxShadow: '{elevation.lg}'
  input-field:
    backgroundColor: '{colors.surface-container-low}'
    textColor: '{colors.on-surface}'
    typography: '{typography.body-md}'
    rounded: '{rounded.DEFAULT}'
    padding: '{spacing.sm}'
    border: 1px solid {colors.outline-variant}
  input-field-focus:
    backgroundColor: '{colors.surface-container-low}'
    border: 2px solid {colors.primary}
    boxShadow: 0 0 0 3px rgba(143, 205, 255, 0.1)
  badge-primary:
    backgroundColor: '{colors.primary-container}'
    textColor: '{colors.on-primary-container}'
    typography: '{typography.label-sm}'
    rounded: '{rounded.full}'
    padding: 4px 12px
  badge-success:
    backgroundColor: '{colors.tertiary-container}'
    textColor: '{colors.on-tertiary-container}'
    typography: '{typography.label-sm}'
    rounded: '{rounded.full}'
    padding: 4px 12px
  badge-error:
    backgroundColor: '{colors.error-container}'
    textColor: '{colors.on-error-container}'
    typography: '{typography.label-sm}'
    rounded: '{rounded.full}'
    padding: 4px 12px
  list-item:
    backgroundColor: transparent
    rounded: '{rounded.md}'
    padding: '{spacing.sm}'
    textColor: '{colors.on-surface}'
  list-item-hover:
    backgroundColor: '{colors.surface-container-high}'
    textColor: '{colors.primary}'
---

## Overview

REALMS is a Minecraft server hosting platform engineered for the Thai gaming community, combining accessible cloud infrastructure with gaming-native design language. The brand embodies 'Digital Vitalism'—a design philosophy that merges the blocky, modular aesthetic of Minecraft with modern UI clarity, creating an interface that feels both playful and professional. The visual identity centers on a deep-space dark theme (background #0a0e1a) punctuated by a luminous sky-blue primary accent (#8fcdff), evoking the feeling of discovering a glowing realm within darkness. Users experience the platform as energetic, trustworthy, and friction-free—a place where technical complexity dissolves into intuitive interaction.

The brand voice is conversational yet authoritative: direct, solution-oriented, and occasionally playful without sacrificing credibility. REALMS speaks to players as peers, not customers. Vocabulary emphasizes speed ('เร็วแรงทันใจ'—lightning-fast), affordability ('ราคาสบายกระเป๋า'—pocket-friendly), and community ('เล่นกับเพื่อน'—play with friends). Example sentence in brand voice: 'เปิดเซิฟในนาทีเดียว ไม่ต้องรอ ไม่ต้องเข้าใจเทคนิค'—Start a server in one minute, no waiting, no tech knowledge needed.

## Colors

The REALMS color system is built on a dark-first philosophy optimized for extended gaming sessions and reduced eye strain. The surface stack anchors at #0a0e1a (surface), descending to #050709 (surface-dim) for recessed elements and ascending through container layers to #2a313f (surface-container-highest) for elevated modals and overlays. All surfaces maintain a cool, slightly desaturated tone (hue ~210°) to evoke a calm, focused gaming environment.

Primary (#8fcdff, hsla(207, 100%, 78%, 1)) is the signature accent—a bright, saturated sky-blue deployed on all call-to-action buttons, active navigation states, and interactive focus rings. This color dominates the hero section and pricing cards, signaling the brand's energy and approachability. Secondary (#0693e3) provides a deeper blue for

## Typography

IBM Plex Sans Thai is the sole typeface, chosen for its excellent Thai character rendering and modern, geometric warmth. The type hierarchy follows a 1.4× scale: display (60px, 700 weight) for hero headlines, headline-lg (40px, 700) for section titles, headline-md (28px, 600) for subsections, and body-md (16px, 400) for body copy. All headlines use -0.02em to -0.04em letter-spacing to tighten the visual mass and convey confidence; body text uses 0.01em for clarity. Line-height is set to 1.5× font-size for body (24px line-height on 16px type) to ensure readability over the dark background. Labels and buttons use 600–700 weight at 12–14px with 0.01–0.02em tracking to maintain legibility at small scales. Apply text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) on white text over photographic backgroun

## Layout

REALMS uses a 12-column fluid grid with a max-width of 1320px, centered on viewport. The spacing scale is semantic: 24px (md) for standard section gutters, 40px (lg) for major section separation, and 64px (xl) for hero-to-content transitions. The hero occupies 100vh with a Minecraft-themed 3D background image, centered text, and a prominent CTA button positioned 60% down the viewport. Below the fold, content sections use 40px vertical padding (top and bottom) with 24px horizontal gutters on mobile, scaling to 64px gutters on desktop (1024px+). Cards are arranged in a 3-column grid on desktop, 2 columns on tablet, 1 column on mobile, with 24px gaps. The container-max of 1320px ensures content never exceeds comfortable reading width; narrower viewports (< 768px) use 100% width with 12px side

## Elevation & Depth

Depth in REALMS is achieved through a restrained shadow and layering system that respects the dark theme. Level 1 (Base): the background gradient and surface (#0a0e1a) with no shadow. Level 2 (Standard Cards): surface-container (#151b28) with 0 3px 8px rgba(0, 0, 0, 0.15)—a soft, close shadow suggesting proximity. Level 3 (Elevated/Modals): surface-container-high (#1f2633) with 0 8px 24px rgba(0, 0, 0, 0.25)—a larger, softer shadow indicating significant lift. Interactive elements (buttons, inputs on focus) receive a 3px glow using box-shadow: 0 0 0 3px rgba(143, 205, 255, 0.1) to signal focus

## Shapes

REALMS employs 'Soft Modularity'—a shape philosophy that softens the hard edges of Minecraft's cubic aesthetic while maintaining its geometric clarity. Buttons and primary interactive elements use 1.5rem (24px) border-radius (rounded.xl), creating a friendly, approachable pill shape that contrasts with the blocky game world. Cards and containers use 1rem (16px) (rounded.lg) for a balanced, modern feel. Input fields and smaller UI elements use 0.5rem (8px) (rounded.DEFAULT) for subtle definition without visual noise. The full (9999px) radius is reserved for badges and micro-interactions (e.g.,

## Components

### Action Elements
Buttons are the primary interaction surface. The button-primary component uses {colors.primary} (#8fcdff) background with {colors.on-primary} text, 8px 32px padding, 44px height, and {rounded.xl} (24px radius). On hover, the background shifts to #7ab8e8 with an expanded shadow (0 6px 16px rgba(143, 205, 255, 0.25)) and a 200ms transition (cubic-bezier(0.2, 0, 0.38, 0.9)). On active/press, the background darkens to #6aa3d3 and the shadow compresses to 0 2px 4px rgba(0, 0, 0, 0.2). Secondary buttons use a transparent background with a 2px solid {colors.primary} border and the same text color; on hover, they fill with rgba(143, 205, 255, 0.1). All buttons use {typography.label-md} (14px, 600 weight, 0.01em tracking) for consistent labeling.

### Containers & Surfaces
Cards

## Do's and Don'ts

**Do**
- Do use {colors.primary} (#8fcdff) exclusively for CTAs, focus states, and primary interactive elements—never for body text or backgrounds.
- Do apply {elevation.md} (0 3px 8px rgba(0, 0, 0, 0.15)) to all cards and containers to establish visual hierarchy in the dark theme.
- Do maintain 24px (md) horizontal gutters and 40px (lg) vertical section spacing to ensure breathing room and readability.
- Do use IBM Plex Sans Thai at 600–700 weight for all headlines and 400 weight for body copy; never mix typefaces.
- Do transition interactive elements over 200ms using cubic-bezier(0.2, 0, 0.38, 0.9) for smooth, predictable motion.
- Do apply text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) on white text over photographic backgrounds to ensure 4.5:1 contrast.

**Don't**
- Don't use near-black or near-white as primary or secondary colors; REALMS is defined by the sky-blue accent (#8fcdff), not neutrals.
- Don't exceed 24px blur radius on shadows; keep the dark theme calm and focused, not murky.
- Don't apply rounded corners smaller than 8px (rounded.DEFAULT) to interactive elements; softness signals approachability.
- Don't mix font weights within a single line of body text; use 400 for body and 600–700 for emphasis only.
- Don't place text directly on photographic backgrounds without a shadow or scrim; always ensure 4.5:1 WCAG AA contrast.
- Don't animate transitions faster than 150ms or slower than 300ms; REALMS feels responsive, not sluggish or jarring.
