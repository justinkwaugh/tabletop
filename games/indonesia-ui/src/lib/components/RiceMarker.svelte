<script lang="ts">
    import RiceIcon from '$lib/images/RiceIcon.svelte'
    import RiceMaskIcon from '$lib/images/RiceMaskIcon.svelte'

    const RICE_VIEWBOX_WIDTH = 233.13
    const RICE_VIEWBOX_HEIGHT = 281.23
    const RICE_ASPECT_RATIO = RICE_VIEWBOX_WIDTH / RICE_VIEWBOX_HEIGHT

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

    const width = $derived(height * RICE_ASPECT_RATIO)
    const iconX = $derived(x - width / 2)
    const iconY = $derived(y - height / 2)
    const outlineWidth = $derived(width + 2)
    const outlineHeight = $derived(height)
    const outlineX = $derived(iconX)
    const outlineY = $derived(iconY + 2)
</script>

<g class="pointer-events-none select-none" aria-hidden="true">
    {#if outline}
        <RiceMaskIcon
            x={outlineX}
            y={outlineY}
            width={outlineWidth}
            height={outlineHeight}
            fill={outlineColor}
            aria-hidden="true"
        />
    {/if}
    <RiceIcon x={iconX} y={iconY} {width} {height} />
    {#if mask}
        <RiceMaskIcon
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
