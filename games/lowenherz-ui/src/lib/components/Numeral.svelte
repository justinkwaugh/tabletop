<script lang="ts">
    // IM Fell English is an old-style (text) figure font: its digits deliberately sit at
    // three different heights, the way they would in running prose. 0 1 2 sit on the
    // baseline at x-height, 6 and 8 ascend above it, and 3 4 5 7 9 hang BELOW it.
    //
    // Two other faces already loaded by app.css - Blankenburg and UnifrakturMaguntia -
    // carry lining figures (every digit on the baseline, heights uniform to within ~5
    // units against IM Fell's 41) and would need none of this. Both were tried and set
    // aside: IM Fell is the face the game wants.
    //
    // Measurements below come from rendering each digit at pointsize 200 against a fixed
    // baseline and reading the ink bounding box, so they're the real metrics of the
    // shipped TTF rather than typographic guesswork.
    // Positive lifts a digit, negative pushes it down.
    //
    // Only 6 and 8 are touched. The descending figures - 3 4 5 7 9 - are left exactly
    // where the typeface puts them: hanging below the baseline is what old-style figures
    // are FOR, and an earlier pass that lifted each one by its measured descent was
    // tried and rejected. The font is trusted here.
    //
    // 6 and 8 are the ascending figures, standing ~30 units (at pointsize 200) taller
    // than 0 1 2, which is a bigger jump than the rest of the set makes. Pushing them
    // down a couple of pixels evens the tops without touching anything else.
    const LIFT: Record<string, string> = {
        '6': '-0.110em',
        '8': '-0.110em',
        // 7 hangs 0.235em below the baseline in this font - the deepest of the descenders.
        // This lifts it by roughly a quarter of that, deliberately NOT all the way: the
        // descender is still meant to read as a descender, it was just dropping further
        // than the rest of the set.
        '7': '0.060em'
    }

    // Lowering 6 and 8 costs a little horizontal fit. Both lean LEFT at the top, and that
    // upper curve used to tuck in close beside whatever preceded them - "16" nearly
    // touches. Drop the glyph and the curve travels down and away, opening a wedge of
    // white in the upper left that reads as extra letter-spacing even though the advance
    // widths haven't changed at all.
    // The gap that shows up in "16" and "17" is NOT caused by the shifts above, though it
    // gets more conspicuous next to one. It's in the typeface: 1 is a narrow serifed I
    // with an advance of 763 units around roughly 584 of ink, so it carries generous side
    // bearings and every pair starting with it - 10 12 14 16 17 18 alike - sits looser
    // than 20 26 27 28 32 44 do. Rendering the raw font with no shift at all shows the
    // same gap.
    // So the correction belongs on "follows a 1", not on the shifted digits. -0.06em was
    // picked by rendering the pairs across a range and judging by eye; -0.08 starts to
    // crowd 18 and 12.
    // Judging by eye is the method on purpose: two different numeric measures - closest
    // ink distance, and widest ink-free column - both disagree with what the pairs
    // actually look like, because these glyphs are thin at mid-height where the eye reads
    // the space.
    const TUCK_AFTER_ONE = '-0.06em'

    let { value }: { value: number | string } = $props()

    const characters = $derived(String(value).split(''))
</script>
<!-- The whole number is wrapped in ONE element so it is a single child of whatever
     contains it. Emitting the digits as separate top-level nodes (a bare text node here,
     a styled span there) breaks inside a flex container: every child becomes a flex item,
     anonymous text nodes included, so the container's gap gets inserted BETWEEN the
     digits. That put 4px inside "10" and "12" in the player panels, whose ducat and
     knight rows are flex with gap-1, while the same numbers looked correct in the summary
     strip because those boxes are block. Only numbers whose second digit is wrapped
     showed it, which is why it looked like a 0/1/2 problem rather than a layout one.

     Within the wrapper, a character needs its own span if it's shifted vertically or
     follows a 1; anything else stays bare text. position: relative shifts the glyph
     without touching layout, so a shifted digit can't change the line's height or nudge
     anything beside it. -->
<span
    >{#each characters as character, i (i)}{@const lift = LIFT[character]}{@const tuck =
            i > 0 && characters[i - 1] === '1' ? TUCK_AFTER_ONE : undefined}{#if lift || tuck}<span
                style="{lift ? `position: relative; bottom: ${lift};` : ''}{tuck
                    ? ` margin-left: ${tuck};`
                    : ''}">{character}</span
            >{:else}{character}{/if}{/each}</span
>
