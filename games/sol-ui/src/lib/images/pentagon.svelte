<script lang="ts">
    import type { SVGAttributes } from 'svelte/elements'

    let {
        width = 50,
        height = 50,
        ...svgProps
    }: {
        width?: number
        height?: number
    } & SVGAttributes<SVGElement> = $props()
</script>

<svg {width} {height} {...svgProps} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <polygon
        fill="#333"
        points="256 26 474.7 184.9 391.2 442.1 120.8 442.1 37.3 184.9"
    />
    <text
        x="256"
        y="270"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="metropolis, sans-serif"
        font-size="200"
        font-weight="700"
        fill="#fff"
    >
        +1
    </text>
</svg>
