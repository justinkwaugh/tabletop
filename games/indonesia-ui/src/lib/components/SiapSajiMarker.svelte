<script lang="ts">
    import SiapSajiIcon from '$lib/images/SiapSajiIcon.svelte'
    import SiapSajiMaskIcon from '$lib/images/SiapSajiMaskIcon.svelte'

    const SIAP_SAJI_VIEWBOX_WIDTH = 373.38
    const SIAP_SAJI_VIEWBOX_HEIGHT = 209.94
    const SIAP_SAJI_ASPECT_RATIO = SIAP_SAJI_VIEWBOX_WIDTH / SIAP_SAJI_VIEWBOX_HEIGHT
    const SIAP_SAJI_HEIGHT_SCALE = 2 / 3

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

    const scaledHeight = $derived(height * SIAP_SAJI_HEIGHT_SCALE)
    const width = $derived(scaledHeight * SIAP_SAJI_ASPECT_RATIO)
    const iconX = $derived(x - width / 2)
    const iconY = $derived(y - scaledHeight / 2)
    const outlineWidth = $derived(width)
    const outlineHeight = $derived(scaledHeight)
    const outlineX = $derived(iconX + 1)
    const outlineY = $derived(iconY + 1)
</script>

<g class="pointer-events-none select-none" aria-hidden="true">
    {#if outline}
        <SiapSajiMaskIcon
            x={outlineX}
            y={outlineY}
            width={outlineWidth}
            height={outlineHeight}
            fill={outlineColor}
            opacity={0.75}
            aria-hidden="true"
        />
    {/if}
    <SiapSajiIcon x={iconX} y={iconY} {width} height={scaledHeight} />
    {#if mask}
        <SiapSajiMaskIcon
            x={iconX}
            y={iconY}
            {width}
            height={scaledHeight}
            fill={maskColor}
            opacity={maskOpacity}
            aria-hidden="true"
        />
    {/if}
</g>
