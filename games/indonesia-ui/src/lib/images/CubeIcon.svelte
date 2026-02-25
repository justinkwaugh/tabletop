<script lang="ts">
    import { shadeHexColor } from '$lib/utils/color.js'
    import type { SVGAttributes } from 'svelte/elements'

    let {
        width = 16,
        height = 16,
        fill = '#6b7280',
        ...svgProps
    }: {
        width?: number
        height?: number
        fill?: string
    } & SVGAttributes<SVGElement> = $props()

    const borderColor = $derived(shadeHexColor(fill, 0.26))
    const topLeftEdgeColor = $derived(shadeHexColor(fill, -0.2))
    const bottomRightEdgeColor = $derived(shadeHexColor(fill, 0.34))
</script>

<svg
    {width}
    {height}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    overflow="visible"
    {...svgProps}
>
    <rect x="1.2" y="1.2" width="13.6" height="13.6" rx="1.8" fill={fill} stroke={borderColor} />
    <line
        x1="2.1"
        y1="2.1"
        x2="13.1"
        y2="2.1"
        stroke={topLeftEdgeColor}
        stroke-width="1.3"
        stroke-linecap="round"
    />
    <line
        x1="2.1"
        y1="2.1"
        x2="2.1"
        y2="13.1"
        stroke={topLeftEdgeColor}
        stroke-width="1.3"
        stroke-linecap="round"
    />
    <line
        x1="2.8"
        y1="13.9"
        x2="13.9"
        y2="13.9"
        stroke={bottomRightEdgeColor}
        stroke-width="1.3"
        stroke-linecap="round"
    />
    <line
        x1="13.9"
        y1="2.8"
        x2="13.9"
        y2="13.9"
        stroke={bottomRightEdgeColor}
        stroke-width="1.3"
        stroke-linecap="round"
    />
</svg>
