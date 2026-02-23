<script lang="ts">
    import type { SVGAttributes } from 'svelte/elements'

    let {
        width = 29.74,
        height = 29.74,
        fill = '#c1bdbb',
        ...svgProps
    }: {
        width?: number
        height?: number
        fill?: string
    } & SVGAttributes<SVGElement> = $props()
</script>

<svg {width} {height} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 297.36 297.36" {...svgProps}>
    <circle cx="148.68" cy="148.68" r="148.68" {fill}></circle>
</svg>
