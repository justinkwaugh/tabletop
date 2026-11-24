<script lang="ts">
    import type { Point } from '@tabletop/common'
    import type { SVGAttributes } from 'svelte/elements'
    import Level from './Level.svelte'

    let {
        x,
        y,
        text,
        size = 20,
        ...rest
    }: Point & {
        text: string
        size?: number
    } & SVGAttributes<SVGTextElement> = $props()

    let width = $derived(text.length * size * 0.56 + 14)
</script>

<Level at={{ x, y: y - size * 0.25 }}>
    <rect
        x={x - width / 2}
        y={y - size * 0.8}
        {width}
        height={size * 1.1}
        rx={size * 0.5}
        fill="var(--feudum-parchment)"
        fill-opacity="0.92"
        stroke="var(--feudum-ink)"
        stroke-width="1"
    ></rect>
    <text
        {x}
        {y}
        text-anchor="middle"
        font-size={size}
        font-weight="700"
        fill="var(--feudum-ink)"
        {...rest}>{text}</text
    >
</Level>
