<script lang="ts">
    import type { Color } from '@tabletop/common'
    import GuildAreas from '$lib/components/guilds/GuildAreas.svelte'
    import MapLayers from '$lib/components/map/MapLayers.svelte'
    import BoardMargin from '$lib/components/tracks/BoardMargin.svelte'
    import TrackLayers from '$lib/components/tracks/TrackLayers.svelte'
    import { colourPaint, seatPaint } from '$lib/model/seatPaint.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BoardHeight, BoardWidth, MarginHeight } from '$lib/utils/boardGeometry.js'

    let gameSession = getGameSession()

    /** A seat's paint from the session's colourizer (S71), told apart by its initial as well. */
    function paintOf(playerId: string) {
        const initial = gameSession.getPlayerName(playerId).charAt(0).toUpperCase()
        return seatPaint(gameSession.colors, playerId, initial)
    }

    /** R-1.4-H1 A colour no seat plays, from the same colourizer. */
    function colourPaintOf(colour: Color) {
        return colourPaint(gameSession.colors, colour)
    }
</script>

<svg
    class="bg-feudum-surface"
    width={BoardWidth}
    height={BoardHeight + MarginHeight}
    viewBox="0 0 {BoardWidth} {BoardHeight + MarginHeight}"
>
    <rect width={BoardWidth} height={BoardHeight} fill="var(--feudum-board-frame)"></rect>
    <MapLayers state={gameSession.gameState} {paintOf} />
    <g data-layer="guilds">
        <GuildAreas state={gameSession.gameState} {paintOf} {colourPaintOf} />
    </g>
    <g data-layer="tracks"><TrackLayers state={gameSession.gameState} {paintOf} /></g>
    <g data-layer="margin">
        <BoardMargin
            state={gameSession.gameState}
            viewerId={gameSession.myPlayerId}
            {paintOf}
            {colourPaintOf}
        />
    </g>
</svg>
