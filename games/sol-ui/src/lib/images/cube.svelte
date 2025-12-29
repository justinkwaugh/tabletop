<script lang="ts">
    import type { SVGAttributes } from 'svelte/elements'

    let {
        width = 50,
        height = 50,
        ...svgProps
    }: {
        width?: number
        height?: number
        x?: number
        y?: number
    } & SVGAttributes<SVGElement> = $props()
</script>

<svg {width} {height} {...svgProps} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <polygon
        fill="#000"
        points="38.998 133.054 51.47 118.989 256 24.585 460.53 118.989 473.002 133.054 473.002 391.407 265 487.415 247 487.415 38.998 391.407"
        transform="translate(256 256) scale(1.07) translate(-256 -256)"
    ></polygon>
    <path
        fill="#ee2a28"
        d="M256 24.585L51.47 118.989 256 213.394l204.53-94.405zM38.998 133.054v258.353L247 487.415V229.063zm434.004 0L265 229.062v258.353l208.002-96.008z"
    ></path>
</svg>
