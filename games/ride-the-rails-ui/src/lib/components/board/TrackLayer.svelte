<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { locomotivePieces, thisTurnPlacements } from '$lib/utils/boardPieces.js'
    import RailroadPiece from './RailroadPiece.svelte'

    const gameSession = getGameSession()

    // An Undo's flight shrinks a copy of each cube it takes away (FlightLayer).
    const locomotives = $derived(
        locomotivePieces(gameSession.gameState.track).filter(
            (piece) => !gameSession.flights.hiddenKeys.has(piece.key)
        )
    )
    const thisTurn = $derived(thisTurnPlacements(gameSession.gameState, gameSession.actions))
    const barColour = $derived(
        thisTurn ? gameSession.colors.getPlayerUiColor(thisTurn.playerId) : 'transparent'
    )

    // The bar under a cube placed this building turn, as a share of the cube's width.
    const BAR_WIDTH = 0.76
    const BAR_HEIGHT = 4.4
</script>

<!-- R-3.2, R-4.1: every railroad's cubes in its rule colour; this building turn's carry a seat bar. -->
<g class="track" aria-hidden="true">
    {#each locomotives as piece (piece.key)}
        <RailroadPiece
            railroadId={piece.railroadId}
            x={piece.slot.x}
            y={piece.slot.y}
            width={piece.slot.width}
        />
    {/each}
    {#each thisTurn?.locomotives ?? [] as piece (piece.key)}
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
