import {
    CompanyType,
    Era,
    Good,
    GOOD_REVENUE_BY_GOOD,
    type HydratedIndonesiaGameState
} from '@tabletop/indonesia'
import { SHIPPING_ERA_ORDER, shippingSizeTotalsFromDeeds } from '$lib/utils/deeds.js'
import { productionHatchVariantByCompanyId as computeProductionHatchVariantByCompanyId } from '$lib/utils/productionHatching.js'

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

export function playerCompanyCardsForState(
    state: HydratedIndonesiaGameState,
    playerId: string
): PlayerCompanyCardData[] {
    const playerState = state.getPlayerState(playerId)
    const currentEra = state.era
    const currentEraIndex = ERA_ORDER_INDEX[currentEra]

    const ownedCompanies = state.companies
        .filter((company) => company.owner === playerId)
        .sort((companyA, companyB) => companyA.id.localeCompare(companyB.id))

    const cultivatedGoodsCountByCompanyId = new Map<string, number>()
    for (const area of Object.values(state.board.areas)) {
        if (!areaHasCompanyId(area)) {
            continue
        }
        cultivatedGoodsCountByCompanyId.set(
            area.companyId,
            (cultivatedGoodsCountByCompanyId.get(area.companyId) ?? 0) + 1
        )
    }

    const shipCountByCompanyId = new Map<string, number>()
    for (const area of Object.values(state.board.areas)) {
        if (!areaHasShips(area)) {
            continue
        }
        for (const companyId of area.ships) {
            shipCountByCompanyId.set(companyId, (shipCountByCompanyId.get(companyId) ?? 0) + 1)
        }
    }

    const productionHatchVariantByCompanyId = computeProductionHatchVariantByCompanyId(state, 4)
    const operationsIncomeByCompanyId = state.operationsIncomeByCompanyId ?? {}

    const cards: PlayerCompanyCardData[] = []
    for (const company of ownedCompanies) {
        const deedCount = company.deeds.length

        if (company.type === CompanyType.Production && 'good' in company) {
            const goodsProduced = cultivatedGoodsCountByCompanyId.get(company.id) ?? 0
            cards.push({
                id: company.id,
                type: CompanyType.Production,
                good: company.good,
                deedCount,
                goodsProduced,
                value: goodsProduced * GOOD_REVENUE_BY_GOOD[company.good],
                lastOperationProfit: operationsIncomeByCompanyId[company.id] ?? null,
                hatchVariant: productionHatchVariantByCompanyId.get(company.id) ?? null
            })
            continue
        }

        if (company.type === CompanyType.Shipping) {
            const ships = shipCountByCompanyId.get(company.id) ?? 0
            const sizeEntries = shippingSizeTotalsFromDeeds(company.deeds)
            const maxByEra = new Map(sizeEntries.map((entry) => [entry.era, entry.size]))
            cards.push({
                id: company.id,
                type: CompanyType.Shipping,
                deedCount,
                ships,
                maxShips: maxByEra.get(currentEra) ?? 0,
                value: ships * 10,
                lastOperationProfit: operationsIncomeByCompanyId[company.id] ?? null,
                hullSize: playerState.research.hull + 1,
                remainingEraMaximums: SHIPPING_ERA_ORDER.filter(
                    (era) => ERA_ORDER_INDEX[era] >= currentEraIndex
                ).map((era) => ({
                    era,
                    max: maxByEra.get(era) ?? 0
                })),
                hatchVariant: null
            })
        }
    }

    return cards
}
