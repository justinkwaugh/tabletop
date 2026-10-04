<script lang="ts">
    import { getShop, type ShopState } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShopSign from '$lib/components/ShopSign.svelte'
    import { CandidateHaloFilterId, shopRect, ShopTileInset } from '$lib/utils/boardGeometry.js'
    import {
        AwningClothFilterId,
        AwningCreaseBlurId,
        AwningShadeOffset,
        awningCreases,
        awningGradientId,
        awningOutline,
        awningStripesId
    } from '$lib/utils/awning.js'

    let {
        shop,
        selectable,
        spotlit = false
    }: { shop: ShopState; selectable: boolean; spotlit?: boolean } = $props()
    const gameSession = getGameSession()

    let rect = $derived(shopRect(shop.shopId, ShopTileInset))
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
    let customersHighlighted = $derived(
        gameSession.customerHighlight?.playerId === shop.ownerId &&
            gameSession.customerHighlight?.color === shopColor
    )
</script>

{#snippet body()}
    <g transform="translate({rect.x} {rect.y})">
        {#if selectable || spotlit}
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
    {#if shop.ownerId}
        <ShopSign
            ownerId={shop.ownerId}
            center={{ x: centerX, y: centerY }}
            {vertical}
            customers={shop.customers}
            marketColor={shopColor}
            highlighted={customersHighlighted}
        />
    {/if}
{/snippet}

{#if selectable}
    <g
        role="button"
        tabindex="0"
        aria-label={`Auction shop ${shop.shopId}`}
        class="cursor-pointer"
        onclick={() => gameSession.chooseShopToAuction(shop.shopId)}
        onkeydown={(event) => event.key === 'Enter' && gameSession.chooseShopToAuction(shop.shopId)}
    >
        {@render body()}
    </g>
{:else}
    <g>{@render body()}</g>
{/if}
