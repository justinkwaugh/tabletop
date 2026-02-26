<script lang="ts">
    import {
        COMPANY_DEED_ASPECT_RATIO,
        COMPANY_DEED_VIEWBOX_HEIGHT,
        COMPANY_DEED_VIEWBOX_RX,
        COMPANY_DEED_VIEWBOX_RY,
        COMPANY_DEED_VIEWBOX_WIDTH
    } from '$lib/definitions/companyDeedGeometry.js'
    import {
        companyCardKindFor,
        companyDeedStyleForType
    } from '$lib/components/CompanyDeed.svelte'
    import {
        shippingSizeTotalsFromDeeds,
        type ShippingSizeEntry
    } from '$lib/utils/deeds.js'
    import { CompanyType, Good, type AnyDeed } from '@tabletop/indonesia'

    type CompanyCardCompany = {
        id: string
        type: CompanyType
        deeds: readonly AnyDeed[]
        good?: Good
    }

    let {
        company,
        x,
        y,
        height = 58,
        outline = true,
        outlineColor,
        textColor,
        cultivatedAreaCount = 0,
        earnings = null,
        earningsLabel = 'E'
    }: {
        company: CompanyCardCompany
        x: number
        y: number
        height?: number
        outline?: boolean
        outlineColor?: string
        textColor?: string
        cultivatedAreaCount?: number
        earnings?: number | null
        earningsLabel?: string
    } = $props()

    type StatLine = {
        key: string
        label: string
        value: string
    }

    function resolveProductionGood(cardCompany: CompanyCardCompany): Good | null {
        if (cardCompany.type !== CompanyType.Production) {
            return null
        }
        if (cardCompany.good) {
            return cardCompany.good
        }

        const productionDeed = cardCompany.deeds.find((deed) => deed.type === CompanyType.Production)
        return productionDeed?.good ?? null
    }

    const resolvedCardKind = $derived.by(() => {
        const productionGood = resolveProductionGood(company)
        if (company.type === CompanyType.Production && !productionGood) {
            return 'rice'
        }
        return companyCardKindFor(company.type, productionGood ?? undefined)
    })

    const deedStyle = $derived(companyDeedStyleForType(resolvedCardKind))
    const width = $derived(height * COMPANY_DEED_ASPECT_RATIO)
    const iconXLocal = $derived(-width / 2)
    const iconYLocal = $derived(-height / 2)
    const outlineXLocal = $derived(iconXLocal - 2)
    const outlineYLocal = $derived(iconYLocal - 2)
    const outlineRx = $derived((width / COMPANY_DEED_VIEWBOX_WIDTH) * COMPANY_DEED_VIEWBOX_RX)
    const outlineRy = $derived((height / COMPANY_DEED_VIEWBOX_HEIGHT) * COMPANY_DEED_VIEWBOX_RY)
    const resolvedOutlineColor = $derived(outlineColor ?? deedStyle.outlineColor)
    const resolvedTextColor = $derived(textColor ?? deedStyle.textColor)
    const deedCount = $derived(company.deeds.length)
    const formattedEarnings = $derived.by(() => {
        if (earnings === null || earnings === undefined) {
            return '-'
        }
        return Number.isInteger(earnings) ? `${earnings}` : earnings.toFixed(1)
    })

    const statLines: readonly StatLine[] = $derived.by(() => {
        const lines: StatLine[] = [
            { key: 'deeds', label: 'DEEDS', value: `${deedCount}` }
        ]

        if (company.type === CompanyType.Production) {
            lines.push({
                key: 'areas',
                label: 'GOODS',
                value: `${cultivatedAreaCount}`
            })
        }

        lines.push({
            key: 'earnings',
            label: earningsLabel.toUpperCase(),
            value: formattedEarnings
        })

        return lines
    })

    const statLabelXLocal = $derived(iconXLocal + width * 0.52)
    const statValueXLocal = $derived(iconXLocal + width * 0.87)
    const statFont = $derived(height * 0.13)
    const statLineHeight = $derived(statFont * 1.08)
    const statStartYLocal = $derived(iconYLocal + height * 0.11)

    const shippingSizeRow: readonly ShippingSizeEntry[] = $derived.by(() => {
        if (company.type !== CompanyType.Shipping) {
            return []
        }
        return shippingSizeTotalsFromDeeds(company.deeds)
    })
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

    {#each statLines as line, lineIndex (line.key)}
        <text
            x={statLabelXLocal}
            y={statStartYLocal + lineIndex * statLineHeight}
            fill={resolvedTextColor}
            fill-opacity={0.7}
            font-size={statFont}
            font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
            text-anchor="start"
            dominant-baseline="hanging"
            letter-spacing="0.2"
        >
            {line.label}
        </text>
        <text
            x={statValueXLocal}
            y={statStartYLocal + lineIndex * statLineHeight}
            fill={resolvedTextColor}
            font-size={statFont}
            font-weight="800"
            font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
            text-anchor="start"
            dominant-baseline="hanging"
            letter-spacing="0.2"
        >
            {line.value}
        </text>
    {/each}

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
