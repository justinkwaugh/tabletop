<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    /** `size`: the medallion's width on screen, in px. */
    let { size }: { size: number } = $props()

    const gameSession = getGameSession()

    // The medallion in its own units: a disc of radius 36 and the room its edge takes.
    const MEDALLION_RADIUS = 36
    const VIEW = MEDALLION_RADIUS + 4

    const claim = $derived(gameSession.gameState.transcontinental)
</script>

<!-- R-4.3.3: the claim's gold medallion with its amount, or a dashed gold ring while
     the line is unclaimed. The chip that holds it names it. -->
<svg
    class="block shrink-0"
    width={size}
    height={size}
    viewBox="{-VIEW} {-VIEW} {VIEW * 2} {VIEW * 2}"
    aria-hidden="true"
>
    {#if claim}
        <circle
            r={MEDALLION_RADIUS}
            fill="var(--rtr-gold)"
            stroke="var(--rtr-halo)"
            stroke-width="3"
        ></circle>
        <circle
            r={MEDALLION_RADIUS - 7}
            fill="none"
            stroke="var(--rtr-ink-light)"
            stroke-opacity="0.55"
            stroke-width="2"
        ></circle>
        <text y="11" text-anchor="middle" class="rtr-display amount" fill="var(--rtr-ink-light)"
            >${claim.amount}</text
        >
    {:else}
        <circle
            r={MEDALLION_RADIUS}
            fill="none"
            stroke="var(--rtr-gold)"
            stroke-width="3"
            stroke-dasharray="7 5"
        ></circle>
    {/if}
</svg>

<style>
    .amount {
        font-size: 32px;
    }
</style>
