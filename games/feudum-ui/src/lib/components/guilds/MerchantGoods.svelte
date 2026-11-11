<script lang="ts">
    import { Goods, MarketSpaces, type HydratedFeudumGameState } from '@tabletop/feudum'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import {
        GuildSizes,
        MarketCell,
        guildPrinted,
        guildSlot,
        marketBinRow
    } from '$lib/utils/boardGeometry.js'

    /**
     * R-1.3 The market: five bins by four spaces, each with its price from the data. The printed
     * panel says the bins and prices itself, so only the goods stand over it.
     */
    let { state }: { state: HydratedFeudumGameState } = $props()

    let printed = $derived(guildPrinted('merchant'))
</script>

{#if !printed}
    {#each Goods as good (good)}
        {@const row = marketBinRow(good)}
        <g opacity="0.45" data-bin={good}>
            <GoodToken {good} size={26} x={row.x - 13} y={row.y - 13} />
        </g>
    {/each}
{/if}
{#each MarketSpaces as space (space.id)}
    {@const at = guildSlot(space.id)}
    {#if !printed}
        <rect
            x={at.x - MarketCell.tokenOffset}
            y={at.y - MarketCell.height / 2}
            width={MarketCell.width}
            height={MarketCell.height}
            rx="6"
            fill="var(--feudum-parchment-shade)"
            stroke="var(--feudum-ink)"
        ></rect>
        <text
            x={at.x + 44}
            y={at.y + 7}
            text-anchor="middle"
            font-size="20"
            font-weight="700"
            fill="var(--feudum-ink)"
            data-price={space.id}>{space.price}s</text
        >
    {/if}
    {#if state.guilds.merchant.market[space.id]}
        <BoardPiece {at} piece="good:{space.id}">
            <GoodToken
                good={space.good}
                size={GuildSizes.good}
                x={-GuildSizes.good / 2}
                y={-GuildSizes.good / 2}
            />
        </BoardPiece>
    {/if}
{/each}
