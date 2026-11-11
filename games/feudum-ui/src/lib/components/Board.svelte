<script lang="ts">
    import type { Color } from '@tabletop/common'
    import GuildAreas from '$lib/components/guilds/GuildAreas.svelte'
    import BoardMotionLayer from '$lib/components/map/BoardMotionLayer.svelte'
    import MapLayers from '$lib/components/map/MapLayers.svelte'
    import BoardFrame from '$lib/components/tracks/BoardFrame.svelte'
    import BoardMargin from '$lib/components/tracks/BoardMargin.svelte'
    import TrackLayers from '$lib/components/tracks/TrackLayers.svelte'
    import { colourPaint, seatPaint } from '$lib/model/seatPaint.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BoardHeight, BoardWidth, MarginHeight } from '$lib/utils/boardGeometry.js'

    let gameSession = getGameSession()
    let chrome = $derived(gameSession.boardChrome)
    let tokens = $derived(gameSession.boardAnimator.tokens)

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
    data-board-surface
    use:gameSession.boardAnimator.attach
    pointer-events="none"
    width={BoardWidth}
    height={BoardHeight + MarginHeight}
    viewBox="0 0 {BoardWidth} {BoardHeight + MarginHeight}"
>
    <BoardFrame />
    <MapLayers state={gameSession.gameState} {paintOf} {chrome}>
        {#snippet underContents()}
            <BoardMotionLayer
                tokens={tokens.filter(({ layer }) => layer === 'under')}
                {paintOf}
                {colourPaintOf}
            />
        {/snippet}
    </MapLayers>
    <!-- Under the bench the board's own guild areas keep their state and take no presses, by key either. -->
    <g data-layer="guilds" visibility={gameSession.benchCovers ? 'hidden' : undefined}>
        <GuildAreas state={gameSession.gameState} {paintOf} {colourPaintOf} {chrome} />
    </g>
    <g data-layer="tracks"><TrackLayers state={gameSession.gameState} {paintOf} {chrome} /></g>
    <g data-layer="margin">
        <BoardMargin
            state={gameSession.gameState}
            viewerId={gameSession.myPlayerId}
            {paintOf}
            {colourPaintOf}
            {chrome}
        />
    </g>
    <g data-layer="motion">
        <BoardMotionLayer
            tokens={tokens.filter(({ layer }) => layer === 'over')}
            {paintOf}
            {colourPaintOf}
        />
    </g>
</svg>
