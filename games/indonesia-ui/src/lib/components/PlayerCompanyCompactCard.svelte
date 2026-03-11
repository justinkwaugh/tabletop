<script lang="ts">
    import { companyCardKindFor, companyDeedStyleForType } from '$lib/components/CompanyDeed.svelte'
    import SimpleOilIcon from '$lib/images/SimpleOilIcon.svelte'
    import SimpleRiceIcon from '$lib/images/SimpleRiceIcon.svelte'
    import SimpleRubberIcon from '$lib/images/SimpleRubberIcon.svelte'
    import SimpleShipIcon from '$lib/images/SimpleShipIcon.svelte'
    import SimpleSiapSajiIcon from '$lib/images/SimpleSiapSajiIcon.svelte'
    import SimpleSpiceIcon from '$lib/images/SimpleSpiceIcon.svelte'
    import type { CompanyCardType } from '$lib/types/companyCard.js'
    import { CompanyType, Era, Good } from '@tabletop/indonesia'

    export type ProductionCompanyCardData = {
        id: string
        type: CompanyType.Production
        good: Good
        deedCount: number
        goodsProduced: number
        value: number
        lastOperationProfit: number | null
        hatchVariant: number | null
    }

    export type ShippingCompanyCardData = {
        id: string
        type: CompanyType.Shipping
        deedCount: number
        ships: number
        maxShips: number
        value: number
        lastOperationProfit: number | null
        hullSize: number
        remainingEraMaximums: readonly { era: Era; max: number }[]
        hatchVariant: null
    }

    export type PlayerCompanyCardData = ProductionCompanyCardData | ShippingCompanyCardData

    let { card, unavailable = false }: { card: PlayerCompanyCardData; unavailable?: boolean } = $props()
    const SIMPLE_SHIP_ICON_COLOR = '#216e7a'

    const cardKind: CompanyCardType = $derived.by(() => {
        if (card.type === CompanyType.Shipping) {
            return 'ship'
        }
        return companyCardKindFor(card.type, card.good)
    })

    const deedStyle = $derived(companyDeedStyleForType(cardKind))

    const upcomingShippingEraEntry = $derived.by(() => {
        if (card.type !== CompanyType.Shipping) {
            return null
        }
        const upcomingEraEntry = card.remainingEraMaximums[1]
        if (!upcomingEraEntry) {
            return null
        }
        return upcomingEraEntry
    })

    const isSiapSajiProductionCard = $derived(
        card.type === CompanyType.Production && card.good === Good.SiapSaji
    )

    const cardStyle = $derived.by(() => {
        return `--company-outline:${deedStyle.outlineColor}; --company-fill:${deedStyle.overlayFill}; --company-text:${deedStyle.textColor};`
    })
    const middleMetric = $derived.by(() => {
        if (card.type === CompanyType.Production) {
            return {
                label: card.goodsProduced === 1 ? 'GOOD' : 'GOODS',
                value: String(card.goodsProduced)
            }
        }
        return {
            label: 'SHIPS',
            value: `${card.ships}/${card.maxShips}`
        }
    })

    const lastOperationProfitLabel = $derived.by(() => {
        if (card.lastOperationProfit === null) {
            return 'profit ---'
        }

        return `profit ${card.lastOperationProfit}`
    })

</script>

<article
    class="company-mini-card"
    class:company-mini-card-siapsaji={isSiapSajiProductionCard}
    class:company-mini-card-unavailable={unavailable}
    style={cardStyle}
>
    <span class="company-mini-deed-watermark" aria-hidden="true">{card.deedCount}</span>
    <div class="company-mini-layout">
        <div
            class="company-mini-icon-wrap {card.type === CompanyType.Shipping
                ? 'company-mini-icon-wrap-shipping'
                : 'company-mini-icon-wrap-production'}"
            aria-hidden="true"
        >
            {#if card.type === CompanyType.Shipping}
                <div class="company-mini-ship-unit">
                    <SimpleShipIcon
                        class="company-mini-icon company-mini-icon-shipping"
                        fill={SIMPLE_SHIP_ICON_COLOR}
                    />
                    <span
                        class="company-mini-hull-badge-on-icon"
                        style={`--hull-badge-fill:${SIMPLE_SHIP_ICON_COLOR};`}
                    >
                        {card.hullSize}
                    </span>
                </div>
                {#if upcomingShippingEraEntry !== null}
                    <div class="company-mini-upcoming-era-limit">
                        <span class="company-mini-era-pair">
                            <span class="company-mini-era-letter">{upcomingShippingEraEntry.era}</span>
                            <span class="company-mini-era-number">{upcomingShippingEraEntry.max}</span>
                        </span>
                    </div>
                {/if}
            {:else}
                {#if isSiapSajiProductionCard}
                    <SimpleSiapSajiIcon
                        class="company-mini-icon company-mini-icon-siapsaji"
                        fill={deedStyle.textColor}
                    />
                {:else if card.good === Good.Rice}
                    <SimpleRiceIcon class="company-mini-icon" fill={deedStyle.textColor} />
                {:else if card.good === Good.Spice}
                    <SimpleSpiceIcon class="company-mini-icon" fill={deedStyle.textColor} />
                {:else if card.good === Good.Rubber}
                    <SimpleRubberIcon
                        class="company-mini-icon"
                        baseFill={deedStyle.textColor}
                        coreFill={deedStyle.overlayFill}
                    />
                {:else}
                    <SimpleOilIcon class="company-mini-icon" fill={deedStyle.textColor} />
                {/if}
            {/if}
        </div>

        <div class="company-mini-content">
            <div class="company-mini-metrics">
                <div class="company-mini-metric">
                    <span class="company-mini-value">{middleMetric.value}</span>
                    <span class="company-mini-label">{middleMetric.label}</span>
                </div>
                <div class="company-mini-metric">
                    <span class="company-mini-value">{card.value}</span>
                    <span class="company-mini-label">VALUE</span>
                </div>
            </div>
            <div class="company-mini-secondary-metric">{lastOperationProfitLabel}</div>
        </div>
    </div>
</article>

<style>
    .company-mini-card {
        border: none;
        border-radius: 8px;
        padding: 4px 4px 4px 6px;
        display: flex;
        position: relative;
        overflow: hidden;
        align-items: center;
        background: var(--company-fill);
        min-height: 46px;
        height: 100%;
        box-sizing: border-box;
    }

    .company-mini-card-siapsaji {
        box-shadow: inset 0 0 0 1px rgb(111 76 95 / 0.45);
    }

    .company-mini-card-unavailable {
        opacity: 0.58;
        filter: saturate(0.32) brightness(0.92);
        box-shadow: inset 0 0 0 1.5px rgba(31, 41, 55, 0.32);
    }

    .company-mini-layout {
        display: grid;
        grid-template-columns: 28px 1fr;
        align-items: center;
        align-content: center;
        column-gap: 6px;
        min-height: 28px;
        width: 100%;
        height: 100%;
        position: relative;
        z-index: 1;
    }

    .company-mini-deed-watermark {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-52%);
        font-size: 40px;
        line-height: 0.82;
        font-weight: 700;
        letter-spacing: -0.06em;
        color: color-mix(in srgb, var(--company-text) 18%, transparent);
        pointer-events: none;
        user-select: none;
        z-index: 0;
    }

    .company-mini-icon-wrap {
        width: 28px;
        height: 100%;
        border-radius: 2px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
    }

    .company-mini-icon-wrap-shipping {
        justify-content: center;
        gap: 4px;
        padding-top: 0;
        padding-bottom: 0;
    }

    .company-mini-icon-wrap-production {
        padding-left: 3px;
    }

    .company-mini-icon {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
    }

    .company-mini-ship-unit {
        width: 100%;
        height: 18px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 5px;
    }

    .company-mini-icon-shipping {
        width: 100%;
        height: 100%;
    }

    .company-mini-content {
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-width: 0;
        width: 100%;
        padding-right: 32px;
        gap: 4px;
    }

    .company-mini-metrics {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: 6px;
        width: 100%;
    }

    .company-mini-metric {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        line-height: 1;
        min-width: 0;
    }

    .company-mini-value {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.015em;
        color: color-mix(in srgb, var(--company-text) 86%, #111827);
        white-space: nowrap;
    }

    .company-mini-secondary-metric {
        font-size: 8px;
        line-height: 1;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        text-align: center;
        color: color-mix(in srgb, var(--company-text) 76%, transparent);
        white-space: nowrap;
        margin-top: 2px;
    }

    .company-mini-upcoming-era-limit {
        font-size: 10px;
        line-height: 1;
        letter-spacing: 0.01em;
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: center;
        gap: 4px;
        row-gap: 1px;
        width: 100%;
    }

    .company-mini-era-pair {
        display: inline-flex;
        align-items: baseline;
        gap: 0;
    }

    .company-mini-era-letter {
        font-size: 10px;
        font-weight: 600;
        color: color-mix(in srgb, var(--company-text) 62%, #6b7280);
    }

    .company-mini-era-number {
        font-weight: 700;
        color: color-mix(in srgb, var(--company-text) 92%, #111827);
    }

    .company-mini-hull-badge-on-icon {
        position: absolute;
        left: 50%;
        bottom: -5px;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: var(--hull-badge-fill);
        color: #f8fafc;
        font-size: 8px;
        font-weight: 600;
        line-height: 1;
        pointer-events: none;
    }

    .company-mini-label {
        font-size: 7px;
        font-weight: 700;
        letter-spacing: 0.03em;
        color: color-mix(in srgb, var(--company-text) 64%, #374151);
        white-space: nowrap;
    }
</style>
