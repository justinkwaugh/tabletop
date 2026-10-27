<script lang="ts">
    import { RESOURCES, Resource, plantResources, powerPlant } from '@tabletop/power-grid'
    import { RESOURCE_NAMES } from '$lib/utils/resourceNames.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ResourceToken from '../ResourceToken.svelte'
    import Elektro from './Elektro.svelte'

    const session = getGameSession()

    const usable = $derived(
        RESOURCES.filter((resource) =>
            (session.myPlayerState?.plants ?? []).some((plant) =>
                plantResources(powerPlant(plant).kind).includes(resource)
            )
        )
    )
</script>

<div class="column">
    <p class="prompt">
        {#if usable.length > 0}
            Buy resources for your plants. Click a row of the resource market or use the buttons;
            the cheapest tokens are taken first.
        {:else}
            Your plants burn no fuel.
        {/if}
    </p>
    <div class="controls">
        {#each usable as resource (resource)}
            <div class="cart-item">
                <svg class="chip" width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true">
                    <ResourceToken {resource} size={16} />
                </svg>
                <span class="name">{RESOURCE_NAMES[resource]}</span>
                <button
                    type="button"
                    class="mini"
                    disabled={session.basket[resource] === 0}
                    onclick={() => session.removeFromCart(resource)}
                    aria-label="One less {RESOURCE_NAMES[resource]}">−</button
                >
                <span class="count">{session.basket[resource]}</span>
                <button
                    type="button"
                    class="mini"
                    disabled={!session.canAddToCart(resource)}
                    onclick={() => session.addToCart(resource)}
                    aria-label="One more {RESOURCE_NAMES[resource]}">+</button
                >
            </div>
        {/each}
        <button type="button" class="btn primary" onclick={() => session.buyResources()}>
            {#if session.cart.length > 0}
                Buy for <Elektro amount={session.basketCost} />
            {:else}
                Buy nothing
            {/if}
        </button>
    </div>
</div>

<style>
    .cart-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #1b201b;
        border: 2px solid #3b4529;
        border-radius: 6px;
        padding: 2px 6px;
    }
    .chip {
        background: #cbc4ab;
        border-radius: 4px;
    }
    .name {
        font-weight: 600;
    }
    .count {
        min-width: 18px;
        text-align: center;
        font-weight: 700;
        color: #f3c534;
        font-size: 18px;
    }
    .mini {
        width: 26px;
        height: 26px;
        border-radius: 4px;
        background: #3b4529;
        color: #ecebe1;
        font-size: 18px;
        line-height: 1;
    }
    .mini:disabled {
        color: #6d7562;
        background: #2b3222;
    }
</style>
