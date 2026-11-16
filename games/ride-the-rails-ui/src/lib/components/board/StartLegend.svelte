<script lang="ts">
    import {
        RAILROAD_INTRODUCTIONS,
        type MapId,
        type RailroadId,
        type StartRule
    } from '@tabletop/ride-the-rails'
    import RailroadPiece from './RailroadPiece.svelte'

    let { mapId }: { mapId: MapId } = $props()

    // In board units: the open sea south-west of California, clear of land below y 975 from the
    // board's left edge to x 790 (USA map).
    const LEFT = 52
    const BOTTOM = 1196
    const WIDTH = 610
    const PAD = 16
    const TITLE_SIZE = 20
    const TEXT_SIZE = 17
    const ROW = 30
    const CUBE = 18
    const TEXT_X = PAD + 2 * CUBE + 16

    // R-4.2.1 to R-4.2.5: each start rule in the legend's words.
    const START_RULE_TEXT: Readonly<Record<StartRule, string>> = {
        'east-coast-apart': 'Different East Coast cities',
        'east-coast-or-chicago': 'An East Coast city or Chicago',
        'chicago-or-westernmost': 'Chicago or the 3 westernmost developed cities',
        'west-coast': 'A West Coast city',
        'any-city': 'Any city with room'
    }

    // One row per start rule, in the order the map introduces its railroads; the railroads that
    // share a rule (Red and Blue) share a row.
    const ROWS = $derived.by(() => {
        const rows = new Map<StartRule, RailroadId[]>()
        for (const { railroadId, startRule } of RAILROAD_INTRODUCTIONS[mapId]) {
            rows.set(startRule, [...(rows.get(startRule) ?? []), railroadId])
        }
        return [...rows].map(([rule, railroadIds]) => ({
            railroadIds,
            text: START_RULE_TEXT[rule]
        }))
    })

    const height = $derived(PAD + TITLE_SIZE + 10 + ROWS.length * ROW + PAD - 8)
    const top = $derived(BOTTOM - height)
</script>

<!-- R-4.2: a legend in the sea of where each railroad starts, a cube in its colour per rule; the
     city bands on the board show the same colours. -->
<g class="start-legend" aria-hidden="true" transform="translate({LEFT} {top})" data-start-legend>
    <rect
        width={WIDTH}
        {height}
        rx="8"
        fill="var(--rtr-panel)"
        stroke="var(--rtr-card-edge)"
        stroke-width="1.5"
    ></rect>
    <text
        x={PAD}
        y={PAD + TITLE_SIZE * 0.8}
        font-size={TITLE_SIZE}
        font-weight="700"
        fill="var(--rtr-ink)">First locomotive</text
    >
    {#each ROWS as row, index (row.text)}
        {@const y = PAD + TITLE_SIZE + 10 + index * ROW + ROW / 2}
        {#each row.railroadIds as railroadId, cube (railroadId)}
            <RailroadPiece {railroadId} x={PAD + CUBE / 2 + cube * (CUBE + 4)} {y} width={CUBE} />
        {/each}
        <text x={TEXT_X} y={y + TEXT_SIZE * 0.35} font-size={TEXT_SIZE} fill="var(--rtr-ink)"
            >{row.text}</text
        >
    {/each}
</g>
