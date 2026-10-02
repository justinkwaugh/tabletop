<script lang="ts">
    import type { Snippet } from 'svelte'

    const CARD_MARGIN = 8

    let { children }: { children: Snippet } = $props()

    let slotWidth = $state(0)
    let contentWidth = $state(0)
    let contentHeight = $state(0)
</script>

<div class="slot" bind:clientWidth={slotWidth}>
    <div
        class="card"
        style:width={contentWidth > 0 ? `${contentWidth}px` : undefined}
        style:height={contentHeight > 0 ? `${contentHeight}px` : undefined}
    >
        <div
            class="content"
            style:max-width={slotWidth > 0 ? `${slotWidth - CARD_MARGIN * 2 - 2}px` : undefined}
            bind:offsetWidth={contentWidth}
            bind:offsetHeight={contentHeight}
        >
            {@render children()}
        </div>
    </div>
</div>

<style>
    .slot {
        display: flex;
        justify-content: center;
        padding: 8px 8px 0;
    }

    .card {
        box-sizing: content-box;
        display: flex;
        justify-content: center;
        overflow: hidden;
        border: 1px solid #e2d3b5;
        border-radius: 14px;
        background: #fbf7ee;
        box-shadow: 0 6px 16px rgba(74, 44, 18, 0.14);
    }

    .content {
        flex-shrink: 0;
        width: max-content;
        height: max-content;
        padding: 4px 12px 8px;
    }

    @media (prefers-reduced-motion: no-preference) {
        .card {
            transition:
                width 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
                height 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
    }
</style>
