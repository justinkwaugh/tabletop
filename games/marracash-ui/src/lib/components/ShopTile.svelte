<script lang="ts">
    import { getShop, type ShopState } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ownerDiscOutline } from '$lib/utils/playerColors.js'
    import { CandidateHaloFilterId, shopRect } from '$lib/utils/boardGeometry.js'
    import {
        AwningClothFilterId,
        AwningCreaseBlurId,
        AwningShadeOffset,
        awningCreases,
        awningGradientId,
        awningOutline,
        awningStripesId
    } from '$lib/utils/awning.js'

    let { shop, selectable }: { shop: ShopState; selectable: boolean } = $props()
    const gameSession = getGameSession()

    let rect = $derived(shopRect(shop.shopId, 6))
    let shopColor = $derived(getShop(shop.shopId).color)
    let palette = $derived(gameSession.marketPalettes[shopColor])
    let vertical = $derived(rect.height > rect.width)
    let outline = $derived(awningOutline(rect.width, rect.height))
    let creases = $derived(awningCreases(rect.width, rect.height))
    let poles = $derived([
        { x: 0, y: 0 },
        { x: rect.width, y: 0 },
        { x: rect.width, y: rect.height },
        { x: 0, y: rect.height }
    ])
    let clipId = $derived(`marracash-awning-${shop.shopId}`)
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
    <g transform="translate({rect.x} {rect.y})">
        {#if selectable}
            <path
                d={outline}
                fill="none"
                stroke="#ffffff"
                stroke-width="8"
                stroke-linejoin="round"
                filter="url(#{CandidateHaloFilterId})"
            ></path>
        {/if}
        <clipPath id={clipId}>
            <path d={outline}></path>
        </clipPath>
        <path
            d={outline}
            fill="url(#{awningStripesId(shopColor, vertical)})"
            stroke={palette.awning.outline}
            stroke-width="1.8"
            stroke-linejoin="round"
            filter="url(#{AwningClothFilterId})"
        ></path>
        <path d={outline} fill="url(#{awningGradientId(shopColor)})" opacity="0.3"></path>
        <g clip-path="url(#{clipId})" filter="url(#{AwningCreaseBlurId})" fill="none">
            <g transform="translate({AwningShadeOffset} {AwningShadeOffset})">
                {#each creases as crease, index (index)}
                    <path
                        d={crease.path}
                        stroke={palette.awning.outline}
                        stroke-opacity={0.35 * crease.strength}
                        stroke-width={crease.width}
                        stroke-linecap="round"
                    ></path>
                {/each}
            </g>
            {#each creases as crease, index (index)}
                <path
                    d={crease.path}
                    stroke="#ffffff"
                    stroke-opacity={0.55 * crease.strength}
                    stroke-width={crease.width}
                    stroke-linecap="round"
                ></path>
            {/each}
        </g>
        {#each poles as pole, index (index)}
            <circle cx={pole.x} cy={pole.y} r="3.2" fill="#7a4f2a" stroke="#4a2f17" stroke-width="1"
            ></circle>
        {/each}
    </g>
    {#if ownerDisc}
        <circle
            cx={centerX}
            cy={centerY}
            r="20"
            fill={ownerDisc.fill}
            stroke={ownerDisc.outline}
            stroke-width="2"
        ></circle>
        <text x={centerX} y={centerY} class="owner-initial marracash-initial" fill={ownerDisc.text}
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
        font-size: 22px;
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
