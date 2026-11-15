<script lang="ts">
    import Level from './Level.svelte'
    import {
        AlchemistCartSpaces,
        AlchemistTradePrice,
        Goods,
        Inventions,
        VesselTypes,
        type HydratedFeudumGameState,
        type Recipe
    } from '@tabletop/feudum'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import CountChip from '$lib/components/map/CountChip.svelte'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import VesselToken from '$lib/components/pieces/VesselToken.svelte'
    import {
        CartCell,
        CartGoods,
        GuildSizes,
        InventionCell,
        VesselSpaceBox,
        cartGoodRow,
        guildPrinted,
        guildSlot,
        vesselForSale,
        vesselForSaleSize
    } from '$lib/utils/boardGeometry.js'
    import { PrintedSizes } from '$lib/utils/printedGuilds.js'
    import { BarrelPath } from '$lib/utils/trackShape.js'

    /**
     * R-1.3 The carts and piles, and the vessels for sale over the ferry symbol. R-4.6.5 The inventions
     * with their recipes, from the data.
     */
    let { state }: { state: HydratedFeudumGameState } = $props()

    /** The printed panel says the carts, the vessel space and the recipes; the goods stand over it. */
    let printed = $derived(guildPrinted('alchemist'))
    let cartGood = $derived(printed ? PrintedSizes.cartGood : GuildSizes.good)
    let vesselSize = $derived(vesselForSaleSize())

    const RecipeToken = 16

    function recipeGoods(recipe: Recipe) {
        return Goods.flatMap((good) => Array.from({ length: recipe[good] ?? 0 }, () => good))
    }
</script>

{#if !printed}
    {#each CartGoods as good (good)}
        {@const row = cartGoodRow(good)}
        <g opacity="0.45" data-bin={good}>
            <GoodToken {good} size={26} x={row.x - 13} y={row.y - 13} />
        </g>
    {/each}
{/if}
{#each AlchemistCartSpaces as space (space.id)}
    {@const at = guildSlot(space.id)}
    {#if !printed}
        <rect
            x={at.x - CartCell.width / 2}
            y={at.y - CartCell.height / 2}
            width={CartCell.width}
            height={CartCell.height}
            rx="6"
            fill="var(--feudum-parchment-shade)"
            stroke="var(--feudum-ink)"
        ></rect>
    {/if}
    {#if state.guilds.alchemist.carts[space.id]}
        <BoardPiece {at} piece="good:{space.id}">
            <GoodToken good={space.good} size={cartGood} x={-cartGood / 2} y={-cartGood / 2} />
        </BoardPiece>
    {/if}
{/each}

{#if !printed}
    <rect
        x={VesselSpaceBox.x}
        y={VesselSpaceBox.y}
        width={VesselSpaceBox.width}
        height={VesselSpaceBox.height}
        rx="8"
        fill="var(--feudum-parchment-shade)"
        stroke="var(--feudum-ink)"
    ></rect>
    <Level at={{ x: VesselSpaceBox.x + 8, y: VesselSpaceBox.y + 16 }}
        ><text
            x={VesselSpaceBox.x + 8}
            y={VesselSpaceBox.y + 16}
            font-size="14"
            fill="var(--feudum-ink)">For sale · {AlchemistTradePrice}s</text
        ></Level
    >
{/if}
{#each VesselTypes as vessel (vessel)}
    {@const at = vesselForSale(vessel)}
    {@const held = state.guilds.alchemist.vesselsForSale.filter((sale) => sale === vessel).length}
    {#if held > 0}
        <BoardPiece {at} piece="vessel-for-sale:{vessel}">
            <VesselToken {vessel} size={vesselSize} x={-vesselSize / 2} y={-vesselSize / 2} />
            {#if held > 1}
                <CountChip count={held} x={vesselSize * 0.4} y={-vesselSize * 0.37} />
            {/if}
        </BoardPiece>
    {/if}
{/each}

{#if !printed}
    {#each Inventions as invention (invention.id)}
        {@const at = guildSlot(invention.id)}
        {@const goods = recipeGoods(invention.recipe)}
        <g data-invention={invention.id}>
            <rect
                x={at.x - InventionCell.width / 2}
                y={at.y - InventionCell.height / 2}
                width={InventionCell.width}
                height={InventionCell.height}
                rx="6"
                fill="var(--feudum-parchment)"
                stroke="var(--feudum-ink)"
            ></rect>
            {#if 'vessel' in invention}
                <VesselToken vessel={invention.vessel} size={38} x={at.x - 19} y={at.y - 36} />
            {:else}
                <svg x={at.x - 24} y={at.y - 32} width="24" height="24" viewBox="0 0 24 24">
                    <path
                        d={BarrelPath}
                        fill="var(--feudum-wood-piece)"
                        stroke="var(--feudum-ink)"
                        stroke-width="1.5"
                    ></path>
                </svg>
                <Level at={{ x: at.x + 10, y: at.y - 14 }}
                    ><text
                        x={at.x + 10}
                        y={at.y - 14}
                        text-anchor="middle"
                        font-size="16"
                        fill="var(--feudum-ink)">{invention.barrel}</text
                    ></Level
                >
            {/if}
            {#each goods as good, index (index)}
                <GoodToken
                    {good}
                    size={RecipeToken}
                    x={at.x +
                        (index - (goods.length - 1) / 2) * (RecipeToken + 2) -
                        RecipeToken / 2}
                    y={at.y + 14}
                />
            {/each}
        </g>
    {/each}
{/if}
