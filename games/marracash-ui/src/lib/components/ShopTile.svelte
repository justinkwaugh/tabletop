<script lang="ts">
    import { getShop, type ShopState } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShopSign from '$lib/components/ShopSign.svelte'
    import RugStall from '$lib/components/RugStall.svelte'
    import TentStall from '$lib/components/TentStall.svelte'
    import { CandidateHaloFilterId, shopRect, ShopTileInset } from '$lib/utils/boardGeometry.js'
    import { stallKind, stallOutline } from '$lib/utils/stalls.js'

    let {
        shop,
        spotlit = false,
        layer = 'whole'
    }: {
        shop: ShopState
        spotlit?: boolean
        layer?: 'whole' | 'awning' | 'sign'
    } = $props()
    const gameSession = getGameSession()

    let rect = $derived(shopRect(shop.shopId, ShopTileInset))
    let shopColor = $derived(getShop(shop.shopId).color)
    let vertical = $derived(rect.height > rect.width)
    let clipId = $derived(`marracash-stall-${shop.shopId}-${layer}`)
    let centerX = $derived(rect.x + rect.width / 2)
    let centerY = $derived(rect.y + rect.height / 2)
    let customersHighlighted = $derived(
        gameSession.customerHighlight?.playerId === shop.ownerId &&
            gameSession.customerHighlight?.color === shopColor
    )
</script>

{#snippet awning()}
    <g transform="translate({rect.x} {rect.y})">
        {#if spotlit}
            <path
                d={stallOutline(shop.shopId, rect.width, rect.height)}
                fill="none"
                stroke="#ffffff"
                stroke-width="8"
                stroke-linejoin="round"
                filter="url(#{CandidateHaloFilterId})"
            ></path>
        {/if}
        {#if stallKind(shop.shopId) === 'rug'}
            <RugStall
                shopId={shop.shopId}
                width={rect.width}
                height={rect.height}
                color={shopColor}
                {clipId}
            />
        {:else}
            <TentStall width={rect.width} height={rect.height} color={shopColor} {clipId} />
        {/if}
    </g>
{/snippet}

{#snippet sign()}
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

{#snippet body()}
    {#if layer !== 'sign'}
        {@render awning()}
    {/if}
    {#if layer !== 'awning'}
        {@render sign()}
    {/if}
{/snippet}

{#if layer === 'sign'}
    <g class="pointer-events-none" aria-hidden="true">{@render sign()}</g>
{:else}
    <g>{@render body()}</g>
{/if}
