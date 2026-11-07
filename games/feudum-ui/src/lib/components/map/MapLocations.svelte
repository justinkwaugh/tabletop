<script lang="ts">
    import { Spaces, type HydratedFeudumGameState } from '@tabletop/feudum'
    import { MapAsset, assetUrl } from '$lib/art/assetMap.js'
    import LocationDisc from '$lib/components/pieces/LocationDisc.svelte'
    import { DiscFrame, spaceGeometry } from '$lib/utils/boardGeometry.js'
    import BoardPiece from './BoardPiece.svelte'

    /**
     * R-1.2.1 Each space's disc, with the start ring in map ink. The letters are printed on
     * the map, so they are drawn only on our own terrain.
     */
    let { state }: { state: HydratedFeudumGameState } = $props()
    let drawnLetters = $derived(!assetUrl(MapAsset))
</script>

{#each Spaces as space (space.id)}
    {@const geometry = spaceGeometry(space.id)}
    {@const location = state.spaces[space.id].location}
    <BoardPiece at={geometry.centre} piece="disc:{space.id}">
        <LocationDisc
            kind={location.kind}
            guild={location.feudumGuild}
            start={space.startingSpace}
            size={DiscFrame}
            x={-DiscFrame / 2}
            y={-DiscFrame / 2}
        />
    </BoardPiece>
    {#if drawnLetters && space.letters.length > 0}
        <text
            x={geometry.letters.x}
            y={geometry.letters.y}
            text-anchor="middle"
            font-size="16"
            font-weight="700"
            fill="var(--feudum-map-ink)"
            data-letters={space.id}>{space.letters.join('')}</text
        >
    {/if}
{/each}
