# Ava onboarding design QA

- Source visual truth: `C:\Users\Morgan\.codex\generated_images\019f90a2-3ba5-78a1-8b39-40a646b982c5\call_wM7KxC1DsVzF8z3mS2LMLIFa.png`
- Implementation screenshot: `C:\Users\Morgan\Documents\Codex\2026-07-23\wha\work\buildly-ops-hub\implementation-ava-mobile-final.png`
- Combined comparison: `C:\Users\Morgan\Documents\Codex\2026-07-23\wha\work\buildly-ops-hub\design-comparison-ava-final.png`
- Viewport: 390 × 844 CSS pixels, device scale factor 1
- Source pixels: 853 × 1844; normalized to 390 × 844 in the combined comparison
- Implementation pixels: 390 × 843; normalized to 390 × 844 in the combined comparison
- State: first conversational business question, text input mode, microphone not consented

## Full-view comparison evidence

The final comparison shows the same major composition as the selected target: realistic Ava portrait in the upper region, dark warm FastTract palette, explicit AI label and state, one clear question, voice/text response controls, and secondary navigation below. The implementation intentionally shows the text-entry state while the source shows the listening state; both modes are implemented.

## Focused region comparison evidence

No additional crop was needed because the 390-pixel combined view keeps the portrait, question typography, response control, microphone control, and navigation labels readable. The opening consent screen and 1440 × 900 desktop layout were also rendered and inspected separately.

## Required fidelity surfaces

- Fonts and typography: hierarchy, weights, wrapping, caption size, and uppercase assistant label match the source intent. System font fallback is acceptably close at this size.
- Spacing and layout: portrait/question proportions, mobile gutters, tap targets, and vertical rhythm match. No horizontal overflow. The text-mode footer is intentionally less dense than the listening-state source.
- Colors and tokens: warm espresso, orange accent, translucent black controls, and off-white copy now match FastTract’s selected direction.
- Image quality: a dedicated photorealistic Ava portrait is used; crop is sharp and consistent on mobile and desktop. No placeholder, CSS-drawn, or deceptive prerecorded avatar is used.
- Copy and content: Ava is explicitly labeled AI, asks one question at a time, and explains consent and sensitive fields in plain language.

## Interaction and engineering checks

- Tested: opening consent, text-only start, answer submission, next-question progression, pause/resume, back, optional skip, and responsive mobile/desktop rendering.
- Browser console errors: none.
- Build: passed.
- Automated tests: 34 passed.

## Comparison history

1. Initial comparison found a P1 palette/brand mismatch: implementation used cool navy/cyan while the selected source used warm black/orange. It also found a P2 mobile layout issue where the initial portrait was mostly hidden by the consent card and a P2 conversation-height issue that pushed the first input below the fold.
2. Fixes: regenerated Ava with a warm office background and charcoal blazer; mapped interaction tokens to FastTract orange/espresso; condensed the opening card; fixed the portrait region to 46dvh; reset scroll when the conversation starts; constrained the desktop portrait to the right 62%.
3. Post-fix evidence: `design-comparison-ava-final.png` shows the warm palette and intended composition at 390 × 844. Separate 1440 × 900 inspection confirms the desktop portrait and consent card render correctly.

## Findings

No actionable P0, P1, or P2 visual findings remain.

## Follow-up polish

- P3: a production streaming-avatar provider can replace the CSS speaking-state motion when true viseme-based lip synchronization is enabled.

final result: passed
