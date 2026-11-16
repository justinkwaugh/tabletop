<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import RailroadPiece from './RailroadPiece.svelte'

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

    // R-4.2: where each railroad's first locomotive may go.
    const ROWS: readonly { railroadIds: readonly RailroadId[]; text: string }[] = [
        {
            railroadIds: ['railroad.red', 'railroad.blue'],
            text: 'Different East Coast cities'
        },
        { railroadIds: ['railroad.orange'], text: 'An East Coast city or Chicago' },
        {
            railroadIds: ['railroad.yellow'],
            text: 'Chicago or the 3 westernmost developed cities'
        },
        { railroadIds: ['railroad.purple'], text: 'A West Coast city' },
        { railroadIds: ['railroad.black'], text: 'Any city with room' }
    ]

    const height = PAD + TITLE_SIZE + 10 + ROWS.length * ROW + PAD - 8
    const top = BOTTOM - height
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
