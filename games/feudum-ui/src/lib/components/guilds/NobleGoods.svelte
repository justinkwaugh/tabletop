<script lang="ts">
    import { ScrollSpaces, type HydratedFeudumGameState } from '@tabletop/feudum'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import { sealFaceShown } from '$lib/model/perspective.js'
    import { GuildSizes, ScrollCell, guildPrinted, guildSlot } from '$lib/utils/boardGeometry.js'
    import { PrintedSizes } from '$lib/utils/printedGuilds.js'

    /** R-1.3 Six scroll spaces in rows of 3, 2, 1. R-5-H1 A seal there is the same crowned disc to all. */
    let { state }: { state: HydratedFeudumGameState } = $props()

    /** The printed panel draws the scrolls; the seals stand on them. */
    let printed = $derived(guildPrinted('noble'))
    let seal = $derived(printed ? PrintedSizes.seal : GuildSizes.seal)
</script>

{#each ScrollSpaces as space (space.id)}
    {@const at = guildSlot(space.id)}
    {#if !printed}
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
                ScrollCell.height / 2} v{ScrollCell.height} M{at.x +
                ScrollCell.width / 2 -
                14} {at.y - ScrollCell.height / 2} v{ScrollCell.height}"
            stroke="var(--feudum-ink)"
            fill="none"
        ></path>
    {/if}
    {#if state.guilds.noble.scrolls[space.id]}
        <BoardPiece {at} piece="seal:{space.id}">
            <SealFace faceShown={sealFaceShown(false)} size={seal} x={-seal / 2} y={-seal / 2} />
        </BoardPiece>
    {/if}
{/each}
