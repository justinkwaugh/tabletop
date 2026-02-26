<script module lang="ts">
    import OilCompanyIcon from '$lib/images/OilCompanyIcon.svelte'
    import RiceCompanyIcon from '$lib/images/RiceCompanyIcon.svelte'
    import RubberCompanyIcon from '$lib/images/RubberCompanyIcon.svelte'
    import ShipCompanyIcon from '$lib/images/ShipCompanyIcon.svelte'
    import SpiceCompanyIcon from '$lib/images/SpiceCompanyIcon.svelte'
    import type { CompanyCardType } from '$lib/types/companyCard.js'
    import { CompanyType, Good, type AnyDeed } from '@tabletop/indonesia'

    const COMPANY_DEED_STYLE_BY_TYPE = {
        rice: {
            icon: RiceCompanyIcon,
            outlineColor: '#b2a38c',
            textColor: '#6c5a46',
            textXRatio: 0.45,
            textYRatio: 0.4,
            overlayFill: '#e3d8c0',
            overlayStroke: '#6c5a46',
            overlayOpacity: 0.8
        },
        spice: {
            icon: SpiceCompanyIcon,
            outlineColor: '#94a982',
            textColor: '#425735',
            textXRatio: 0.45,
            textYRatio: 0.45,
            overlayFill: '#d5e1b1',
            overlayStroke: '#425735',
            overlayOpacity: 0.8
        },
        rubber: {
            icon: RubberCompanyIcon,
            outlineColor: '#9c9c9c',
            textColor: '#131113',
            textXRatio: 0.45,
            textYRatio: 0.45,
            overlayFill: '#c1bdbb',
            overlayStroke: '#131113',
            overlayOpacity: 0.8
        },
        oil: {
            icon: OilCompanyIcon,
            outlineColor: '#8a7f9b',
            textColor: '#23344f',
            textXRatio: 0.61,
            textYRatio: 0.33,
            overlayFill: '#baa8ca',
            overlayStroke: '#23344f',
            overlayOpacity: 0.8
        },
        ship: {
            icon: ShipCompanyIcon,
            outlineColor: '#7ea6ad',
            textColor: '#396c78',
            textXRatio: 0.45,
            textYRatio: 0.45,
            overlayFill: '#9fc4c5',
            overlayStroke: '#396c78',
            overlayOpacity: 0.4
        }
    }

    export type CompanyDeedStyle = (typeof COMPANY_DEED_STYLE_BY_TYPE)[CompanyCardType]

    const PRODUCTION_COMPANY_DEED_TYPE_BY_GOOD: Readonly<Record<Good, CompanyCardType>> = {
        [Good.Rice]: 'rice',
        [Good.Spice]: 'spice',
        [Good.Rubber]: 'rubber',
        [Good.Oil]: 'oil',
        [Good.SiapSaji]: 'spice'
    }

    export function companyDeedStyleForType(type: CompanyCardType): CompanyDeedStyle {
        return COMPANY_DEED_STYLE_BY_TYPE[type]
    }

    export function companyCardKindFor(companyType: CompanyType, good?: Good): CompanyCardType {
        if (companyType === CompanyType.Shipping) {
            return 'ship'
        }
        if (!good) {
            throw new Error('Production company card kind requires a good type')
        }
        return PRODUCTION_COMPANY_DEED_TYPE_BY_GOOD[good]
    }

    export function deedCardKindFor(deed: AnyDeed): CompanyCardType {
        if (deed.type === CompanyType.Production) {
            return companyCardKindFor(deed.type, deed.good)
        }
        return companyCardKindFor(deed.type)
    }
</script>

<script lang="ts">
    import {
        COMPANY_DEED_ASPECT_RATIO,
        COMPANY_DEED_VIEWBOX_HEIGHT,
        COMPANY_DEED_VIEWBOX_RX,
        COMPANY_DEED_VIEWBOX_RY,
        COMPANY_DEED_VIEWBOX_WIDTH
    } from '$lib/definitions/companyDeedGeometry.js'

    type CompanyDeedType = import('$lib/types/companyCard.js').CompanyCardType

    type ShippingSizeEntry = {
        era: 'A' | 'B' | 'C'
        size: number
    }

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
        type: CompanyDeedType
        x: number
        y: number
        height?: number
        outline?: boolean
        outlineColor?: string
        text?: string
        textColor?: string
        shippingSizes?: readonly ShippingSizeEntry[] | null
    } = $props()

    const deedStyle = $derived(companyDeedStyleForType(type))
    const width = $derived(height * COMPANY_DEED_ASPECT_RATIO)
    const iconXLocal = $derived(-width / 2)
    const iconYLocal = $derived(-height / 2)
    const outlineXLocal = $derived(iconXLocal - 2)
    const outlineYLocal = $derived(iconYLocal - 2)
    const outlineRx = $derived((width / COMPANY_DEED_VIEWBOX_WIDTH) * COMPANY_DEED_VIEWBOX_RX)
    const outlineRy = $derived((height / COMPANY_DEED_VIEWBOX_HEIGHT) * COMPANY_DEED_VIEWBOX_RY)
    const resolvedOutlineColor = $derived(outlineColor ?? deedStyle.outlineColor)
    const resolvedTextColor = $derived(textColor ?? deedStyle.textColor)
    const textXLocal = $derived(iconXLocal + width * deedStyle.textXRatio)
    const textYLocal = $derived(iconYLocal + height * deedStyle.textYRatio)
    const textSize = $derived(height * 0.23)
    const textLines = $derived.by(() => {
        const trimmed = text.trim()
        if (trimmed.length === 0) {
            return []
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
    <deedStyle.icon x={iconXLocal} y={iconYLocal} {width} {height} />
    {#if textLines.length > 0}
        <text
            x={textXLocal}
            class="indonesia-font"
            fill={resolvedTextColor}
            font-size={textSize}
            text-anchor="start"
            letter-spacing="0.2"
        >
            {#each textLines as line, lineIndex (lineIndex)}
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
                    <tspan fill-opacity={shippingEraOpacity} font-weight="500"
                        >{sizeEntry.era}</tspan
                    >
                    <tspan dx={shippingPairSpacing}></tspan>
                    <tspan fill-opacity={shippingNumberOpacity} font-weight="700"
                        >{sizeEntry.size}</tspan
                    >
                </text>
            {/each}
        </g>
    {/if}
</g>
