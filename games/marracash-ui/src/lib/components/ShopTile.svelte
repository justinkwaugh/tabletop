<script lang="ts">
    import { getShop, type ShopState } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { shopRect } from '$lib/utils/boardGeometry.js'
    import { MarketPalettes } from '$lib/utils/marketColors.js'

    let { shop }: { shop: ShopState } = $props()
    const gameSession = getGameSession()

    let rect = $derived(shopRect(shop.shopId, 6))
    let palette = $derived(MarketPalettes[getShop(shop.shopId).color])
    let centerX = $derived(rect.x + rect.width / 2)
    let centerY = $derived(rect.y + rect.height / 2)
</script>

<g>
    <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx="10"
        fill={palette.tint}
        stroke={palette.stroke}
        stroke-width="3"
    />
    <rect
        x={rect.x + 6}
        y={rect.y + 6}
        width={rect.width - 12}
        height={rect.height - 12}
        rx="7"
        fill={palette.fill}
        opacity="0.55"
    />
    {#if shop.ownerId}
        <circle
            cx={centerX}
            cy={centerY}
            r="20"
            fill={gameSession.colors.getPlayerBgColorValue(shop.ownerId)}
            stroke="#1f1f1f"
            stroke-width="3"
        />
        <circle cx={centerX} cy={centerY} r="23" fill="none" stroke="#ffffff" stroke-width="2" />
        {#if shop.customers > 0}
            <text
                x={centerX}
                y={centerY + 6}
                text-anchor="middle"
                font-size="18"
                font-weight="700"
                fill={gameSession.colors.getPlayerTextColorValue(shop.ownerId)}
                >{shop.customers}</text
            >
        {/if}
    {/if}
</g>
