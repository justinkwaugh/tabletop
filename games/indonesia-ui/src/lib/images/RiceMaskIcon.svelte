<script lang="ts">
    import type { SVGAttributes } from 'svelte/elements'

    let {
        width = 23.31,
        height = 28.12,
        fill = '#e3d8c0',
        ...svgProps
    }: {
        width?: number
        height?: number
        fill?: string
    } & SVGAttributes<SVGElement> = $props()
</script>

<svg {width} {height} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 233.13 281.23" {...svgProps}>
    <path
        d="M222.82,222.04c-.68-.85-1.59-1.99-2.21-2.86,14.71-54.43,13.69-109.18-.97-159.5,14.47-15.92,20.25-35.01-.69-53.42-22.66-16.35-73.58,6.5-101.88,1.63-26.91.79-53.72-4.64-81.12-7.61C6.5-3.5-14.51,32.1,12.43,60.18c-14.33,50.3-15.55,109.17.66,159.32-21.75,22.45-14.89,59.26,19.46,61.72,27.3-2.21,51.65-9.33,79.43-9.17,32.75-3.34,60.79,8.82,93.17,7.56,29.16-4.15,36.35-39.5,17.67-57.58Z"
        {fill}
    ></path>
</svg>
