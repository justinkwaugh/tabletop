<script lang="ts">
    import marketTileImg from '$lib/images/tile-market.png'
    import { fadeScale } from '@tabletop/frontend-components'

    let { size = 100, animate = true }: { size?: number; animate?: boolean } = $props()
    let sizePx = $derived(`${size}px`)
    function maybeAnimate(node: Element, options: any) {
        if (animate) {
            return options.fn(node, options)
        }
    }
</script>

<div
    transition:maybeAnimate={{ fn: fadeScale, baseScale: 0.1, duration: 100 }}
    class="flex justify-center align-center bg-contain bg-origin-border"
    style="min-width:{sizePx};width:{sizePx};min-height:{sizePx};height:{sizePx};"
>
    <img src={marketTileImg} alt="market" />
</div>
