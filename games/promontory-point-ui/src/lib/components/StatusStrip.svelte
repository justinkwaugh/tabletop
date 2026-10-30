<script lang="ts">
    import { statusStrip } from '$lib/model/statusStrip.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { railroadColour } from '$lib/utils/railroadPalette.js'

    const gameSession = getGameSession()

    const strip = $derived(statusStrip(gameSession.gameState))
</script>

<!-- O-4: on a phone the price track and the sea are a pan away, so one line tells them. -->
<div
    class="strip flex h-[30px] items-center gap-2 border-b border-pp-halo/40 px-2.5 text-pp-text sm:hidden"
    role="status"
    aria-label={strip.label}
    data-status-strip
>
    {#each strip.prices as price (price.railroadId)}
        <span class="price" data-strip-price={price.railroadId} aria-hidden="true">
            <span class="dot" style:background={railroadColour(price.railroadId)}></span>
            {price.text}
        </span>
    {/each}
    <span class="ml-auto text-xs text-pp-muted" aria-hidden="true" data-strip-bag
        >{strip.bag} · {strip.redTiles}</span
    >
</div>

<style>
    .strip {
        white-space: nowrap;
        overflow: hidden;
        background: var(--pp-panel);
    }

    .price {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-family: Oswald, sans-serif;
        font-size: 14px;
    }

    .dot {
        width: 11px;
        height: 11px;
        border-radius: 50%;
        border: 1px solid var(--pp-halo);
    }
</style>
