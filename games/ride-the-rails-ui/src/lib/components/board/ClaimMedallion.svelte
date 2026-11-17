<script lang="ts">
    /**
     * `size`: the medallion's width on screen, in px. `amount`: what the claim paid, once claimed.
     */
    let { size, amount }: { size: number; amount: number | undefined } = $props()

    // The medallion in its own units: a disc of radius 36 and the room its edge takes.
    const MEDALLION_RADIUS = 36
    const VIEW = MEDALLION_RADIUS + 4
</script>

<!-- R-4.3.3, R-8: a once-only bonus's claim, the gold medallion with its amount, or a dashed gold
     ring while it is open. The chip that holds it names it. -->
<svg
    class="block shrink-0"
    width={size}
    height={size}
    viewBox="{-VIEW} {-VIEW} {VIEW * 2} {VIEW * 2}"
    aria-hidden="true"
>
    {#if amount !== undefined}
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
            >${amount}</text
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
