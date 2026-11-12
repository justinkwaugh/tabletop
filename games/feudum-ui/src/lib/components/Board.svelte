<script lang="ts">
    import GuildAreas from '$lib/components/guilds/GuildAreas.svelte'
    import BoardMotionLayer from '$lib/components/map/BoardMotionLayer.svelte'
    import MapLayers from '$lib/components/map/MapLayers.svelte'
    import BoardFrame from '$lib/components/tracks/BoardFrame.svelte'
    import GuildRails from '$lib/components/standings/GuildRails.svelte'
    import TrackLayers from '$lib/components/tracks/TrackLayers.svelte'
    import { guildStandingsOf } from '$lib/model/guildStandings.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { takesTradePicker } from '$lib/model/tradePicker.js'
    import { BoardHeight, BoardWidth, RailBeside } from '$lib/utils/boardGeometry.js'

    /**
     * Contract, Guild standings: where the guild rails stand. Beside the board on a desk; on a
     * phone only in a guild column's view, over the map's inner edge; none otherwise.
     */
    let { rails }: { rails?: 'beside' | 'west' | 'east' } = $props()

    let gameSession = getGameSession()
    let chrome = $derived(gameSession.boardChrome)
    let tokens = $derived(gameSession.boardAnimator.tokens)
    /** The bench draws the guild areas over the board; the trade picker stands beside it instead. */
    let guildsCovered = $derived.by(() => {
        const bench = gameSession.guildPanel?.bench
        return gameSession.benchCovers && !(bench && takesTradePicker(bench))
    })

    const { paintOf, colourPaintOf } = gameSession

    let standings = $derived(
        rails
            ? guildStandingsOf(gameSession.gameState, (playerId) =>
                  gameSession.getPlayerName(playerId)
              )
            : undefined
    )
    let beside = $derived(rails === 'beside')
    let overSide = $derived(rails === 'west' || rails === 'east' ? rails : undefined)
</script>

<div class="relative flex" style:gap={beside ? `${RailBeside.gap}px` : undefined} data-board-row>
    {#if standings && beside}
        <GuildRails view={standings} {paintOf} side="west" />
    {/if}
    <svg
        class="bg-feudum-surface"
        data-board-surface
        use:gameSession.boardAnimator.attach
        pointer-events="none"
        width={BoardWidth}
        height={BoardHeight}
        viewBox="0 0 {BoardWidth} {BoardHeight}"
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
        <g data-layer="guilds" visibility={guildsCovered ? 'hidden' : undefined}>
            <GuildAreas state={gameSession.gameState} {paintOf} {colourPaintOf} {chrome} />
        </g>
        <g data-layer="tracks"><TrackLayers state={gameSession.gameState} {paintOf} {chrome} /></g>

        <g data-layer="motion">
            <BoardMotionLayer
                tokens={tokens.filter(({ layer }) => layer === 'over')}
                {paintOf}
                {colourPaintOf}
            />
        </g>
    </svg>
    {#if standings && beside}
        <GuildRails view={standings} {paintOf} side="east" />
    {:else if standings && overSide}
        <GuildRails view={standings} {paintOf} side={overSide} over />
    {/if}
</div>
