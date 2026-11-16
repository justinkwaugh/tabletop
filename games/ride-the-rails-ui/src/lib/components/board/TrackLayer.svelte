<script lang="ts">
    import type { HexId } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { locomotivePieces, thisTurnPlacements } from '$lib/utils/boardPieces.js'
    import RailroadPiece from './RailroadPiece.svelte'

    let { standAside }: { standAside: ReadonlySet<HexId> } = $props()

    const gameSession = getGameSession()

    // An Undo's flight shrinks a copy of each cube it takes away (FlightLayer).
    const locomotives = $derived(
        locomotivePieces(gameSession.gameState.track, standAside).filter(
            (piece) => !gameSession.flights.hiddenKeys.has(piece.key)
        )
    )
    const thisTurn = $derived(thisTurnPlacements(gameSession.gameState, gameSession.actions))
    const thisTurnKeys = $derived(new Set(thisTurn?.locomotives.map((piece) => piece.key)))
    const thisTurnPieces = $derived(locomotives.filter((piece) => thisTurnKeys.has(piece.key)))
    const barColour = $derived(
        thisTurn ? gameSession.colors.getPlayerUiColor(thisTurn.playerId) : 'transparent'
    )

    // While a railroad is spotlit, every other railroad's cubes fade; the board is left as it is.
    const FADED = 0.2
    const spotlight = $derived(gameSession.spotlightRailroadId)

    // The bar under a cube placed this building turn, as a share of the cube's width.
    const BAR_WIDTH = 0.76
    const BAR_HEIGHT = 4.4
</script>

<!-- R-3.2, R-4.1: every railroad's cubes in its rule colour; this building turn's carry a seat bar.
     A spotlit railroad's stay whole and the rest fade. -->
<g class="track" aria-hidden="true">
    {#each locomotives as piece (piece.key)}
        <g opacity={spotlight && piece.railroadId !== spotlight ? FADED : undefined}>
            <RailroadPiece
                railroadId={piece.railroadId}
                x={piece.slot.x}
                y={piece.slot.y}
                width={piece.slot.width}
            />
        </g>
    {/each}
    {#each thisTurnPieces as piece (piece.key)}
        <rect
            x={piece.slot.x - (piece.slot.width * BAR_WIDTH) / 2}
            y={piece.slot.y + piece.slot.height / 2 + 1}
            width={piece.slot.width * BAR_WIDTH}
            height={BAR_HEIGHT}
            rx="1.6"
            fill={barColour}
            stroke="var(--rtr-halo)"
            stroke-width="1"
        ></rect>
    {/each}
</g>
