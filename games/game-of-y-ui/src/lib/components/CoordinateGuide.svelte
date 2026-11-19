<script lang="ts">
    import { neighborsOf, POINTS, ROW_LENGTHS, rowOf } from '@tabletop/game-of-y'
    import { BoardShape } from '@tabletop/game-of-y'
    import { planOf } from '$lib/board/geometry.js'

    // Every point named, each row traced in its own colour, the three pentads ringed.
    const ROW_COLORS = [
        '#b5382b',
        '#c8601c',
        '#a88a12',
        '#3f8f3a',
        '#13897a',
        '#2a73b0',
        '#7d4aa0',
        '#b23a78',
        '#3a3f48'
    ]
    const SCALE = 0.62
    const MARK = 13

    const at = (point: string) => {
        const { x, y } = planOf(BoardShape.Kadon, point)
        return { x: x * SCALE, y: y * SCALE }
    }

    const links = POINTS.flatMap((point) =>
        neighborsOf(point)
            .filter((other) => POINTS.indexOf(other) > POINTS.indexOf(point))
            .map((other) => [at(point), at(other)])
    )

    const rows = ROW_LENGTHS.map((_, index) => {
        const row = index + 1
        const points = POINTS.filter((point) => rowOf(point) === row)
        return { row, color: ROW_COLORS[index], path: points.map(at) }
    })

    const pentads = new Set(POINTS.filter((point) => neighborsOf(point).length === 5))

    const all = POINTS.map(at)
    const box = {
        x: Math.min(...all.map((p) => p.x)) - MARK - 6,
        y: Math.min(...all.map((p) => p.y)) - MARK - 6,
        width: Math.max(...all.map((p) => p.x)) - Math.min(...all.map((p) => p.x)) + MARK * 2 + 12,
        height: Math.max(...all.map((p) => p.y)) - Math.min(...all.map((p) => p.y)) + MARK * 2 + 12
    }
</script>

<div class="guide">
    <svg
        viewBox="{box.x} {box.y} {box.width} {box.height}"
        role="img"
        aria-label="Every point of the board named, row by row"
    >
        <g class="links">
            {#each links as [a, b], index (index)}
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}></line>
            {/each}
        </g>
        {#each rows as { row, color, path } (row)}
            <polyline points={path.map((p) => `${p.x},${p.y}`).join(' ')} stroke={color} class="row"
            ></polyline>
        {/each}
        {#each rows as { row, color } (row)}
            {#each POINTS.filter((point) => rowOf(point) === row) as point (point)}
                {@const p = at(point)}
                {#if pentads.has(point)}
                    <circle cx={p.x} cy={p.y} r={MARK + 4} class="pentad"></circle>
                {/if}
                <circle cx={p.x} cy={p.y} r={MARK} stroke={color} class="point"></circle>
                <text x={p.x} y={p.y} dy="3.6" fill={color}>{point}</text>
            {/each}
        {/each}
    </svg>
    <ul>
        <li><b>Row 1</b> is the bottom side, A1 to I1.</li>
        <li>
            <b>Rows 2–8</b> each start on the left side (A2, A3 …), bend round the middle and end on the
            right side, one band further in than the row before; letters count along the row from A.
        </li>
        <li><b>Row 9</b> runs down from the top corner, A9, to E9.</li>
        <li>
            <b>Corners</b> A1, I1 and A9 count for both their sides. Ringed: the pentads, with five neighbours.
        </li>
    </ul>
</div>

<style>
    .guide {
        width: min(560px, 92vw);
        padding: 10px 12px 12px;
        background: #faf6ee;
        color: #2c2116;
        letter-spacing: normal;
        text-align: left;
    }

    svg {
        display: block;
        width: 100%;
        height: auto;
    }

    .links line {
        stroke: #d6c4a2;
        stroke-width: 1;
    }

    .row {
        fill: none;
        stroke-width: 3;
        stroke-linejoin: round;
        stroke-linecap: round;
    }

    .point {
        fill: #ffffff;
        stroke-width: 1.6;
    }

    .pentad {
        fill: none;
        stroke: #2c2116;
        stroke-width: 1.4;
    }

    text {
        font-size: 10px;
        font-weight: 700;
        text-anchor: middle;
    }

    ul {
        margin: 8px 0 0;
        padding-left: 18px;
        list-style: disc;
        font-size: 13px;
        line-height: 1.35;
    }

    li + li {
        margin-top: 3px;
    }
</style>
