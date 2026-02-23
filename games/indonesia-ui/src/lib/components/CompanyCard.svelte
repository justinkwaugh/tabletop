<script lang="ts">
    import OilCompanyIcon from '$lib/images/OilCompanyIcon.svelte'
    import RiceCompanyIcon from '$lib/images/RiceCompanyIcon.svelte'
    import RubberCompanyIcon from '$lib/images/RubberCompanyIcon.svelte'
    import ShipCompanyIcon from '$lib/images/ShipCompanyIcon.svelte'
    import SpiceCompanyIcon from '$lib/images/SpiceCompanyIcon.svelte'

    type CompanyCardType = 'rice' | 'spice' | 'rubber' | 'oil' | 'ship'
    type ShippingSizeEntry = {
        era: 'A' | 'B' | 'C'
        size: number
    }

    const COMPANY_CARD_VIEWBOX_WIDTH = 832.24
    const COMPANY_CARD_VIEWBOX_HEIGHT = 551.63
    const COMPANY_CARD_VIEWBOX_RX = 67.48
    const COMPANY_CARD_VIEWBOX_RY = 67.48
    const COMPANY_CARD_ASPECT_RATIO = COMPANY_CARD_VIEWBOX_WIDTH / COMPANY_CARD_VIEWBOX_HEIGHT

    const COMPANY_CARD_VISUALS = {
        rice: {
            icon: RiceCompanyIcon,
            outlineColor: '#b2a38c',
            textColor: '#6c5a46',
            textXRatio: 0.45,
            textYRatio: 0.4
        },
        spice: {
            icon: SpiceCompanyIcon,
            outlineColor: '#94a982',
            textColor: '#425735',
            textXRatio: 0.45,
            textYRatio: 0.45
        },
        rubber: {
            icon: RubberCompanyIcon,
            outlineColor: '#9c9c9c',
            textColor: '#131113',
            textXRatio: 0.45,
            textYRatio: 0.45
        },
        oil: {
            icon: OilCompanyIcon,
            outlineColor: '#8a7f9b',
            textColor: '#23344f',
            textXRatio: 0.61,
            textYRatio: 0.33
        },
        ship: {
            icon: ShipCompanyIcon,
            outlineColor: '#7ea6ad',
            textColor: '#396c78',
            textXRatio: 0.45,
            textYRatio: 0.45
        }
    } as const

    let {
        type,
        x,
        y,
        height = 58,
        outline = true,
        outlineColor,
        text = '',
        textColor,
        shippingSizes = null
    }: {
        type: CompanyCardType
        x: number
        y: number
        height?: number
        outline?: boolean
        outlineColor?: string
        text?: string
        textColor?: string
        shippingSizes?: readonly ShippingSizeEntry[] | null
    } = $props()

    const cardVisual = $derived(COMPANY_CARD_VISUALS[type])
    const width = $derived(height * COMPANY_CARD_ASPECT_RATIO)
    const iconXLocal = $derived(-width / 2)
    const iconYLocal = $derived(-height / 2)
    const outlineXLocal = $derived(iconXLocal - 2)
    const outlineYLocal = $derived(iconYLocal - 2)
    const outlineRx = $derived((width / COMPANY_CARD_VIEWBOX_WIDTH) * COMPANY_CARD_VIEWBOX_RX)
    const outlineRy = $derived((height / COMPANY_CARD_VIEWBOX_HEIGHT) * COMPANY_CARD_VIEWBOX_RY)
    const resolvedOutlineColor = $derived(outlineColor ?? cardVisual.outlineColor)
    const resolvedTextColor = $derived(textColor ?? cardVisual.textColor)
    const textXLocal = $derived(iconXLocal + width * cardVisual.textXRatio)
    const textYLocal = $derived(iconYLocal + height * cardVisual.textYRatio)
    const textSize = $derived(height * 0.23)
    const textLines = $derived.by(() => {
        const trimmed = text.trim()
        if (trimmed.length === 0) {
            return [] as string[]
        }
        return trimmed.split(/\s+/)
    })
    const textLineHeight = $derived(textSize * 1.05)
    const textStartYLocal = $derived(textYLocal - ((textLines.length - 1) * textLineHeight) / 2)
    const shippingSizeRow = $derived.by(() => shippingSizes ?? [])
    const shippingSizePairGap = $derived(width * 0.34)
    const shippingSizeStartXLocal = $derived(
        -((shippingSizeRow.length - 1) * shippingSizePairGap) / 2
    )
    const shippingSizeYLocal = $derived(iconYLocal + height * 0.88 + 5)
    const shippingSizeFont = $derived(height * 0.21)
    const shippingEraOpacity = 0.62
    const shippingNumberOpacity = 1
    const shippingPairSpacing = $derived(height * 0.025)
</script>

<g class="pointer-events-none select-none" aria-hidden="true" transform={`translate(${x} ${y})`}>
    {#if outline}
        <rect
            x={outlineXLocal}
            y={outlineYLocal}
            width={width + 4}
            height={height + 4}
            rx={outlineRx}
            ry={outlineRy}
            fill={resolvedOutlineColor}
            opacity={1}
        ></rect>
    {/if}
    <svelte:component this={cardVisual.icon} x={iconXLocal} y={iconYLocal} {width} {height} />
    {#if textLines.length > 0}
        <text
            x={textXLocal}
            class="indonesia-font"
            fill={resolvedTextColor}
            font-size={textSize}
            text-anchor="start"
            letter-spacing="0.2"
        >
            {#each textLines as line, lineIndex}
                <tspan x={textXLocal} y={textStartYLocal + lineIndex * textLineHeight}>
                    {line.length === 0 ? ' ' : line}
                </tspan>
            {/each}
        </text>
    {/if}
    {#if shippingSizeRow.length > 0}
        <g>
            {#each shippingSizeRow as sizeEntry, index (`${sizeEntry.era}-${sizeEntry.size}-${index}`)}
                <text
                    x={shippingSizeStartXLocal + index * shippingSizePairGap}
                    y={shippingSizeYLocal}
                    fill={resolvedTextColor}
                    font-size={shippingSizeFont}
                    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
                    text-anchor="middle"
                    letter-spacing="0.1"
                >
                    <tspan fill-opacity={shippingEraOpacity} font-weight="500">{sizeEntry.era}</tspan>
                    <tspan dx={shippingPairSpacing}></tspan>
                    <tspan fill-opacity={shippingNumberOpacity} font-weight="700">{sizeEntry.size}</tspan>
                </text>
            {/each}
        </g>
    {/if}
</g>
