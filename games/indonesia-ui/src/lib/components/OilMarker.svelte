<script lang="ts">
    import OilIcon from '$lib/images/OilIcon.svelte'
    import OilMaskIcon from '$lib/images/OilMaskIcon.svelte'

    const OIL_VIEWBOX_WIDTH = 237.36
    const OIL_VIEWBOX_HEIGHT = 283.53
    const OIL_ASPECT_RATIO = OIL_VIEWBOX_WIDTH / OIL_VIEWBOX_HEIGHT

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

    const width = $derived(height * OIL_ASPECT_RATIO)
    const iconX = $derived(x - width / 2)
    const iconY = $derived(y - height / 2)
    const outlineWidth = $derived(width + 2)
    const outlineHeight = $derived(height)
    const outlineX = $derived(iconX)
    const outlineY = $derived(iconY + 2)
</script>

<g class="pointer-events-none select-none" aria-hidden="true">
    {#if outline}
        <OilMaskIcon
            x={outlineX}
            y={outlineY}
            width={outlineWidth}
            height={outlineHeight}
            fill={outlineColor}
            aria-hidden="true"
        />
    {/if}
    <OilIcon x={iconX} y={iconY} {width} {height} />
    {#if mask}
        <OilMaskIcon
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
