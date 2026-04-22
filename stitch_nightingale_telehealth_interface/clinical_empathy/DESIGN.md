---
name: Clinical Empathy
colors:
  surface: '#faf9fd'
  surface-dim: '#dad9dd'
  surface-bright: '#faf9fd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f7'
  surface-container: '#efedf1'
  surface-container-high: '#e9e7eb'
  surface-container-highest: '#e3e2e6'
  on-surface: '#1a1c1e'
  on-surface-variant: '#43474e'
  inverse-surface: '#2f3033'
  inverse-on-surface: '#f1f0f4'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#455f88'
  primary: '#002045'
  on-primary: '#ffffff'
  primary-container: '#1a365d'
  on-primary-container: '#86a0cd'
  inverse-primary: '#adc7f7'
  secondary: '#13696a'
  on-secondary: '#ffffff'
  secondary-container: '#a2eded'
  on-secondary-container: '#1a6d6e'
  tertiary: '#321b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#4f2e00'
  on-tertiary-container: '#c6955e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#adc7f7'
  on-primary-fixed: '#001b3c'
  on-primary-fixed-variant: '#2d476f'
  secondary-fixed: '#a5eff0'
  secondary-fixed-dim: '#89d3d4'
  on-secondary-fixed: '#002020'
  on-secondary-fixed-variant: '#004f50'
  tertiary-fixed: '#ffddba'
  tertiary-fixed-dim: '#f2bc82'
  on-tertiary-fixed: '#2b1700'
  on-tertiary-fixed-variant: '#633f0f'
  background: '#faf9fd'
  on-background: '#1a1c1e'
  surface-variant: '#e3e2e6'
typography:
  display-xl:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Public Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  clinical-data:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  patient-margin: 32px
  doctor-margin: 16px
  gutter: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system is anchored in "The Digital Bedside Manner"—a philosophy that balances medical authority with human-centric warmth. It targets the Australian healthcare landscape, prioritizing clarity, accessibility, and trust. 

The aesthetic is **Corporate / Modern** with a lean towards **Minimalism**. It avoids the sterility of legacy medical software by using soft tonal shifts and generous whitespace in the patient experience, while maintaining a high-density, utility-first structure for practitioners. The visual language conveys reliability through structured grids and high-contrast elements, ensuring every interaction feels deliberate and safe.

## Colors
The palette is rooted in a deep Navy (#1A365D) for institutional trust and a soft Teal (#2C7A7B) for approachable vitality. 

The color logic diverges by user intent:
- **Patient Portal:** Utilizes soft washes of the secondary teal and neutral slates to create a de-escalating, "quiet" environment.
- **Doctor Portal:** Leverages high-contrast primary navy and white surfaces to facilitate rapid ocular scanning.

Semantic status colors are non-negotiable: Emerald for "Approved" (safety), Amber for "Pending" (caution), Crimson for "Red Flag" (urgent intervention), and Slate for "Refunded" (neutral/archival).

## Typography
This design system utilizes **Manrope** for headlines to provide a modern, refined, and balanced character that feels contemporary. For all functional and body text, **Public Sans** is employed for its institutional clarity and exceptional legibility in clinical contexts.

For the Doctor Portal, use the `clinical-data` and `label-sm` tiers to maximize information density without sacrificing readability. In the Patient Portal, favor `body-lg` and generous line heights to ensure instructions are easy to digest for those in potentially stressful situations.

## Layout & Spacing
A 12-column **fluid grid** system is used, governed by an 8px base unit. 

- **The Patient Experience:** Employs a "Focus Layout" with wide margins (32px+) and increased vertical stack spacing (stack-lg) to reduce cognitive load. 
- **The Doctor Experience:** Employs a "Dashboard Layout" with minimized margins (16px) and tight gutters. Content blocks should maximize screen real estate to limit scrolling during clinical reviews. 

Grid alignment should be strictly adhered to for medical-grade data panels, ensuring that related data points (e.g., blood pressure, heart rate) are always vertically aligned.

## Elevation & Depth
Depth is communicated through **Tonal Layers** and extremely soft **Ambient Shadows**. 

Avoid heavy dropshadows that create "floating" elements, which can feel unstable. Instead, use subtle border-bottoms (1px) in a light neutral tint or a 2px elevation with a blur of 12px at 5% opacity for cards. In the Doctor Portal, depth should be strictly flat or "inset" to suggest a single-pane-of-glass workspace, whereas the Patient Portal can use layered surfaces to guide the eye through a linear journey (e.g., an onboarding flow).

## Shapes
The design system adopts a **Rounded** (0.5rem) shape language. This level of radius provides an approachable, organic feel that softens the "clinical" nature of the app, making it feel more like a wellness partner than a cold institution. 

- **Buttons & Inputs:** Use the base 0.5rem (8px).
- **Medical Cards:** Use `rounded-lg` (1rem / 16px) to define them as distinct, contained units of information.
- **Status Chips:** Use a full pill-shape (3rem) to distinguish them from interactive buttons.

## Components

### Medical Cards
Cards must have a clear hierarchy: a header area for the primary metric or title, a content body, and an optional footer for "Last updated" timestamps. Use a 1px Slate-200 border for the Doctor Portal and a soft shadow for the Patient Portal.

### Clinical Data Panels (SOAP Notes)
Designed for the Doctor Portal. Use a four-quadrant layout (Subjective, Objective, Assessment, Plan). Text should be high-density (Public Sans 14px) with subtle background alternating "zebra-striping" to help track horizontal data rows.

### Progress Indicators
Step-based indicators for patients should be large, utilizing the Secondary Teal to show completion. For doctors, progress is shown via slim, unobtrusive linear bars at the top of a panel.

### Audio Waveforms
Used for telehealth recording reviews. Waveforms should be rendered in the Secondary Teal (#2C7A7B) with a semi-transparent background. Use a vertical bar style rather than a continuous line for better seeking precision.

### Chat UI
Patient messages appear in light Teal bubbles with bottom-right alignment. Doctor/System messages appear in Primary Navy bubbles with bottom-left alignment. Ensure "Read" and "Sent" statuses are clearly visible to manage patient anxiety regarding response times.

### Input Fields
Inputs must have high-contrast borders (Slate-400) that darken to Primary Navy on focus. Validation messages should use Crimson (#DC2626) and be accompanied by an icon for accessibility.