<script lang="ts">
    import type { SVGAttributes } from 'svelte/elements'

    let {
        width = 37.34,
        height = 20.99,
        fill = '#fdfaf8',
        ...svgProps
    }: {
        width?: number
        height?: number
        fill?: string
    } & SVGAttributes<SVGElement> = $props()
</script>

<svg {width} {height} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 373.38 209.94" {...svgProps}>
    <path
        d="M373.22,84.5c.65-20.54-10.54-36.62-27.9-41.88-9.79-16.84-16.62-39.53-49.43-41.62C232.01-.21,168.5,1.48,104.71.12,63.32-.75,46.78,2.33,28.63,42.71,9.17,47.18-.81,67.81.25,87.62c-1.64,14.11,4.89,31.02,19.92,39.79,4.82,16.03,10.71,32.51,14.52,48.5,12.64,48.83,86.11,29.53,124.37,33.39,44.23,0,87.64-.28,131.39-.46,43.25,2.39,51.71-49.39,61.88-81.01,14.82-7.42,22.24-27.58,20.89-43.34Z"
        {fill}
    ></path>
</svg>
