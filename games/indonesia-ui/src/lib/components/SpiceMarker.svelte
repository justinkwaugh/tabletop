<script lang="ts">
    import SpiceIcon from '$lib/images/SpiceIcon.svelte'
    import SpiceMaskIcon from '$lib/images/SpiceMaskIcon.svelte'

    const SPICE_VIEWBOX_WIDTH = 317.7
    const SPICE_VIEWBOX_HEIGHT = 293.89
    const SPICE_ASPECT_RATIO = SPICE_VIEWBOX_WIDTH / SPICE_VIEWBOX_HEIGHT
    const OUTLINE_SCALE = 1.03
    const OUTLINE_OFFSET_X = 0.8
    const OUTLINE_OFFSET_Y = 0.8

    let {
        x,
        y,
        height = 20,
        outline = true,
        outlineColor = '#333',
        mask = false,
        maskColor = '#000',
        maskOpacity = 0.35
    }: {
        x: number
        y: number
        height?: number
        outline?: boolean
        outlineColor?: string
        mask?: boolean
        maskColor?: string
        maskOpacity?: number
    } = $props()

    const width = $derived(height * SPICE_ASPECT_RATIO)
    const iconX = $derived(x - width / 2)
    const iconY = $derived(y - height / 2)
    const outlineWidth = $derived(width + 2)
    const outlineHeight = $derived(height)
    const outlineX = $derived(iconX)
    const outlineY = $derived(iconY + 2)
</script>

<g class="pointer-events-none select-none" aria-hidden="true">
    {#if outline}
        <SpiceMaskIcon
            x={outlineX}
            y={outlineY}
            width={outlineWidth}
            height={outlineHeight}
            fill={outlineColor}
            aria-hidden="true"
        />
    {/if}
    <SpiceIcon x={iconX} y={iconY} {width} {height} />
    {#if mask}
        <SpiceMaskIcon
            x={iconX}
            y={iconY}
            {width}
            {height}
            fill={maskColor}
            opacity={maskOpacity}
            aria-hidden="true"
        />
    {/if}
</g>
