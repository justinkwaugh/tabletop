<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MARGIN_BOXES } from '$lib/utils/boardGeometry.js'
    import { ROUND_TICKET as TICKET, roundTicketLeft } from '$lib/utils/marginLayout.js'
    import { romanRound, roundTrack } from '$lib/utils/marginTracks.js'
    import { railroadNames } from '$lib/utils/railroadStyle.js'
    import RailroadPiece from './RailroadPiece.svelte'
    import MarginPanel from './MarginPanel.svelte'

    const gameSession = getGameSession()

    const box = MARGIN_BOXES.roundTrack
    const PIECE_WIDTH = 24

    const stops = $derived(roundTrack(gameSession.gameState))

    function stopLabel(round: number, newRailroadIds: readonly RailroadId[]): string {
        const made = newRailroadIds.length
            ? `, ${railroadNames(newRailroadIds, 'and')} made available`
            : ''
        return `Round ${round}${made}`
    }
</script>

<!-- R-1.4, R-2.1: rounds I-VI, the current one a punched ticket, each with its new railroads. -->
<MarginPanel {box} caption="Round · new railroad">
    {#each stops as stop (stop.round)}
        {@const left = roundTicketLeft(stop.round)}
        {@const centre = left + TICKET.width / 2}
        <g
            role="img"
            aria-label={stopLabel(stop.round, stop.newRailroadIds)}
            aria-current={stop.current ? 'step' : undefined}
        >
            <rect
                x={left}
                y={TICKET.top}
                width={TICKET.width}
                height={TICKET.height}
                rx="5"
                fill={stop.current ? 'var(--rtr-ink)' : 'var(--rtr-panel-raised)'}
                stroke="var(--rtr-line)"
                stroke-width="2"
            ></rect>
            <circle
                cx={left}
                cy={TICKET.top + TICKET.height / 2}
                r={TICKET.punch}
                fill="var(--rtr-panel)"
            ></circle>
            <circle
                cx={left + TICKET.width}
                cy={TICKET.top + TICKET.height / 2}
                r={TICKET.punch}
                fill="var(--rtr-panel)"
            ></circle>
            <text
                x={centre}
                y={TICKET.top + 35}
                text-anchor="middle"
                class="rtr-display numeral"
                fill={stop.current ? 'var(--rtr-panel)' : 'var(--rtr-ink)'}
                >{romanRound(stop.round)}</text
            >
            {#each stop.newRailroadIds as railroadId, index (railroadId)}
                <RailroadPiece
                    {railroadId}
                    x={centre + (index - (stop.newRailroadIds.length - 1) / 2) * (PIECE_WIDTH + 4)}
                    y={TICKET.top + TICKET.height + 15}
                    width={PIECE_WIDTH}
                />
            {/each}
        </g>
    {/each}
</MarginPanel>

<style>
    .numeral {
        font-size: 32px;
    }
</style>
