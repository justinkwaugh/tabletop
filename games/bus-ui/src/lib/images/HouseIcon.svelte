<script lang="ts">
    import type { SVGAttributes } from 'svelte/elements'

    let {
        width = 40.81,
        height = 40.57,
        ...svgProps
    }: { width?: number; height?: number } & SVGAttributes<SVGElement> = $props()
</script>

<svg {width} {height} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40.81 40.57" {...svgProps}>
    <ellipse cx="20.4" cy="20.28" rx="20.4" ry="20.28" fill="#a5a5a5"></ellipse>
    <path
        fill="#fefefe"
        d="M25.55,22l-4.56-.03-.08,8.1h-9.87s0-8.62,0-8.62l8.87-8.82,8.87,8.82v8.61c-1.14,0-2.14.08-3.23-.06v-8Z"
    ></path>
    <path
        fill="#fefefe"
        d="M9.74,21.46c-.55.54-1.32.13-1.69-.21-.34-.32-.86-1.17-.36-1.67l4.39-4.36.08-3.15c.02-.8.81-.95,1.42-.84.67.13.7.88.77,1.66l5.58-5.39,12.07,12c.54.54.34,1.29-.02,1.7-.49.55-1.31.73-1.88.17l-10.12-10.04-10.23,10.13Z"
    ></path>
    <rect x="14.16" y="21.96" width="4.5" height="3.87" fill="#a5a5a5"></rect>
</svg>
