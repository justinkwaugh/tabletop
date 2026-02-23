<script lang="ts">
    import SpiceCompanyIcon from '$lib/images/SpiceCompanyIcon.svelte'

    const SPICE_COMPANY_CARD_VIEWBOX_WIDTH = 832.24
    const SPICE_COMPANY_CARD_VIEWBOX_HEIGHT = 551.63
    const SPICE_COMPANY_CARD_VIEWBOX_RX = 67.48
    const SPICE_COMPANY_CARD_VIEWBOX_RY = 67.48
    const SPICE_COMPANY_CARD_ASPECT_RATIO =
        SPICE_COMPANY_CARD_VIEWBOX_WIDTH / SPICE_COMPANY_CARD_VIEWBOX_HEIGHT

    let {
        x,
        y,
        height = 58,
        outline = true,
        outlineColor = '#94a982',
        text = '',
        textColor = '#425735'
    }: {
        x: number
        y: number
        height?: number
        outline?: boolean
        outlineColor?: string
        text?: string
        textColor?: string
    } = $props()

    const width = $derived(height * SPICE_COMPANY_CARD_ASPECT_RATIO)
    const iconX = $derived(x - width / 2)
    const iconY = $derived(y - height / 2)
    const outlineX = $derived(iconX - 2)
    const outlineY = $derived(iconY - 2)
    const outlineRx = $derived(
        (width / SPICE_COMPANY_CARD_VIEWBOX_WIDTH) * SPICE_COMPANY_CARD_VIEWBOX_RX
    )
    const outlineRy = $derived(
        (height / SPICE_COMPANY_CARD_VIEWBOX_HEIGHT) * SPICE_COMPANY_CARD_VIEWBOX_RY
    )
    const textX = $derived(iconX + width * 0.45)
    const textY = $derived(iconY + height * 0.45)
    const textSize = $derived(height * 0.23)
    const textLines = $derived(text.split(/<br\s*\/?>|\r?\n/))
    const textLineHeight = $derived(textSize * 1.05)
    const textStartY = $derived(textY - ((textLines.length - 1) * textLineHeight) / 2)
</script>

<g class="pointer-events-none select-none" aria-hidden="true">
    {#if outline}
        <rect
            x={outlineX}
            y={outlineY}
            width={width + 4}
            height={height + 4}
            rx={outlineRx}
            ry={outlineRy}
            fill={outlineColor}
            opacity={1}
        ></rect>
    {/if}
    <SpiceCompanyIcon x={iconX} y={iconY} {width} {height} />
    {#if textLines.length > 0}
        <text
            x={textX}
            class="indonesia-font"
            fill={textColor}
            font-size={textSize}
            text-anchor="start"
            letter-spacing="0.2"
        >
            {#each textLines as line, lineIndex}
                <tspan x={textX} y={textStartY + lineIndex * textLineHeight}>
                    {line.length === 0 ? ' ' : line}
                </tspan>
            {/each}
        </text>
    {/if}
</g>
