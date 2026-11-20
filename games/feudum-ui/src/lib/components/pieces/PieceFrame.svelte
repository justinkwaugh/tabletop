<script lang="ts">
    import type { BoundingBox } from '@tabletop/common'
    import type { Snippet } from 'svelte'

    let {
        label,
        url,
        width,
        height,
        viewBox,
        x,
        y,
        artBox,
        opacity,
        children,
        over
    }: {
        label: string
        url?: string
        width: number | string
        height: number | string
        viewBox: string
        x?: number
        y?: number
        artBox?: BoundingBox
        opacity?: number
        children: Snippet
        over?: Snippet
    } = $props()

    let box = $derived.by(() => {
        if (artBox) {
            return artBox
        }
        const [left, top, boxWidth, boxHeight] = viewBox.split(' ').map(Number)
        return { x: left, y: top, width: boxWidth, height: boxHeight }
    })
</script>

<svg {x} {y} {width} {height} {viewBox} {opacity} role="img" aria-label={label}>
    <title>{label}</title>
    {#if url}
        <image
            href={url}
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            preserveAspectRatio="xMidYMid meet"
        ></image>
    {:else}
        {@render children()}
    {/if}
    {@render over?.()}
</svg>
