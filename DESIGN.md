---
name: WeatherGPT
description: A conversational weather assistant that shows its receipts — two colours, one seed, every number traceable to the fetch that produced it.
colors:
  ink: "#000000"
  ground: "#ffffff"
  hair: "color-mix(in srgb, var(--wg-ink) 22%, transparent)"
  hair-2: "color-mix(in srgb, var(--wg-ink) 42%, transparent)"
  hair-3: "color-mix(in srgb, var(--wg-ink) 68%, transparent)"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "normal"
  headline:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', 'DejaVu Sans Mono', Menlo, Consolas, ui-sans-serif, system-ui, 'Noto Sans Devanagari', 'Nirmala UI', monospace"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.15
    fontFeature: "tabular-nums slashed-zero"
  title:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.3
  answer:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.62
  body:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.62
  label:
    fontFamily: "{typography.headline.fontFamily}"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "0.16em"
    fontFeature: "tabular-nums slashed-zero"
  label-deva:
    fontFamily: "{typography.headline.fontFamily}"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "0"
  caption:
    fontFamily: "{typography.headline.fontFamily}"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tabular-nums slashed-zero"
rounded:
  none: "0"
spacing:
  unit: "4px"
  gap: "6px"
  inset: "10px"
  rhythm: "24px"
components:
  switch:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "38px"
  switch-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  switch-disabled:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
  action-armed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "38px"
  action-armed-hover:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
  chip-kind:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "4px 6px"
  chip-official-warning:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "4px 6px"
  input-line:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "4px 0"
  plate:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px 0"
    width: "100%"
---

# Design System: WeatherGPT

## Overview

**Creative North Star: "The Datamatics Field"**

A weather answer is a claim about the physical world, and this interface is built
so a citizen can audit it in one glance. The world is a measuring instrument, not
an app: pure black and pure white, no third colour, no rounding, no shadow, no
tinted surface. Everything that would normally be a card is instead ruled — a
2px ink rule above, a hairline below — so containment is drawn rather than
implied. Tone still exists, but only as **coverage**: hairline rules, bar fields
at a declared pitch, dither, and solid ink. The lineage is Ryoji Ikeda's data
work and the printed measurement table that predates it.

The density is high and unapologetic, because the content is dense: a single
answer carries prose, a metric table, an hourly plot, a daily band, and a
provenance footer. What keeps it readable is that every one of those has a
different *typographic register* rather than a different colour. The machine
speaks in a tracked monospace at 12px — every label, every measured number,
every control. The answer speaks in the system sans at 17px on a 68-character
measure. A reader never has to wonder which voice is talking.

Dark mode is not a second palette. It is the inversion: `--wg-ink` and
`--wg-ground` swap, every derived hair value re-mixes off the new ink, and the
two canvases repaint in the new ink through a shared `MutationObserver`
contract. The control is labelled INVERT, not "theme", because that is literally
what it does.

**Key Characteristics:**

- Two colours, full stop: `#000000` and `#ffffff`, always at 21:1.
- No rounding anywhere (`0`), no shadow anywhere, no tinted surface anywhere.
- Rules do the containing: 2px for a question, a hairline for an answer.
- Tone is coverage — hairlines, bar fields, dither — never a grey glyph.
- One seed (six CSS custom properties) drives every rule weight, pitch, and
  tracking value in the system.
- Every control is a labelled switch whose state is shown by which way the ink
  runs.

## Colors

Two absolutes and three derived coverages. There is no accent, because a hue
would imply a meaning the data does not support.

### Primary

- **Ink** (`#000000` in light, `#ffffff` in dark): every glyph, every rule, every
  measured bar. Text is always full ink on full ground — 21:1, which is the most
  legible pairing that exists on a mid-range phone in Indian daylight, and it
  means no label can go muddy and no meaning can hide in a hue.

### Neutral

- **Ground** (`#ffffff` in light, `#000000` in dark): the page, every plate, and
  the inside of every hollow switch. There is no second surface level; a plate
  sits on the same ground as the page and is separated by rules alone.
- **Hair** (ink at 22%): the lattice ruler, the rule under an answer's head, and
  the divider between two rows of a metric table. The quietest structure.
- **Hair-2** (ink at 42%): the pitch of the `field-bars` / `field-dither` /
  `field-diagonal` coverages, the plot's own baselines, and the frame of a
  disabled switch.
- **Hair-3** (ink at 68%): dot leaders, scrollbar thumbs, the resting edge of an
  input, and the boxing rules that hold provenance entries apart.

### Named Rules

**The Two-Colour Rule.** There are exactly two colours in this product. Any new
value must be `--wg-ink`, `--wg-ground`, or a `color-mix` of ink with transparent
— and a mix is legal on rules, fields and gradients only.

**The No-Grey-Glyph Rule.** A thinned ink never carries a glyph. Not for
placeholders, not for hints, not for captions, and not for disabled controls. A
disabled control gives up its *frame* (hairline instead of a rule) and keeps its
words at full ink, because it still has to be readable in sun.

**The Inversion Rule.** Dark mode swaps ink and ground and nothing else. If a
treatment needs a separate dark-mode value, the treatment is wrong.

## Typography

**Display Font:** the platform sans — `ui-sans-serif, system-ui, -apple-system,
"Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", "Nirmala UI", "Mangal"`.
**Body Font:** the same sans. Prose has one voice.
**Label/Mono Font:** `--font-numeric` — a monospace stack with the Devanagari
sans *behind* it, so the browser falls through per glyph and one line can carry
`31°C` and `आंशिक बादल` without printing boxes.

**Character:** a bilingual instrument panel with a book set inside it. Both
stacks stay on the system — a build with no network must never fail fetching a
webfont, and the primary user is on a mid-range Android where Roboto and Noto
Sans Devanagari are already resident. The mono is deliberately the *machine's*
voice, which is why an answer is not monospaced.

### Hierarchy

- **Display** (600, `1.875rem`, 1.12): the empty state's one question, capped at
  24 characters of measure. Appears exactly once, before the first turn.
- **Headline** (400, `1.5rem`, 1.15, tabular): the plate headline — `28°C ·
  Mainly clear`. Mono, because it is a reading off an instrument.
- **Title** (600, `1.0625rem`, 1.3): an alert's event name.
- **Answer** (400, `1.0625rem`, 1.62, max `68ch`, `text-wrap: pretty`): the
  prose answer. The one generous measure on the page.
- **Body** (400, `1rem`, 1.62, max `68ch`): a user's question, an alert
  description.
- **Caption** (400, `0.8125rem`, 1.5, mono): status prose, hints, sublines,
  notices — anything that is a sentence but not the answer.
- **Label** (400, `0.75rem`, 1.25, `0.16em`, UPPERCASE, tabular): every label,
  control, axis tick and provenance key.

### Named Rules

**The Twelve-Pixel Floor.** `0.75rem` is the smallest type in the system, it is
reserved for tracked mono caps, and it is never a sentence. A sentence starts at
`0.8125rem`.

**The Caps-Are-Labels Rule.** Uppercase marks a label, never prose. A full
sentence set in caps is measurably slower to read, so status prose, hints and
disclaimers stay in sentence case even inside the mono voice.

**The Devanagari Rule.** Devanagari never takes the 0.16em caps tracking — that
is a Latin device — and it steps up one size (`0.8125rem`) to land on the same
optical size a Latin cap has at `0.75rem`. Script is detected from the rendered
string, not assumed from a language flag.

**The Tabular Rule.** Every numeral in the system is `tabular-nums
slashed-zero`. A temperature that changes width mid-stream reads as a glitch
rather than as a measurement.

## Layout

A single column on a `48rem` (`max-w-3xl`) measure, centred, with `1rem` gutters
that open to `1.5rem` at `640px`. There is one breakpoint (`sm: 640px`); the
phone layout is the design and the desktop is the same layout with room around
it. The metric table is the only thing that reflows — one column below `640px`,
two above.

The app is a fixed three-part frame: a header that does not scroll, a transcript
that does, and a composer docked on a 2px ink rule at the bottom. The transcript
follows new content while streaming and stops following the moment the reader
scrolls up more than `120px` from the bottom — and it never auto-follows the
empty state, which is a top-of-page read.

Vertical rhythm comes off `--seed-unit: 4px`. Turns are separated by `24px`;
inside a turn, elements step at `10px` and `14px`; a plate's internal rows sit on
`6px` padding against their hairline rule. Horizontal alignment is by dot leader
(`leader`) rather than by column, so a label and its value stay tied together at
any width.

### Named Rules

**The One-Column Rule.** Nothing in this product is side by side except a metric
pair on a wide screen. A conversation is a vertical record.

## Elevation & Depth

There is no elevation. No `box-shadow` exists anywhere in the system, no surface
is tinted, and no element is raised. Depth is expressed entirely by **rule weight
and ink coverage**, which is a printed-page model rather than a material one:

- `1px` hairline (`--seed-rule`) — the quietest division. An answer's head rule,
  a table row, a provenance boxing rule.
- `2px` (`--seed-rule-strong`) — a structural edge. A question's head rule, the
  header's bottom rule, the composer's dock rule, a plate's opening rule, the
  focus outline.
- `3px` (`--seed-rule-loud`) — the loudest frame in the system, spent only on a
  severe official warning and an error block.

### Named Rules

**The Ruled-Not-Raised Rule.** A container is defined by the rules around it, not
by a shadow, a radius, or a fill. If a plate needs a surface to be legible, its
rules are wrong.

**The One Inverted Surface Rule.** Exactly one element in the product fills its
whole shell with ink: an `extreme` official warning. Every other inversion is a
control state or a one-column plot cursor. That scarcity is what makes it mean
something.

## Shapes

Zero radius everywhere — `rounded: 0` is a system invariant, not a default. Every
box is a rectangle with square corners, because the world it borrows from is a
printed table and a plotter chart.

The recurring form language is the **plate**: a horizontal band opened by a 2px
ink rule that draws itself left to right, its content ruled internally by
hairlines, and closed by a 2px rule above a provenance footer. A plate is never a
card — it has no background of its own and no outer border on the sides.

The second recurring form is the **coverage swatch**: a `16×10px` rectangle
filled with one of the claim-kind patterns, always printed immediately beside the
kind's name in words. Six kinds of claim have to stay apart with no colour
available, so each carries its own ink coverage:

- `field-bars` — 1px verticals every 3px. **Current observation.**
- `field-diagonal` — 1px 45° rules every 5px. **Forecast.**
- `field-dither` — crosshatched 1px rules at ±45°, 2px pitch. **Historical
  (ERA5).**
- `lattice` — 1px verticals every 12px. **NWP model output.**
- `field-solid` — full ink, inverted text. **Official warning.**
- `1px dashed` outline, never filled. **AI advisory.** It is the one signature
  that cannot be confused with the solid block a real warning gets.

### Named Rules

**The Pattern-Plus-Word Rule.** A coverage pattern is never the only signal. It
is always accompanied by the claim kind in words; the pattern is what makes the
word findable at a glance, not a substitute for it.

**The Dashed-Never-Filled Rule.** A derived advisory is dashed and hollow, in
both light and dark, forever. Nothing in the UI may promote it into the solid
block an official warning gets.

## Components

Every control in the product is the same object — a labelled switch — at a
different state. That is why the chrome reads as one bolted instrument rather
than a row of buttons.

### Buttons

- **Shape:** square (`0` radius), `1px` solid ink border, `38px` minimum height,
  `10px` horizontal padding, `6px` gap to its glyph.
- **Off (default):** ink on ground. The resting state of INVERT, NEW CHAT,
  STATION, VOICE, and every language segment.
- **On (`aria-pressed="true"` / `data-on="true"`):** ground on ink — the switch
  fills. Used for the selected language segment, an open STATION panel, a
  listening VOICE, and an armed SEND.
- **Hover / Active:** an off switch fills (`110ms linear` on background and
  colour). Hover is guarded behind `@media (hover: hover)` and `:not(:disabled)`
  so a tap on a phone cannot leave a switch stuck inverted.
- **Primary action (`data-action="true"`):** SEND and STOP. Solid ink whenever
  the action can actually fire; under the pointer it inverts *the other way* and
  hollows out, since it has nowhere darker to go. Scoped to the action so a
  pressed radio segment never suggests it can be un-pressed.
- **Disabled:** border drops to `hair-2`, the fill is removed, the words stay at
  full ink, cursor `not-allowed`. Never dimmed.
- **Focus:** `2px` solid ink outline at `2px` offset, on every focusable element,
  in both schemes.

### Chips

- **Style:** `1px` border, `0` radius, `6px × 4px` padding, label typography,
  with a `16×10px` coverage swatch inside it where the kind has one.
- **State:** not interactive. A chip is a claim label, and its border treatment is
  fixed by the claim kind (see Shapes): full ink border for observation, forecast,
  historical and NWP; `field-solid` for an official warning; `1px dashed` for a
  derived advisory; `hair-3` for a plain location.

### Cards / Containers

There are no cards. The container is the **plate**:

- **Corner style:** square. No radius, ever.
- **Background:** none — the same ground as the page.
- **Shadow strategy:** none. See Elevation & Depth.
- **Border:** opened by a `2px` full-bleed ink rule that animates left to right
  over `620ms` linear; internal rows divided by `1px` hair rules; closed by a
  `2px` ink rule above the footer.
- **Internal padding:** `0` horizontally (it aligns to the column), `8px`
  vertically against its own rules.

### Inputs / Fields

- **Style:** no box. A single `1px` `hair-3` bottom rule under the text, fully
  transparent background, `0` radius.
- **Focus:** the bottom rule goes to full ink over `100ms`. Nothing moves.
- **Placeholder:** set in the mono at **full ink** (`prompt-hint`), so the
  field's own prompt is told apart from the user's typed sans by *face* rather
  than by thinned ink.
- **Caret and selection:** ink; selection is inverted (ink background, ground
  text).
- **Disabled / error:** an error is printed as a caption below the field, never as
  a colour.

### Navigation

There is no navigation — the product is one surface. The header is an
identification strip (a bar-field mark, the wordmark, one sentence of tagline,
and a 24-hour clock) over a bolted switch bank: STATION, the three-segment
language selector, INVERT, NEW CHAT. Each segment after the first pulls back a
pixel (`-ml-px`) so the bank shares its rules and reads as one plate. On a phone
the tagline is dropped and the two right-hand switches keep only their glyphs;
STATION keeps its label, because it carries state.

### Signature Component: the bar field

The hourly series, drawn into a `116px` canvas at up to 2× DPR. This is the
product's centre of gravity below the prose, and every mark in it is a fetched
number:

- The upper band (64% of the height) is temperature as solid ink bars standing on
  a `hair-2` baseline, with a `1px` polyline through the bar tops — the actual
  diurnal curve, not an ornament.
- The lower band is chance of rain as dither (1px rows every 3px) standing on its
  own floor rule, so it climbs the same direction the temperature bars do and a
  4% hour reads as a measured near-zero rather than a stray hairline.
- Behind both sits a `lattice` ruler at uniform pitch that carries no values and
  encodes nothing — which is the only reason it is allowed to exist.
- Selecting a column inverts it full height, and the bars inside are **knocked
  out** of the solid block (`destination-out`) rather than drawn over it. The rest
  of the field keeps its bars: dimming them would delete the series in order to
  read one hour out of it.
- It is a real `role="slider"`: arrow keys / Home / End move the sample, Escape
  clears it, the readout is a live region, and the whole series is duplicated as
  `sr-only` text, because a canvas is not an answer.

### Signature Component: the severity ramp

Five official severities told apart with no colour available, by rising ink
coverage on the plate's shell and a coverage strip across its head: `1px hair-3`
+ hair strip (info), `1px ink` + `field-bars` (minor), `2px ink` +
`field-dither` (moderate), `3px ink` + solid strip (severe), and `3px ink` with
the entire plate inverted (extreme). The step is always printed as a word beside
a five-block meter, so the coverage is never the only signal. A derived advisory
never borrows this ramp — it is dashed, hollow, and says in words that it is not
an official warning.

### Motion

Motion is a plotter, not an interface. The authored moment is a measured series
laying itself down left to right at a constant rate; everything else is a snap.

- **`--animate-draw`** (`620ms linear`, `clip-path: inset(0 100% 0 0)` → `0`): a
  plate's opening rule and each daily span bar, staggered `60ms` per row to a
  6-row cap.
- **`--animate-rule`** (`420ms linear`, `scaleY(0 → 1)`): a rule establishing
  itself.
- **`--animate-wipe`** (`300ms cubic-bezier(0.16, 1, 0.3, 1)`): the full-frame
  inversion, once per state change.
- **`--animate-caret`** (`1.1s steps(1, end)`, infinite): the streaming caret.
- **`--animate-meter`** (`1.4s ease-in-out`, infinite): the three-bar VOICE level,
  which moves only while something really is being recorded.
- **The scan strip** (`46px/s`, seeded `mulberry32(0xf682b2)`): the only thing
  that moves continuously, running only while a lookup is in flight. It encodes
  nothing and the label beside it says `SCANNING`, because a field of bars that
  looked like a measurement would be a fabricated number.
- **Elapsed** ticks at `200ms` in its own component, so four digits re-render
  instead of the whole turn.

Under `prefers-reduced-motion: reduce` every duration collapses to `0.001ms`, the
continuous loops never start, and the two canvases draw one complete still — the
plot is never left clipped at its first frame. Nothing in the product flashes:
the inversion fires once per change and the caret steps at `1.1s`, well under the
three-flash threshold.

### Named Rules

**The Linear-Plot Rule.** A measured series is animated `linear`, never eased. A
machine drawing a measurement does not accelerate. Easing (`cubic-bezier(0.16, 1,
0.3, 1)`) is for state snaps only.

**The No-Entrance Rule.** A user's own question never animates in. It was already
on screen when they pressed send; animating direct manipulation reads as lag.

**The Persistent-Log Rule.** The retrieval log (`DATA LOOKUPS …`) stays on screen
after the answer lands. It is part of the record, not a spinner that clears
itself.

## Do's and Don'ts

### Do:

- **Do** derive every rule weight, pitch and tracking value from the six seed
  properties (`--seed-unit: 4px`, `--seed-rule: 1px`, `--seed-rule-strong: 2px`,
  `--seed-rule-loud: 3px`, `--seed-pitch: 3px`, `--seed-track: 0.16em`). No value
  on screen is hand-tuned in a component.
- **Do** print an empty value as an em-dash (`STATION —`, `—` in a metric cell) so
  a control shows its state instead of merely naming itself.
- **Do** end every data plate with source, model where there is one, and fetch
  time, each boxed on its own `hair-3` left rule — a reader must be able to tell
  an observation from a forecast from a model run without trusting the sentence
  above it.
- **Do** give a coverage pattern its name in words, every time.
- **Do** set a field's own prompt in the mono at full ink; distinguish machine
  text from user text by face.

- **Do** keep every clock in the product on `hourCycle: "h23"`. An axis reading
  `8:00 PM` beside a header reading `20:35` looks like two devices.
- **Do** box two adjacent readings apart on a hairline (`ELAPSED 11.8S │ 20:48`)
  rather than trusting a space. Provenance is the last thing that should read as
  mush.
- **Do** duplicate every canvas as `sr-only` text.

### Don't:

- **Don't** introduce a third colour, a tint, a gradient of hue, or a
  `dark:`-prefixed colour value. Dark mode is the inversion of the two.
- **Don't** put a `border-radius` above `0` on anything.
- **Don't** add a `box-shadow`, a raised surface, or a "card" — use rules.
- **Don't** let a thinned ink carry a glyph, including disabled controls,
  placeholders and captions.
- **Don't** set a sentence in uppercase, and don't set prose below `0.8125rem`.
- **Don't** letter-space Devanagari.
- **Don't** ease a data animation, and don't animate a user's own input into view.
- **Don't** encode weather in the `lattice` ruler or the scan strip. Only solid
  ink with a printed number is a measurement; the furniture must stay furniture.
- **Don't** dim the rest of a series to highlight one sample.
- **Don't** attribute a threshold advisory to an authority, or give it the solid
  block an official warning gets.
