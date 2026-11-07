<script lang="ts">
    import MapLayers from '$lib/components/map/MapLayers.svelte'
    import { seatPaint } from '$lib/model/seatPaint.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BoardHeight, BoardWidth, MarginHeight } from '$lib/utils/boardGeometry.js'

    let gameSession = getGameSession()

    /** A seat's paint from the session's colourizer (S71), told apart by its initial as well. */
    function paintOf(playerId: string) {
        const initial = gameSession.getPlayerName(playerId).charAt(0).toUpperCase()
        return seatPaint(gameSession.colors, playerId, initial)
    }
</script>

<svg
    class="bg-feudum-surface"
    width={BoardWidth}
    height={BoardHeight + MarginHeight}
    viewBox="0 0 {BoardWidth} {BoardHeight + MarginHeight}"
>
    <MapLayers state={gameSession.gameState} {paintOf} />
</svg>
