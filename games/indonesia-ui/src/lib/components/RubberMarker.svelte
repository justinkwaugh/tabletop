<script lang="ts">
    import RubberIcon from '$lib/images/RubberIcon.svelte'
    import RubberMaskIcon from '$lib/images/RubberMaskIcon.svelte'

    const RUBBER_VIEWBOX_WIDTH = 297.36
    const RUBBER_VIEWBOX_HEIGHT = 297.36
    const RUBBER_ASPECT_RATIO = RUBBER_VIEWBOX_WIDTH / RUBBER_VIEWBOX_HEIGHT

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

    const width = $derived(height * RUBBER_ASPECT_RATIO)
    const iconX = $derived(x - width / 2)
    const iconY = $derived(y - height / 2)
    const outlineWidth = $derived(width + 2)
    const outlineHeight = $derived(height)
    const outlineX = $derived(iconX)
    const outlineY = $derived(iconY + 2)
</script>

<g class="pointer-events-none select-none" aria-hidden="true">
    {#if outline}
        <RubberMaskIcon
            x={outlineX}
            y={outlineY}
            width={outlineWidth}
            height={outlineHeight}
            fill={outlineColor}
            aria-hidden="true"
        />
    {/if}
    <RubberIcon x={iconX} y={iconY} {width} {height} />
    {#if mask}
        <RubberMaskIcon
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
