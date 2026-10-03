<script lang="ts">
    import type { Snippet } from 'svelte'

    const CARD_MARGIN = 8

    let { children }: { children: Snippet } = $props()

    let slotWidth = $state(0)
    let contentHeight = $state(0)

    // Off phones the card spans the column and keeps the tallest height its content has needed,
    // so choosing a tool or opening a picker never shrinks it and the board below never
    // rescales. A new column width starts the reservation over.
    let reservedHeight = $state(0)

    function measureSlot(width: number) {
        if (width !== slotWidth) {
            reservedHeight = contentHeight
        }
        slotWidth = width
    }

    function measureHeight(height: number) {
        contentHeight = height
        reservedHeight = Math.max(reservedHeight, height)
    }
</script>

<div class="slot" bind:clientWidth={null, measureSlot}>
    <div class="card" style:--reserved-height={reservedHeight > 0 ? `${reservedHeight}px` : 'auto'}>
        <div
            class="content"
            style:--content-max-width={slotWidth > 0
                ? `${slotWidth - CARD_MARGIN * 2 - 2}px`
                : undefined}
            bind:offsetHeight={null, measureHeight}
        >
            {@render children()}
        </div>
    </div>
</div>

<style>
    .slot {
        padding: 8px 8px 0;
    }

    .card {
        box-sizing: content-box;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        height: var(--reserved-height);
        min-height: var(--action-card-floor);
        overflow: hidden;
        border: 1px solid #e2d3b5;
        border-radius: 14px;
        background: #fbf7ee;
        box-shadow: 0 6px 16px rgba(74, 44, 18, 0.14);
        /* Tall enough from the start for the resupply picker, the tallest common state. */
        --action-card-floor: 147px;
    }

    .content {
        flex-shrink: 0;
        width: max-content;
        max-width: var(--content-max-width, none);
        height: max-content;
        padding: 4px 12px 8px;
    }

    /* A phone's board is sized by the screen width, not the space left, so the card can follow
       its content there instead of holding a tall reservation. */
    @media (max-width: 639px) {
        .card {
            height: auto;
            --action-card-floor: 0px;
        }

        .content {
            width: var(--content-max-width, max-content);
        }
    }

    @media (prefers-reduced-motion: no-preference) {
        .card {
            transition: height 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
    }
</style>
