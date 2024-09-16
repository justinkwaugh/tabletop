<script lang="ts">
    import marketTileImg from '$lib/images/tile-market.png'
    import { fadeScale } from '@tabletop/frontend-components'

    let { animate = true }: { animate?: boolean } = $props()
    function maybeAnimate(node: Element, options: any) {
        if (animate) {
            return options.fn(node, options)
        }
    }
</script>

<div
    transition:maybeAnimate={{ fn: fadeScale, baseScale: 0.1, duration: 100 }}
    class="w-[100px] h-[100px] min-w-[100px] min-h-[100px] flex justify-center align-center bg-contain bg-origin-border"
>
    <img src={marketTileImg} alt="stall" />
</div>
