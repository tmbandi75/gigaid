# Gig Aid Design Guidelines

## Design Approach
**Selected System**: Material Design 3 with mobile-first optimization  
**Rationale**: Gig Aid is a utility-focused productivity tool requiring efficiency, clear information hierarchy, and familiar mobile patterns. Material Design provides proven touch interactions, strong visual feedback, and accessibility standards essential for field workers using the app on-the-go.

**Key Principles**:
- **Efficiency First**: Every interaction optimized for speed and minimal taps
- **Voice-Ready**: Prominent voice input affordances throughout
- **Offline Resilient**: Clear visual states for sync/offline modes
- **Thumb-Friendly**: All primary actions within natural thumb reach

---

## Typography

**Font Family**: Roboto (Google Fonts)
- **Display/Headers**: Roboto Medium (500) - 24px to 32px
- **Section Titles**: Roboto Medium (500) - 18px to 20px  
- **Body Text**: Roboto Regular (400) - 16px
- **Captions/Meta**: Roboto Regular (400) - 14px
- **Buttons**: Roboto Medium (500) - 16px

**Hierarchy Rules**:
- Dashboard cards: 20px titles, 14px metadata
- Job/Lead entries: 18px titles, 16px descriptions, 14px timestamps
- Form labels: 14px, inputs: 16px
- Bottom navigation: 12px labels

---

## Layout System

**Spacing Primitives**: Tailwind units of **4, 6, 8, 12, 16** (p-4, m-6, gap-8, etc.)

**Mobile Layout** (primary):
- Screen padding: px-4, py-6
- Card spacing: gap-4 between cards, p-4 internal padding
- Section margins: mb-8 between major sections
- Form spacing: gap-6 between form groups

**Containers**:
- Content width: w-full with max-w-sm centered (max-w-md for tablets)
- Cards: Rounded corners (rounded-xl), subtle shadows
- Lists: Full-width with internal padding

**Grid Patterns**:
- Dashboard summary: Single column with stacked cards
- Quick stats: 2-column grid (grid-cols-2 gap-4)
- Job gallery: 3-column photo grid (grid-cols-3 gap-2)

---

## Component Library

### Navigation
**Bottom Navigation Bar** (primary):
- Fixed bottom position with 5 tabs: Dashboard, Jobs, Leads, Invoices, More
- Large touch targets (h-16), icon + label format
- Active state with bold icon and text

**Top App Bar**:
- Logo/page title left-aligned
- Action icons right-aligned (notifications, settings)
- Height: h-14

### Cards & Surfaces
**Dashboard Cards**:
- Weekly summary card with toggle (Week/Month), progress ring visualization
- Revenue snapshot with large number display (32px) and trend indicator
- Quick action cards with icon, title, count

**Job/Lead Cards**:
- Horizontal card layout with left accent border indicating status
- Service icon (left), title + time (center), action menu (right)
- Expandable for details with smooth animation
- Attachment indicators (photo count, voice note icon)

### Forms & Inputs
**Text Inputs**:
- Outlined style with floating labels
- Height: h-12, rounded-lg
- Helper text below in 14px

**Voice Input Button**:
- Prominent circular FAB (floating action button) in bottom-right
- Microphone icon with pulsing animation when recording
- Size: 56px × 56px with shadow

**Date/Time Pickers**:
- Native mobile pickers with calendar icon trigger
- Smart defaults pre-filled

**Photo Upload**:
- Thumbnail preview grid (80px × 80px)
- "Add photo" button with camera icon
- Max 4 photos displayed inline, "+N more" overflow

### Buttons & Actions
**Primary CTA**: Filled Material button, full-width on mobile, h-12, rounded-lg
**Secondary**: Outlined Material button, same dimensions
**Text Buttons**: For tertiary actions, 16px, medium weight

**Quick Reply Chips** (for leads):
- Horizontal scroll of pill-shaped buttons
- Compact height (h-9), rounded-full
- One-tap to send

### Status & Feedback
**Status Badges**:
- Lead status: Small pills with dot indicator (New: green, Contacted: blue, Converted: purple)
- Payment status: "Paid" badge with checkmark
- Sync status: Banner at top with icon

**Empty States**:
- Centered illustration (simple line art)
- Title (20px) + description (16px)
- Primary CTA button below

**Modals**:
- Bottom sheet style for mobile (slides up)
- White background, rounded top corners (rounded-t-3xl)
- Drag handle at top

### Lists & Data Display
**Job/Lead Lists**:
- Swipeable cards for quick actions (mark complete, delete)
- Grouped by date headers (14px, uppercase, tracking-wide)
- Dividers between items (1px, subtle)

**Invoice Table**:
- Two-column layout on mobile: Label | Value
- Total row with bold text and top border
- Share button always visible at bottom

### Onboarding Elements
**Progress Tracker**:
- 4-step horizontal stepper with connecting lines
- Checkmarks for completed steps
- Current step highlighted with color

**Tooltips**:
- Small popup with arrow pointing to feature
- Dismiss button (X) in top-right
- Max-width: 280px

---

## Animations

**Use Sparingly**:
- Card expand/collapse: 200ms ease
- Bottom sheet slide: 300ms ease-out
- FAB pulse during voice recording: gentle 1.5s loop
- Success checkmark: single bounce on invoice send
- Page transitions: subtle 150ms fade

**No Animations**:
- Scroll effects, parallax, decorative motion
- Button hovers (rely on Material ripple)

---

## Images

**Profile Photos**: Circular avatars (48px in lists, 80px in profile view)

**Job Photos**: 
- Thumbnail grid in job cards (80px × 80px, rounded-md)
- Full-screen gallery on tap with swipe navigation
- Camera icon overlay on empty photo slots

**Illustrations**:
- Use simple, friendly line art for empty states and onboarding
- Style: Minimalist, 2-3 line weights, uncolored (rely on accent color)
- Placement: Center of empty state containers, above CTA

**No Hero Images**: This is an application interface, not a marketing site. Focus on functional UI elements.

---

## Accessibility

- Minimum touch target: 44px × 44px
- Form inputs: Always include labels (no placeholder-only)
- Focus indicators: 2px outline offset
- Color contrast: WCAG AA minimum (4.5:1 for text)
- Voice button: Large, always accessible, clear visual state