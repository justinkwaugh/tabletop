<script lang="ts">
    import type { Snippet } from 'svelte'

    let {
        children,
        paned,
        itemCount
    }: {
        children: Snippet
        paned: boolean
        itemCount: number
    } = $props()
    let columns = $derived(Math.max(1, itemCount))

    function observeCards(viewport: HTMLElement, wrap: boolean, count: number) {
        const element = viewport.firstElementChild
        if (!(element instanceof HTMLElement)) return
        const grid = element
        const cards = [...grid.children].filter(
            (child): child is HTMLElement => child instanceof HTMLElement
        )
        function measure() {
            columns = Math.max(1, count)
            if (!wrap || !cards.length || !viewport.clientHeight) return
            const style = getComputedStyle(grid)
            const gap = parseFloat(style.gap)
            const width =
                viewport.clientWidth -
                parseFloat(style.paddingLeft) -
                parseFloat(style.paddingRight)
            const height =
                viewport.clientHeight -
                parseFloat(style.paddingTop) -
                parseFloat(style.paddingBottom)
            const minimumColumns = Math.max(
                1,
                Math.floor((width + gap) / (cards[0].offsetWidth + gap))
            )
            for (let candidate = minimumColumns; candidate < count; candidate++) {
                let requiredHeight = 0
                for (let start = 0; start < count; start += candidate) {
                    requiredHeight += Math.max(
                        ...cards.slice(start, start + candidate).map((card) => card.offsetHeight)
                    )
                    if (start > 0) requiredHeight += gap
                }
                if (requiredHeight <= height) {
                    columns = candidate
                    break
                }
            }
        }
        const observer = new ResizeObserver(measure)
        observer.observe(viewport)
        for (const card of cards) observer.observe(card)
        measure()
        return () => observer.disconnect()
    }
</script>

<div class="company-card-viewport" {@attach (node) => observeCards(node, paned, itemCount)}>
    <div
        class="company-cards"
        aria-label="Started companies"
        style:grid-template-columns={`repeat(${columns}, max-content)`}
    >
        {@render children()}
    </div>
</div>

<style>
    .company-card-viewport {
        height: 100%;
        min-height: 0;
        overflow: auto;
    }
    .company-cards {
        display: grid;
        align-items: start;
        justify-content: start;
        gap: 10px;
        padding: 10px;
        width: max-content;
        min-width: 100%;
        box-sizing: border-box;
    }
</style>
