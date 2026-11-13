<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MARGIN_BOXES, drawsSeatInitials } from '$lib/utils/boardGeometry.js'
    import { ordinal, turnOrderTrack } from '$lib/utils/marginTracks.js'
    import { TURN_ORDER_MARKER, turnOrderMarkerX } from '$lib/utils/marginLayout.js'
    import { markerKey, moneyKey } from '$lib/animators/flights.svelte.js'
    import MarginPanel from './MarginPanel.svelte'
    import SeatMarker from './SeatMarker.svelte'

    let { viewScale, initials }: { viewScale: number; initials: ReadonlyMap<string, string> } =
        $props()

    const gameSession = getGameSession()
    const flights = gameSession.flights

    const box = MARGIN_BOXES.turnOrder
    const MARKER_RADIUS = TURN_ORDER_MARKER.radius
    const MARKER_Y = TURN_ORDER_MARKER.y

    // Money ticks ahead of the shown state as each coin lands, and at the end of a round each
    // marker slides with its money to its new place (Animation plan).
    const stops = $derived(
        turnOrderTrack(gameSession.gameState).map((stop) => ({
            ...stop,
            money: gameSession.flights.shown(moneyKey(stop.playerId), stop.money)
        }))
    )
    const showsInitials = $derived(drawsSeatInitials(viewScale))
</script>

<!-- R-2.3, R-2.5: the turn manager's order, each seat's marker with its money. -->
<MarginPanel {box} caption="Turn order · money">
    {#each stops as stop (stop.playerId)}
        {@const centre = turnOrderMarkerX(stop.position)}
        <g
            role="img"
            aria-label="{ordinal(stop.position)}: {gameSession.getPlayerName(
                stop.playerId
            )}, ${stop.money}"
        >
            <text
                x={centre - MARKER_RADIUS - 8}
                y={MARKER_Y + 5}
                text-anchor="end"
                class="position"
                fill="var(--rtr-ink-muted)">{stop.position}</text
            >
            <g use:flights.register={markerKey(stop.playerId)}>
                <SeatMarker
                    playerId={stop.playerId}
                    initials={showsInitials ? initials.get(stop.playerId) : undefined}
                    x={centre}
                    y={MARKER_Y}
                    radius={MARKER_RADIUS}
                />
                <text
                    x={centre}
                    y={MARKER_Y + MARKER_RADIUS + 26}
                    text-anchor="middle"
                    class="money"
                    fill="var(--rtr-ink)">${stop.money}</text
                >
            </g>
        </g>
    {/each}
</MarginPanel>

<style>
    .position {
        font-size: 15px;
        font-weight: 700;
    }

    .money {
        font-size: 22px;
        font-weight: 800;
    }
</style>
