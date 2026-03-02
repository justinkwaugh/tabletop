<script lang="ts">
    import { type Player } from '@tabletop/common'
    import PlayerCompanyCompactCard, {
        type PlayerCompanyCardData
    } from '$lib/components/PlayerCompanyCompactCard.svelte'
    import { SHIPPING_ERA_ORDER, shippingSizeTotalsFromDeeds } from '$lib/utils/deeds.js'
    import {
        GOOD_REVENUE_BY_GOOD,
        type HydratedIndonesiaPlayerState,
        CompanyType,
        Era,
        Good,
    } from '@tabletop/indonesia'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: HydratedIndonesiaPlayerState } = $props()

    const ERA_ORDER_INDEX: Record<Era, number> = {
        [Era.A]: 0,
        [Era.B]: 1,
        [Era.C]: 2
    }

    function areaHasCompanyId(area: Record<string, unknown>): area is Record<string, unknown> & {
        companyId: string
    } {
        return typeof area.companyId === 'string'
    }

    function areaHasShips(area: Record<string, unknown>): area is Record<string, unknown> & {
        ships: string[]
    } {
        return Array.isArray(area.ships)
    }

    function areaHasCompanyIdAndGood(area: Record<string, unknown>): area is Record<string, unknown> & {
        companyId: string
        good: Good
    } {
        return typeof area.companyId === 'string' && typeof area.good === 'string'
    }

    let isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(player.id))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(player.id))
    const lastOperationsEarnings: number | null = null
    let earningsDisplay = $derived(lastOperationsEarnings === null ? '\u2014' : String(lastOperationsEarnings))
    let ownedCompanies = $derived.by(() =>
        gameSession.gameState.companies
            .filter((company) => company.owner === playerState.playerId)
            .sort((companyA, companyB) => companyA.id.localeCompare(companyB.id))
    )

    let cultivatedGoodsCountByCompanyId = $derived.by(() => {
        const counts = new Map<string, number>()
        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!areaHasCompanyId(area)) {
                continue
            }
            counts.set(area.companyId, (counts.get(area.companyId) ?? 0) + 1)
        }
        return counts
    })

    let shipCountByCompanyId = $derived.by(() => {
        const counts = new Map<string, number>()
        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!areaHasShips(area)) {
                continue
            }
            for (const companyId of area.ships) {
                counts.set(companyId, (counts.get(companyId) ?? 0) + 1)
            }
        }
        return counts
    })

    let productionHatchVariantByCompanyId = $derived.by(() => {
        const ownedProductionCompanies = ownedCompanies.filter(
            (company): company is (typeof ownedCompanies)[number] & {
                type: CompanyType.Production
                good: Good
            } => company.type === CompanyType.Production && 'good' in company
        )
        const ownedProductionCompanyById = new Map(
            ownedProductionCompanies.map((company) => [company.id, company] as const)
        )
        const companyIdsByOwnerAndGood = new Map<string, Set<string>>()
        const conflictRankByCompanyId = new Map<string, number>()

        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!areaHasCompanyIdAndGood(area)) {
                continue
            }

            const company = ownedProductionCompanyById.get(area.companyId)
            if (!company) {
                continue
            }

            const ownerAndGoodKey = `${company.owner}|${area.good}`
            const companyIds = companyIdsByOwnerAndGood.get(ownerAndGoodKey) ?? new Set<string>()
            companyIds.add(company.id)
            companyIdsByOwnerAndGood.set(ownerAndGoodKey, companyIds)
        }

        for (const companyIds of companyIdsByOwnerAndGood.values()) {
            if (companyIds.size <= 1) {
                continue
            }

            for (const [index, companyId] of [...companyIds]
                .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
                .entries()) {
                conflictRankByCompanyId.set(companyId, index)
            }
        }

        const hatchVariantByCompanyId = new Map<string, number>()
        for (const [companyId, conflictRank] of conflictRankByCompanyId.entries()) {
            if (conflictRank <= 0) {
                continue
            }
            hatchVariantByCompanyId.set(companyId, (conflictRank - 1) % 4)
        }
        return hatchVariantByCompanyId
    })

    let companyCards: PlayerCompanyCardData[] = $derived.by(() => {
        const currentEra = gameSession.gameState.era
        const currentEraIndex = ERA_ORDER_INDEX[currentEra]

        const cards: PlayerCompanyCardData[] = []
        for (const company of ownedCompanies) {
            const deedCount = company.deeds.length

            if (company.type === CompanyType.Production && 'good' in company) {
                const goodsProduced = cultivatedGoodsCountByCompanyId.get(company.id) ?? 0
                const productionCard: PlayerCompanyCardData = {
                    id: company.id,
                    type: CompanyType.Production,
                    good: company.good,
                    deedCount,
                    goodsProduced,
                    value: goodsProduced * GOOD_REVENUE_BY_GOOD[company.good],
                    hatchVariant: productionHatchVariantByCompanyId.get(company.id) ?? null
                }
                cards.push(productionCard)
                continue
            }

            if (company.type === CompanyType.Shipping) {
                const ships = shipCountByCompanyId.get(company.id) ?? 0
                const sizeEntries = shippingSizeTotalsFromDeeds(company.deeds)
                const maxByEra = new Map(sizeEntries.map((entry) => [entry.era, entry.size]))
                const shippingCard: PlayerCompanyCardData = {
                    id: company.id,
                    type: CompanyType.Shipping,
                    deedCount,
                    ships,
                    maxShips: maxByEra.get(currentEra) ?? 0,
                    value: ships * 10,
                    hullSize: playerState.research.hull + 1,
                    remainingEraMaximums: SHIPPING_ERA_ORDER.filter(
                        (era) => ERA_ORDER_INDEX[era] >= currentEraIndex
                    ).map((era) => ({
                        era,
                        max: maxByEra.get(era) ?? 0
                    })),
                    hatchVariant: null
                }
                cards.push(shippingCard)
            }
        }

        return cards
    })

    const maxCompanySlots = $derived(1 + playerState.research.slots)
    const openCompanySlots = $derived(Math.max(0, maxCompanySlots - ownedCompanies.length))
    const openSlotsLabel = $derived(openCompanySlots === 1 ? 'OPEN SLOT' : 'OPEN SLOTS')
    // Temporary preview toggle for the empty companies treatment.
    const showNoCompaniesPreview = false
</script>

<div class="relative">
    <div class="player-state-shell {isTurn ? 'pulse-border' : ''}">
        <div class="player-state-header">
            <svg
                class="player-name-ornament player-name-ornament-left"
                viewBox="0 0 64.8 23.43"
                aria-hidden="true"
                focusable="false"
            >
                <path class="player-name-ornament-fill" d="M5.45,11.53C29.48,1.16,43.64,25.5,57.36,21c12.37-3.92,2.9-27.7-7.37-18.13,3.06-6.04,12.09-1.54,13.69,3.99,5.68,14.45-11.48,21.58-21.99,12.55-9.33-6.97-23.69-9.35-33.56-2.81-9.48,6.43-11.05.11-2.68-5.07Z"></path>
                <path class="player-name-ornament-fill" d="M48.78,13.23c-5.03-6.36,6.16-11.99,9.7-5.28,3.05,4.29.05,10.92-5.24,11.2-4,.32-7.46-2.76-10.44-4.41-10.48-6.13-21.47-9.45-32.85-7.56C32.18.27,49.54,23.21,56.49,16.35c4.71-3.38-1.35-12.5-5.23-7.34-.46.85.32,1.96,1.02,2.19.95.22,1.79-.89,2.51-1.25,3.51,2.4-3.23,7.18-6.01,3.28Z"></path>
                <path class="player-name-ornament-fill" d="M50.62,10.15c-1.29,3.2,3.76,5.14,4.96,1.91,1.29-3.2-3.76-5.14-4.96-1.91Z"></path>
            </svg>
            <div class="player-name-wrap">
                <span class="player-name-wash player-name-wash-left {bgColor}" aria-hidden="true"></span>
                <span class="player-name-wash player-name-wash-right {bgColor}" aria-hidden="true"></span>
                <h1
                    class="player-name-text {isTurn
                        ? 'text-xl font-semibold'
                        : 'text-lg font-medium'}"
                >
                    {#if isTurn}
                        <span class="player-turn-arrow">⇢</span>
                    {/if}
                    <span class="player-name-core">{player.name}</span>
                    {#if isTurn}
                        <span class="player-turn-arrow">⇠</span>
                    {/if}
                </h1>
            </div>
            <svg
                class="player-name-ornament player-name-ornament-right"
                viewBox="0 0 64.8 23.43"
                aria-hidden="true"
                focusable="false"
            >
                <path class="player-name-ornament-fill" d="M5.45,11.53C29.48,1.16,43.64,25.5,57.36,21c12.37-3.92,2.9-27.7-7.37-18.13,3.06-6.04,12.09-1.54,13.69,3.99,5.68,14.45-11.48,21.58-21.99,12.55-9.33-6.97-23.69-9.35-33.56-2.81-9.48,6.43-11.05.11-2.68-5.07Z"></path>
                <path class="player-name-ornament-fill" d="M48.78,13.23c-5.03-6.36,6.16-11.99,9.7-5.28,3.05,4.29.05,10.92-5.24,11.2-4,.32-7.46-2.76-10.44-4.41-10.48-6.13-21.47-9.45-32.85-7.56C32.18.27,49.54,23.21,56.49,16.35c4.71-3.38-1.35-12.5-5.23-7.34-.46.85.32,1.96,1.02,2.19.95.22,1.79-.89,2.51-1.25,3.51,2.4-3.23,7.18-6.01,3.28Z"></path>
                <path class="player-name-ornament-fill" d="M50.62,10.15c-1.29,3.2,3.76,5.14,4.96,1.91,1.29-3.2-3.76-5.14-4.96-1.91Z"></path>
            </svg>
        </div>

        <div class="player-state-body">
            <div class="player-section-header" aria-hidden="true">
                <span class="player-section-rule"></span>
                <span class="player-section-title">FINANCES</span>
                <span class="player-section-rule"></span>
            </div>
            <div class="player-finance-row" aria-label={`${player.name} finances`}>
                <div class="player-finance-chip">
                    <span class="player-finance-label">CASH</span>
                    <span class="player-finance-value">{playerState.cash}</span>
                </div>
                <div class="player-finance-divider" aria-hidden="true"></div>
                <div class="player-finance-chip">
                    <span class="player-finance-label">BANK</span>
                    <span class="player-finance-value">{playerState.bank}</span>
                </div>
                <div class="player-finance-divider" aria-hidden="true"></div>
                <div class="player-finance-chip">
                    <span class="player-finance-label">EARNINGS</span>
                    <span class="player-finance-value">{earningsDisplay}</span>
                </div>
            </div>

            {#if !showNoCompaniesPreview && companyCards.length > 0}
                <div class="player-section-header player-section-header-companies" aria-hidden="true">
                    <span class="player-section-title">COMPANIES</span>
                    <span class="player-section-dash" aria-hidden="true"></span>
                    <span class="player-section-title-meta">{openCompanySlots} {openSlotsLabel}</span>
                </div>
                <div class="player-company-cards" aria-label={`${player.name} companies`}>
                    {#each companyCards as card (card.id)}
                        <div
                            class="player-company-card-hover-target"
                            onmouseenter={() => {
                                gameSession.setHoveredOperatingCompany(card.id)
                            }}
                            onmouseleave={() => {
                                gameSession.setHoveredOperatingCompany(undefined)
                            }}
                        >
                            <PlayerCompanyCompactCard {card} />
                        </div>
                    {/each}
                </div>
            {:else}
                <div class="player-section-header player-section-header-companies" aria-hidden="true">
                    <span class="player-section-title">COMPANIES</span>
                    <span class="player-section-dash" aria-hidden="true"></span>
                    <span class="player-section-title-meta">{openCompanySlots} {openSlotsLabel}</span>
                </div>
                <div class="player-company-empty" aria-label={`${player.name} has no companies`}>
                    NO COMPANIES
                </div>
            {/if}

            {#if gameSession.showDebug}
                <div class="text-xs mt-2">id: {player.id}</div>
            {/if}
        </div>
    </div>
</div>

<style>
    @keyframes border-pulsate {
        0% {
            box-shadow:
                0 0 0 0 rgba(245, 236, 221, 0),
                inset 0 0 0 1px rgba(255, 255, 255, 0);
        }
        25% {
            box-shadow:
                0 0 0 2px rgba(245, 236, 221, 0.95),
                inset 0 0 0 1px rgba(255, 255, 255, 0.45);
        }
        75% {
            box-shadow:
                0 0 0 2px rgba(245, 236, 221, 0.95),
                inset 0 0 0 1px rgba(255, 255, 255, 0.45);
        }
        100% {
            box-shadow:
                0 0 0 0 rgba(245, 236, 221, 0),
                inset 0 0 0 1px rgba(255, 255, 255, 0);
        }
    }

    .player-state-shell {
        background: #f7f3ef;
        padding: 8px;
    }

    .player-state-header {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 2px;
        margin: 0 0 4px;
    }

    .player-name-wrap {
        position: relative;
        text-align: center;
        padding: 3px 10px 2px;
        border-radius: 3px;
        overflow: hidden;
    }

    .player-name-wash {
        position: absolute;
        top: 1px;
        bottom: 1px;
        opacity: 0.8;
        filter: none;
        pointer-events: none;
    }

    .player-name-wash-left {
        left: 4px;
        right: 4px;
        border-radius: 3px;
        -webkit-mask-image: linear-gradient(
            90deg,
            rgba(0, 0, 0, 0) 0%,
            rgba(0, 0, 0, 0.32) 24%,
            rgba(0, 0, 0, 0.92) 58%,
            rgba(0, 0, 0, 1) 74%
        );
        mask-image: linear-gradient(
            90deg,
            rgba(0, 0, 0, 0) 0%,
            rgba(0, 0, 0, 0.32) 24%,
            rgba(0, 0, 0, 0.92) 58%,
            rgba(0, 0, 0, 1) 74%
        );
    }

    .player-name-wash-right {
        left: 4px;
        right: 4px;
        border-radius: 3px;
        -webkit-mask-image: linear-gradient(
            90deg,
            rgba(0, 0, 0, 1) 26%,
            rgba(0, 0, 0, 0.92) 42%,
            rgba(0, 0, 0, 0.32) 76%,
            rgba(0, 0, 0, 0) 100%
        );
        mask-image: linear-gradient(
            90deg,
            rgba(0, 0, 0, 1) 26%,
            rgba(0, 0, 0, 0.92) 42%,
            rgba(0, 0, 0, 0.32) 76%,
            rgba(0, 0, 0, 0) 100%
        );
    }

    .player-name-text {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        letter-spacing: 0.02em;
        color: #f6ecdc;
    }

    .player-name-core {
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .player-name-ornament {
        width: 30px;
        height: 22.5px;
        flex: 0 0 auto;
        opacity: 1;
        color: rgba(122, 93, 63, 0.5);
        transform: translateY(-0.5px);
    }

    .player-name-ornament-right {
        transform: translateY(-0.5px) scaleX(-1);
    }

    .player-name-ornament-fill {
        fill: currentColor;
    }

    .player-turn-arrow {
        line-height: 1;
        color: color-mix(in srgb, #f6ecdc 92%, #c8a277);
    }

    .player-state-body {
        padding: 0;
    }

    .pulse-border {
        animation: border-pulsate 2.5s infinite;
    }

    .player-finance-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: stretch;
        margin-bottom: 4px;
        background: transparent;
    }

    .player-finance-chip {
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        padding: 4px 6px;
    }

    .player-finance-divider {
        width: 1px;
        height: 72%;
        align-self: center;
        background: rgba(124, 96, 66, 0.3);
    }

    .player-finance-label {
        font-size: 8px;
        letter-spacing: 0.14em;
        line-height: 1;
        font-weight: 700;
        color: rgba(97, 69, 44, 0.72);
    }

    .player-finance-value {
        font-size: 15px;
        line-height: 1;
        font-weight: 700;
        letter-spacing: 0.01em;
        color: rgba(68, 44, 25, 0.96);
    }

    .player-section-header {
        display: flex;
        align-items: center;
        column-gap: 7px;
        margin: 2px 0 6px;
    }

    .player-section-rule {
        flex: 1 1 auto;
        height: 1px;
        background: rgba(122, 93, 63, 0.38);
    }

    .player-section-header .player-section-rule:first-child {
        display: none;
    }

    .player-section-title {
        font-size: 8px;
        line-height: 1;
        letter-spacing: 0.12em;
        font-weight: 700;
        color: rgba(97, 69, 44, 0.7);
    }

    .player-section-title-meta {
        font-size: 8px;
        line-height: 1;
        letter-spacing: 0.1em;
        color: rgba(97, 69, 44, 0.62);
        white-space: nowrap;
    }

    .player-section-header-companies {
        width: 100%;
        column-gap: 6px;
    }

    .player-section-dash {
        flex: 1 1 auto;
        height: 1px;
        background: rgba(122, 93, 63, 0.38);
    }

    .player-company-cards {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
    }

    .player-company-card-hover-target {
        width: 100%;
        height: 100%;
    }

    .player-company-empty {
        min-height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 300;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(97, 69, 44, 0.42);
    }
</style>
