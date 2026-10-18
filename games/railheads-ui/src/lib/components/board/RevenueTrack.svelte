<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BOARD_HEIGHT, BOARD_WIDTH, TRACK_CELL, revenueCell } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'

    const gameSession = getGameSession()

    const CORNERS = new Set([0, 20, 50, 70])
    const MARKER_RADIUS = 11

    const cells = Array.from({ length: 100 }, (_, step) => ({ step, ...revenueCell(step) }))

    const BAND_WIDTH = 10
    // Like the printed board: each arrow runs just inside the track's inner edge,
    // from the start of its band's first cell to the end of its last, pointing down the track.
    const LINE_INSET = TRACK_CELL / 2 - 5
    const BUBBLE_INSET = LINE_INSET + 4
    const BAND_GAP = 3
    const ARROW_HEAD = 6

    const bands = $derived.by(() => {
        const obsolescence = gameSession.gameState.edition.definition.obsolescence
        return obsolescence.map((band, index) => {
            const last = (obsolescence[index + 1]?.from ?? band.from + BAND_WIDTH) - 1
            // A corner cell belongs to the next side, so a band ending on one stops at its edge.
            const lastOnSide = CORNERS.has(last % 100) ? last - 1 : last
            const tip = cellEdge(band.from, band.from + 1)
            const tail = cellEdge(lastOnSide, lastOnSide - 1)
            const length = Math.hypot(tip.x - tail.x, tip.y - tail.y)
            const along = { x: (tip.x - tail.x) / length, y: (tip.y - tail.y) / length }
            const across = { x: -along.y, y: along.x }
            const head = { x: tip.x - along.x * BAND_GAP, y: tip.y - along.y * BAND_GAP }
            const base = { x: head.x - along.x * ARROW_HEAD, y: head.y - along.y * ARROW_HEAD }
            const end = { x: tail.x + along.x * BAND_GAP, y: tail.y + along.y * BAND_GAP }
            const bubble = bubblePoint(band.from + 4)
            return {
                drop: band.drop,
                x: bubble.x,
                y: bubble.y,
                shaft: `M ${end.x} ${end.y} L ${base.x} ${base.y}`,
                head: [
                    head,
                    { x: base.x + across.x * ARROW_HEAD * 0.5, y: base.y + across.y * ARROW_HEAD * 0.5 },
                    { x: base.x - across.x * ARROW_HEAD * 0.5, y: base.y - across.y * ARROW_HEAD * 0.5 }
                ]
                    .map((point) => `${point.x},${point.y}`)
                    .join(' ')
            }
        })
    })

    // Along the top and bottom the bubble hangs just below or above the numbers. Down the sides
    // it is wider than the gap beside them, so it sits on the line between two numbers instead.
    function bubblePoint(step: number): { x: number; y: number } {
        if (inwardOf(step, 1).y !== 0) {
            return trackPoint(step, BUBBLE_INSET)
        }
        const cell = trackPoint(step, LINE_INSET)
        const next = trackPoint(step + 1, LINE_INSET)
        return { x: (cell.x + next.x) / 2, y: (cell.y + next.y) / 2 }
    }

    // The outer edge of a cell, on the side away from its neighbour along the track.
    function cellEdge(step: number, neighbour: number): { x: number; y: number } {
        const cell = trackPoint(step, LINE_INSET)
        const other = trackPoint(neighbour, LINE_INSET)
        return { x: cell.x + (cell.x - other.x) / 2, y: cell.y + (cell.y - other.y) / 2 }
    }

    function trackPoint(step: number, inset: number): { x: number; y: number } {
        const cell = revenueCell(step)
        const inward = inwardOf(step, inset)
        return { x: cell.x + TRACK_CELL / 2 + inward.x, y: cell.y + TRACK_CELL / 2 + inward.y }
    }

    const markers = $derived.by(() => {
        const state = gameSession.shownState
        const byCell = new Map<number, number>()
        return state.companies.map((company) => {
            const step = company.revenue % 100
            const index = byCell.get(step) ?? 0
            byCell.set(step, index + 1)
            const cell = revenueCell(company.revenue)
            const offsets = [
                { x: -8, y: -8 },
                { x: 8, y: -8 },
                { x: -8, y: 8 },
                { x: 8, y: 8 },
                { x: 0, y: 0 }
            ]
            const offset = offsets[index % offsets.length]
            return {
                companyId: company.id,
                revenue: company.revenue,
                x: cell.x + TRACK_CELL / 2 + offset.x,
                y: cell.y + TRACK_CELL / 2 + offset.y
            }
        })
    })

    function inwardOf(step: number, reach: number): { x: number; y: number } {
        if (step <= 20) return { x: 0, y: reach }
        if (step <= 50) return { x: -reach, y: 0 }
        if (step <= 70) return { x: 0, y: -reach }
        return { x: reach, y: 0 }
    }

    function label(step: number): string {
        if (step === 0) return '0/100'
        return step < 10 ? `0${step}` : `${step}`
    }
</script>

<rect x="0" y="0" width={BOARD_WIDTH} height={BOARD_HEIGHT} rx="10" fill="#33401a" />
<rect
    x={TRACK_CELL}
    y={TRACK_CELL}
    width={BOARD_WIDTH - 2 * TRACK_CELL}
    height={BOARD_HEIGHT - 2 * TRACK_CELL}
    fill="#e6e2c3"
/>
{#each cells as cell (cell.step)}
    {@const corner = CORNERS.has(cell.step)}
    <rect
        x={cell.x + 1}
        y={cell.y + 1}
        width={TRACK_CELL - 2}
        height={TRACK_CELL - 2}
        rx="3"
        fill={corner ? '#1f280c' : cell.step % 5 === 0 ? '#2a3512' : '#3e4d1f'}
    />
    <text
        x={cell.x + TRACK_CELL / 2}
        y={cell.y + TRACK_CELL / 2 + 5}
        class="number"
        class:highlight={cell.step % 5 === 0}
        class:corner
        font-size={cell.step === 0 ? 11 : corner ? 17 : 14}>{label(cell.step)}</text
    >
{/each}
{#each bands as band (band.drop)}
    <g class="band-arrow">
        <path d={band.shaft} />
        <polygon points={band.head} />
    </g>
    <g class="band" transform="translate({band.x} {band.y})">
        <rect x="-15" y="-9" width="30" height="18" rx="9" />
        <text y="4.5">−{band.drop}</text>
    </g>
{/each}
{#each markers as marker (marker.companyId)}
    {@const style = COMPANY_STYLE[marker.companyId]}
    <circle
        cx={marker.x}
        cy={marker.y}
        r={MARKER_RADIUS}
        fill={style.fill}
        stroke={style.text === '#ffffff' ? '#f4f0d8' : '#1d1d1b'}
        stroke-width="2"
    >
        <title>{gameSession.gameState.companyDefinition(marker.companyId).shortName} revenue {marker.revenue}</title>
    </circle>
{/each}

<style>
    .number {
        fill: #f4f0d8;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-weight: 700;
        text-anchor: middle;
        pointer-events: none;
    }

    .number.highlight {
        fill: #f2d438;
    }

    .band-arrow {
        fill: #f4f0d8;
        stroke: #f4f0d8;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .band rect {
        fill: #5a4325;
        stroke: #f4f0d8;
        stroke-width: 1.5;
    }

    .band text {
        fill: #f4f0d8;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 12px;
        font-weight: 700;
        text-anchor: middle;
    }
</style>
