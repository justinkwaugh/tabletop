<script lang="ts">
    import { ScrollSpaces, type HydratedFeudumGameState } from '@tabletop/feudum'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import { sealFaceShown } from '$lib/model/perspective.js'
    import { GuildSizes, ScrollCell, guildSlot } from '$lib/utils/boardGeometry.js'

    /** R-1.3 Six scroll spaces in rows of 3, 2, 1. R-5-H1 A seal there is the same crowned disc to all. */
    let { state }: { state: HydratedFeudumGameState } = $props()
</script>

{#each ScrollSpaces as space (space.id)}
    {@const at = guildSlot(space.id)}
    <rect
        x={at.x - ScrollCell.width / 2}
        y={at.y - ScrollCell.height / 2}
        width={ScrollCell.width}
        height={ScrollCell.height}
        rx="14"
        fill="var(--feudum-parchment-shade)"
        stroke="var(--feudum-ink)"
    ></rect>
    <path
        d="M{at.x - ScrollCell.width / 2 + 14} {at.y -
            ScrollCell.height / 2} v{ScrollCell.height} M{at.x + ScrollCell.width / 2 - 14} {at.y -
            ScrollCell.height / 2} v{ScrollCell.height}"
        stroke="var(--feudum-ink)"
        fill="none"
    ></path>
    {#if state.guilds.noble.scrolls[space.id]}
        <BoardPiece {at} piece="seal:{space.id}">
            <SealFace
                faceShown={sealFaceShown(false)}
                size={GuildSizes.seal}
                x={-GuildSizes.seal / 2}
                y={-GuildSizes.seal / 2}
            />
        </BoardPiece>
    {/if}
{/each}
