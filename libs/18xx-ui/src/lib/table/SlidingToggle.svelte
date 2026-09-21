<script lang="ts">
    import type { Snippet } from 'svelte'
    import { fade } from 'svelte/transition'
    import { prefersReducedMotion } from 'svelte/motion'

    let { count, selectedIndex, children }: {
        count: number
        selectedIndex: number
        children: Snippet
    } = $props()
</script>

<div class="sliding-toggle" style:--segments={count} style:--selected={selectedIndex}>
    {#if selectedIndex >= 0}<span class="thumb" aria-hidden="true" transition:fade={{ duration: prefersReducedMotion.current ? 0 : 150 }}></span>{/if}
    {@render children()}
</div>

<style>
    .sliding-toggle { position: relative; display: grid; grid-template-columns: repeat(var(--segments), minmax(max-content, 1fr)); width: max-content; padding: 2px; border-radius: 999px; background: var(--rail-surface, #222c37); }
    .thumb { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / var(--segments)); border-radius: 999px; background: var(--rail-solid, #40576b); transform: translateX(calc(var(--selected) * 100%)); transition: transform 180ms ease; pointer-events: none; }
    @media (prefers-reduced-motion: reduce) {
        .thumb { transition: none; }
    }
</style>
