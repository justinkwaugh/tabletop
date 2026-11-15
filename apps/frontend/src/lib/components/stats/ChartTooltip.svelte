<script lang="ts">
    import type { Snippet } from 'svelte'

    let {
        x,
        y,
        trailing,
        children
    }: { x: number; y: number; trailing: boolean; children: Snippet } = $props()
</script>

<div class="tooltip" class:trailing style:left={`${x}px`} style:top={`${y - 6}px`}>
    {@render children()}
</div>

<style>
    .tooltip {
        position: absolute;
        z-index: 1;
        pointer-events: none;
        transform: translate(-12px, -100%);
        background: var(--color-gray-100);
        color: var(--color-gray-900);
        border-radius: 6px;
        padding: 6px 9px;
        font-size: 12px;
        white-space: nowrap;
    }
    .tooltip.trailing {
        transform: translate(calc(-100% + 12px), -100%);
    }
</style>
