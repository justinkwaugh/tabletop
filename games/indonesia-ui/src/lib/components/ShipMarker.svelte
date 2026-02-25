<script lang="ts">
    import ShipAIcon from '$lib/images/ShipAIcon.svelte'
    import ShipAMaskIcon from '$lib/images/ShipAMaskIcon.svelte'
    import ShipBIcon from '$lib/images/ShipBIcon.svelte'
    import ShipBMaskIcon from '$lib/images/ShipBMaskIcon.svelte'

    const SHIP_A_VIEWBOX_WIDTH = 386.08
    const SHIP_A_VIEWBOX_HEIGHT = 297.68
    const SHIP_B_VIEWBOX_WIDTH = 297.35
    const SHIP_B_VIEWBOX_HEIGHT = 270.18

    let {
        x,
        y,
        style = 'a',
        height = 20,
        hullFillColor = '#7ea6ad',
        hullStrokeColor = 'none',
        hullStrokeWidth = 0,
        outline = true,
        outlineColor = '#333',
        mask = false,
        maskColor = '#000',
        maskOpacity = 0.35
    }: {
        x: number
        y: number
        style?: 'a' | 'b'
        height?: number
        hullFillColor?: string
        hullStrokeColor?: string
        hullStrokeWidth?: number
        outline?: boolean
        outlineColor?: string
        mask?: boolean
        maskColor?: string
        maskOpacity?: number
    } = $props()

    const aspectRatio = $derived(
        style === 'a'
            ? SHIP_A_VIEWBOX_WIDTH / SHIP_A_VIEWBOX_HEIGHT
            : SHIP_B_VIEWBOX_WIDTH / SHIP_B_VIEWBOX_HEIGHT
    )
    const width = $derived(height * aspectRatio)
    const iconX = $derived(x - width / 2)
    const iconY = $derived(y - height / 2)
    const outlineWidth = $derived(width)
    const outlineHeight = $derived(height)
    const outlineX = $derived(iconX + 1)
    const outlineY = $derived(iconY + 1)
</script>

<g class="pointer-events-none select-none" aria-hidden="true">
    {#if outline}
        {#if style === 'a'}
            <ShipAMaskIcon
                x={outlineX}
                y={outlineY}
                width={outlineWidth}
                height={outlineHeight}
                fill={outlineColor}
                opacity={0.75}
                aria-hidden="true"
            />
        {:else}
            <ShipBMaskIcon
                x={outlineX}
                y={outlineY}
                width={outlineWidth}
                height={outlineHeight}
                fill={outlineColor}
                opacity={0.75}
                aria-hidden="true"
            />
        {/if}
    {/if}

    {#if style === 'a'}
        <ShipAIcon
            x={iconX}
            y={iconY}
            {width}
            {height}
            hullFill={hullFillColor}
            hullStroke={hullStrokeColor}
            hullStrokeWidth={hullStrokeWidth}
        />
    {:else}
        <ShipBIcon
            x={iconX}
            y={iconY}
            {width}
            {height}
            hullFill={hullFillColor}
            hullStroke={hullStrokeColor}
            hullStrokeWidth={hullStrokeWidth}
        />
    {/if}

    {#if mask}
        {#if style === 'a'}
            <ShipAMaskIcon
                x={iconX}
                y={iconY}
                {width}
                {height}
                fill={maskColor}
                opacity={maskOpacity}
                aria-hidden="true"
            />
        {:else}
            <ShipBMaskIcon
                x={iconX}
                y={iconY}
                {width}
                {height}
                fill={maskColor}
                opacity={maskOpacity}
                aria-hidden="true"
            />
        {/if}
    {/if}
</g>
