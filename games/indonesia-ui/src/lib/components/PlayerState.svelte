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
</script>

<div class="relative">
    <div
        class="rounded-lg {bgColor} pt-[3px] pb-2 px-2 text-center {gameSession.colors.getPlayerTextColor(
            playerState.playerId
        )} font-medium flex flex-col justify-between {isTurn ? 'border-2 pulse-border' : ''}"
    >
        <h1 class="{isTurn ? 'text-xl font-semibold' : 'text-lg font-medium'} mb-1">
            {isTurn ? '\u21e2 ' : ''}{player.name}{isTurn ? ' \u21e0' : ''}
        </h1>
        {#if companyCards.length > 0}
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
        {/if}
        {#if gameSession.showDebug}
            <div class="text-xs mt-2">id: {player.id}</div>
        {/if}
    </div>
</div>

<style>
    @keyframes border-pulsate {
        0% {
            border-color: rgba(255, 255, 255, 0);
        }
        25% {
            border-color: rgba(255, 255, 255, 255);
        }
        75% {
            border-color: rgba(255, 255, 255, 255);
        }
        100% {
            border-color: rgba(255, 255, 255, 0);
        }
    }

    .pulse-border {
        border-color: white;
        animation: border-pulsate 2.5s infinite;
    }

    .player-company-cards {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px;
        margin-top: 3px;
    }

    .player-company-card-hover-target {
        width: 100%;
    }
</style>
