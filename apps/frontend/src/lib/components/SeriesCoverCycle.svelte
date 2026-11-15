<script lang="ts">
    import type { GameCatalogEntry } from '@tabletop/common'
    import { prefersReducedMotion } from 'svelte/motion'

    const coverIntervalMs = 2000

    let { titles, paused }: { titles: GameCatalogEntry[]; paused: boolean } = $props()

    let position = $state(0)
    let furthestShown = $state(0)
    let inView = $state(false)
    let visibilityState = $state<DocumentVisibilityState>('visible')
    const covers: HTMLImageElement[] = []

    const shown = $derived(position % titles.length)
    const running = $derived(
        !paused && inView && visibilityState === 'visible' && !prefersReducedMotion.current
    )
    const coverCount = $derived(Math.min(titles.length, furthestShown + (running ? 2 : 1)))

    function showNextCover() {
        const next = (shown + 1) % titles.length
        if (!covers[next].complete) return
        position = next
        furthestShown = Math.max(furthestShown, next)
    }

    $effect(() => {
        if (!running) return
        const timer = setInterval(showNextCover, coverIntervalMs)
        return () => clearInterval(timer)
    })

    function observeInView(element: HTMLElement) {
        const observer = new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting
        })
        observer.observe(element)
        return () => observer.disconnect()
    }
</script>

<svelte:document bind:visibilityState />

<div class="cover-cycle" {@attach observeInView}>
    {#each titles.slice(0, coverCount) as title, index (title.id)}
        <div class="cover" class:shown={index === shown}>
            <img src={title.thumbnailUrl} alt="" loading="lazy" bind:this={covers[index]} />
        </div>
    {/each}
</div>

<style>
    .cover-cycle {
        position: absolute;
        inset: 0;
        padding: inherit;
    }

    .cover {
        position: absolute;
        inset: 0;
        padding: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 450ms ease;
    }

    .cover.shown {
        opacity: 1;
    }

    @media (prefers-reduced-motion: reduce) {
        .cover {
            transition: none;
        }
    }
</style>
