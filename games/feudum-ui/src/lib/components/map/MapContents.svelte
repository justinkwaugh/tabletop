<script lang="ts">
    import {
        RegionTiles,
        Spaces,
        type HydratedFeudumGameState,
        type SpaceId,
        type TileId
    } from '@tabletop/feudum'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import TileFace from '$lib/components/pieces/TileFace.svelte'
    import VesselToken from '$lib/components/pieces/VesselToken.svelte'
    import { abandonedVessels, goodStacks } from '$lib/model/mapView.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import {
        GoodSize,
        GoodStackStep,
        ImmunitySealSize,
        LandscapeSize,
        MarkerSize,
        VesselSize,
        spaceGeometry,
        type Point
    } from '$lib/utils/boardGeometry.js'
    import BoardPiece from './BoardPiece.svelte'
    import CountChip from './CountChip.svelte'

    /**
     * What lies on a space: its landscape, goods, abandoned vessels and influence markers. R-4.1.2 The
     * ruler's marker on the disc, a subject beside it in the same colour, a serf below in the other;
     * R-3.14.2 an immunity seal under the marker it guards.
     */
    let {
        state,
        paintOf
    }: { state: HydratedFeudumGameState; paintOf: (playerId: string) => SeatPaint } = $props()

    function epochOf(tileId: TileId) {
        return RegionTiles.find(({ id }) => id === tileId)?.epoch ?? 1
    }
</script>

{#snippet marker(spaceId: SpaceId, role: string, at: Point, playerId: string, immune: boolean)}
    <BoardPiece {at} piece="marker:{spaceId}:{role}">
        {#if immune}
            <g data-immune>
                <SealFace
                    faceShown={false}
                    size={ImmunitySealSize}
                    x={-ImmunitySealSize / 2}
                    y={MarkerSize / 2 - ImmunitySealSize / 2}
                />
            </g>
        {/if}
        <g data-role={role}>
            <SeatToken
                kind="marker"
                paint={paintOf(playerId)}
                size={MarkerSize}
                x={-MarkerSize / 2}
                y={-MarkerSize / 2}
            />
        </g>
    </BoardPiece>
{/snippet}

{#each Spaces as { id } (id)}
    {@const space = state.spaces[id]}
    {@const geometry = spaceGeometry(id)}
    {#if space.landscape}
        {@const tileId = space.landscape.tileId}
        <BoardPiece at={geometry.landscape} piece="landscape:{id}">
            <TileFace
                faceShown={true}
                epoch={epochOf(tileId)}
                landscape={state.tileLandscapes[tileId]}
                size={LandscapeSize}
                x={-LandscapeSize / 2}
                y={-LandscapeSize / 2}
            />
            {#if space.landscape.amount > 0}
                <CountChip
                    count={space.landscape.amount}
                    x={LandscapeSize / 2}
                    y={LandscapeSize / 2}
                />
            {/if}
        </BoardPiece>
    {/if}
    {#each goodStacks(space.goods) as stack, column (stack.good)}
        {#each { length: stack.tokens }, token (token)}
            <BoardPiece
                at={{
                    x: geometry.goods[column].x,
                    y: geometry.goods[column].y + token * GoodStackStep
                }}
                piece="good:{id}:{stack.good}:{token}"
            >
                <GoodToken good={stack.good} size={GoodSize} x={-GoodSize / 2} y={-GoodSize / 2} />
                {#if stack.count}
                    <CountChip count={stack.count} x={GoodSize / 2} y={GoodSize / 2} />
                {/if}
            </BoardPiece>
        {/each}
    {/each}
    {#each abandonedVessels(space.vessels) as { vessel, count } (vessel)}
        <BoardPiece at={geometry.vessels[vessel]} piece="vessel:{id}:{vessel}">
            <VesselToken {vessel} size={VesselSize} x={-VesselSize / 2} y={(-VesselSize * 2) / 6} />
            {#if count > 1}
                <CountChip {count} x={VesselSize / 2} y={VesselSize / 3} />
            {/if}
        </BoardPiece>
    {/each}
    {#if space.ruler}
        {@render marker(id, 'ruler', geometry.ruler, space.ruler.playerId, false)}
        {#if space.ruler.subject}
            {@render marker(
                id,
                'subject',
                geometry.subject,
                space.ruler.playerId,
                space.ruler.subjectImmune === true
            )}
        {/if}
    {/if}
    {#if space.serf}
        {@render marker(id, 'serf', geometry.serf, space.serf.playerId, space.serf.immune === true)}
    {/if}
{/each}
