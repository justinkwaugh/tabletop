<script lang="ts">
    import type { Snippet } from 'svelte'
    import { fade } from 'svelte/transition'
    import { prefersReducedMotion } from 'svelte/motion'

    let {
        count,
        selectedIndex,
        children
    }: {
        count: number
        selectedIndex: number
        children: Snippet
    } = $props()
    let thumb = $state({ left: 0, width: 0 })
    function trackSelected(node: HTMLElement) {
        const measure = () => {
            const segments = [...node.querySelectorAll<HTMLElement>(':scope > button')]
            const selected = segments[selectedIndex]
            if (!selected) return
            thumb = { left: selected.offsetLeft, width: selected.offsetWidth }
        }
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        for (const segment of node.querySelectorAll(':scope > button')) observer.observe(segment)
        measure()
        return () => observer.disconnect()
    }
</script>

<div
    class="sliding-toggle"
    style:--segments={count}
    style:--thumb-left={`${thumb.left}px`}
    style:--thumb-width={`${thumb.width}px`}
    {@attach (node) => {
        selectedIndex
        count
        return trackSelected(node)
    }}
>
    {#if selectedIndex >= 0 && thumb.width > 0}<span
            class="thumb"
            aria-hidden="true"
            transition:fade={{ duration: prefersReducedMotion.current ? 0 : 150 }}
        ></span>{/if}
    {@render children()}
</div>

<style>
    .sliding-toggle {
        position: relative;
        display: grid;
        grid-template-columns: repeat(var(--segments), max-content);
        width: max-content;
        padding: 2px;
        border-radius: 999px;
        background: var(--rail-surface, #222c37);
    }
    .thumb {
        position: absolute;
        top: 2px;
        bottom: 2px;
        left: var(--thumb-left);
        width: var(--thumb-width);
        border-radius: 999px;
        background: var(--rail-solid, #40576b);
        transition:
            left 180ms ease,
            width 180ms ease;
        pointer-events: none;
    }
    @media (prefers-reduced-motion: reduce) {
        .thumb {
            transition: none;
        }
    }
</style>
