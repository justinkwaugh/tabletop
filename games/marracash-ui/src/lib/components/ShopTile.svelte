<script lang="ts">
    import { getShop, type ShopState } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ownerDiscOutline } from '$lib/utils/playerColors.js'
    import { ShopHaloFilterId, shopRect } from '$lib/utils/boardGeometry.js'
    import { MarketPalettes } from '$lib/utils/marketColors.js'
    import MarketMark from '$lib/components/MarketMark.svelte'

    let { shop, selectable }: { shop: ShopState; selectable: boolean } = $props()
    const gameSession = getGameSession()

    let rect = $derived(shopRect(shop.shopId, 6))
    let shopColor = $derived(getShop(shop.shopId).color)
    let palette = $derived(MarketPalettes[shopColor])
    let centerX = $derived(rect.x + rect.width / 2)
    let centerY = $derived(rect.y + rect.height / 2)

    let ownerDisc = $derived.by(() => {
        if (!shop.ownerId) return undefined
        const colors = gameSession.colors
        return {
            fill: colors.getPlayerBgColorValue(shop.ownerId),
            outline: ownerDiscOutline(colors.getPlayerColor(shop.ownerId)),
            text: colors.getPlayerTextColorValue(shop.ownerId),
            initial: gameSession.getPlayerName(shop.ownerId).charAt(0).toUpperCase()
        }
    })
</script>

{#snippet body()}
    {#if selectable}
        <rect
            x={rect.x - 4}
            y={rect.y - 4}
            width={rect.width + 8}
            height={rect.height + 8}
            rx="13"
            fill="none"
            stroke="#ffffff"
            stroke-width="4"
            filter="url(#{ShopHaloFilterId})"
        ></rect>
    {/if}
    <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx="10"
        fill={palette.tint}
        stroke={palette.stroke}
        stroke-width="3"
    ></rect>
    <rect
        x={rect.x + 6}
        y={rect.y + 6}
        width={rect.width - 12}
        height={rect.height - 12}
        rx="7"
        fill={palette.fill}
        opacity="0.55"
    ></rect>
    <MarketMark color={shopColor} x={rect.x + 20} y={rect.y + 20} size={20} />
    {#if ownerDisc}
        <circle
            cx={centerX}
            cy={centerY}
            r="20"
            fill={ownerDisc.fill}
            stroke={ownerDisc.outline}
            stroke-width="2"
        ></circle>
        <text x={centerX} y={centerY} class="owner-initial" fill={ownerDisc.text}
            >{ownerDisc.initial}</text
        >
        {#if shop.customers > 0}
            <circle
                cx={centerX + 18}
                cy={centerY + 15}
                r="10"
                fill="#ffffff"
                stroke="#1f1f1f"
                stroke-width="1.5"
            ></circle>
            <text x={centerX + 18} y={centerY + 15} class="customer-count" fill="#1f1f1f"
                >{shop.customers}</text
            >
        {/if}
    {/if}
{/snippet}

{#if selectable}
    <g
        role="button"
        tabindex="0"
        aria-label={`Auction shop ${shop.shopId}`}
        class="cursor-pointer"
        onclick={() => gameSession.startAuction(shop.shopId)}
        onkeydown={(event) => event.key === 'Enter' && gameSession.startAuction(shop.shopId)}
    >
        {@render body()}
    </g>
{:else}
    <g>{@render body()}</g>
{/if}

<style>
    .owner-initial {
        font-family: Merriweather, Georgia, 'Times New Roman', serif;
        font-size: 22px;
        font-weight: 700;
        text-anchor: middle;
        dominant-baseline: central;
    }

    .customer-count {
        font-size: 12px;
        font-weight: 700;
        text-anchor: middle;
        dominant-baseline: central;
    }
</style>
