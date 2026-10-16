<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BOARD_HEIGHT, BOARD_WIDTH, TRACK_CELL, revenueCell } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'

    const gameSession = getGameSession()

    const CORNERS = new Set([0, 20, 50, 70])
    const MARKER_RADIUS = 11

    const cells = Array.from({ length: 100 }, (_, step) => ({ step, ...revenueCell(step) }))

    const bands = $derived(
        gameSession.gameState.edition.definition.obsolescence.map((band) => {
            const step = band.from + 4
            const middle = revenueCell(step)
            const inward = inwardOf(step)
            return {
                drop: band.drop,
                x: middle.x + TRACK_CELL / 2 + inward.x,
                y: middle.y + TRACK_CELL / 2 + inward.y
            }
        })
    )

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

    function inwardOf(step: number): { x: number; y: number } {
        const reach = TRACK_CELL * 0.72
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
        font-family: 'Libre Baskerville', Georgia, serif;
        font-weight: 700;
        text-anchor: middle;
        pointer-events: none;
    }

    .number.highlight {
        fill: #f2d438;
    }

    .band rect {
        fill: #5a4325;
        stroke: #f4f0d8;
        stroke-width: 1.5;
    }

    .band text {
        fill: #f4f0d8;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 12px;
        font-weight: 700;
        text-anchor: middle;
    }
</style>
