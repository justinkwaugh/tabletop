<script lang="ts">
    import GuildAreas from '$lib/components/guilds/GuildAreas.svelte'
    import BoardMotionLayer from '$lib/components/map/BoardMotionLayer.svelte'
    import MapLayers from '$lib/components/map/MapLayers.svelte'
    import BoardFrame from '$lib/components/tracks/BoardFrame.svelte'
    import GuildRails from '$lib/components/standings/GuildRails.svelte'
    import GuildStrip from '$lib/components/standings/GuildStrip.svelte'
    import TrackLayers from '$lib/components/tracks/TrackLayers.svelte'
    import { guildStandingsOf } from '$lib/model/guildStandings.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { takesTradePicker } from '$lib/model/tradePicker.js'
    import { BoardHeight, BoardWidth, MapArea } from '$lib/utils/boardGeometry.js'

    /**
     * Contract, Guild standings: `rails` is the strip on a desk, a guild column's edge on a phone.
     * Contract, Desk layout: a desk draws only the map, with no score ring.
     */
    let { rails, desk = false }: { rails?: 'strip' | 'west' | 'east'; desk?: boolean } = $props()

    let drawn = $derived(desk ? MapArea : { x: 0, y: 0, width: BoardWidth, height: BoardHeight })

    let gameSession = getGameSession()
    let chrome = $derived(gameSession.boardChrome)
    let tokens = $derived(gameSession.boardAnimator.tokens)
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
    let overSide = $derived(rails === 'west' || rails === 'east' ? rails : undefined)
</script>

<div class="relative flex" data-board-row>
    <svg
        class="bg-feudum-surface"
        data-board-surface
        use:gameSession.boardAnimator.attach
        pointer-events="none"
        width={drawn.width}
        height={drawn.height}
        viewBox="{drawn.x} {drawn.y} {drawn.width} {drawn.height}"
    >
        <BoardFrame printed={!desk} />
        <MapLayers state={gameSession.gameState} {paintOf} {chrome}>
            {#snippet underContents()}
                <BoardMotionLayer
                    tokens={tokens.filter(({ layer }) => layer === 'under')}
                    {paintOf}
                    {colourPaintOf}
                />
            {/snippet}
        </MapLayers>
        {#if !desk}
            <!-- Hidden, not removed: they keep their state and take no presses, by key either. -->
            <g data-layer="guilds" visibility={guildsCovered ? 'hidden' : undefined}>
                <GuildAreas state={gameSession.gameState} {paintOf} {colourPaintOf} {chrome} />
            </g>
        {/if}
        <g data-layer="tracks"
            ><TrackLayers state={gameSession.gameState} {paintOf} {chrome} ring={!desk} /></g
        >

        <g data-layer="motion">
            <BoardMotionLayer
                tokens={tokens.filter(({ layer }) => layer === 'over')}
                {paintOf}
                {colourPaintOf}
            />
        </g>
    </svg>
    {#if standings && overSide}
        <GuildRails view={standings} {paintOf} side={overSide} />
    {/if}
</div>
{#if standings && rails === 'strip'}
    <GuildStrip view={standings} {paintOf} seats={gameSession.gameState.players.length} />
{/if}
