import { HydratedAuction } from '@tabletop/common'
import {
    Company,
    isProductionCompany,
    isShippingCompany,
    type ProductionCompany
} from '../components/company.js'
import { isCultivatedArea, isSeaArea } from '../components/area.js'
import { CompanyType } from '../definition/companyType.js'
import { Era } from '../definition/eras.js'
import { Good } from '../definition/goods.js'
import { IndonesiaNeighborDirection } from '../utils/indonesiaNodes.js'
import {
    type HydratedIndonesiaGameState,
    type MergerCompanySummary
} from '../model/gameState.js'

const SHIPPING_NOMINAL_VALUE_PER_UNIT = 10
const NOMINAL_VALUE_BY_GOOD: Record<Good, number> = {
    [Good.Rice]: 20,
    [Good.Spice]: 25,
    [Good.Rubber]: 30,
    [Good.SiapSaji]: 35,
    [Good.Oil]: 40
}

export type LegalMergerOption = {
    announcerId: string
    companyAId: string
    companyBId: string
    companyType: CompanyType
    resultingGood?: Good
    isSiapSaji: boolean
    totalUnits: number
    nominalValue: number
    bidIncrement: number
    maxMergedDeeds: number
    mergedDeedCount: number
    eligibleBidderIds: string[]
    companies: [MergerCompanySummary, MergerCompanySummary]
}

function companyUnitCount(state: HydratedIndonesiaGameState, company: Company): number {
    if (isShippingCompany(company)) {
        let shipCount = 0
        for (const area of Object.values(state.board.areas)) {
            if (!isSeaArea(area)) {
                continue
            }
            for (const shipCompanyId of area.ships) {
                if (shipCompanyId === company.id) {
                    shipCount += 1
                }
            }
        }
        return shipCount
    }

    let cultivatedCount = 0
    for (const area of Object.values(state.board.areas)) {
        if (!isCultivatedArea(area)) {
            continue
        }
        if (area.companyId === company.id) {
            cultivatedCount += 1
        }
    }
    return cultivatedCount
}

function playerMaxCompanyCount(state: HydratedIndonesiaGameState, playerId: string): number {
    const playerState = state.getPlayerState(playerId)
    return 1 + playerState.research.slots
}

export function playerHasFreeCompanySlot(state: HydratedIndonesiaGameState, playerId: string): boolean {
    const playerState = state.getPlayerState(playerId)
    return playerState.ownedCompanies.length < playerMaxCompanyCount(state, playerId)
}

export function canPlayerHoldMergedCompany(
    state: HydratedIndonesiaGameState,
    playerId: string,
    companyA: Company,
    companyB: Company
): boolean {
    if (companyA.owner === playerId || companyB.owner === playerId) {
        return true
    }

    return playerHasFreeCompanySlot(state, playerId)
}

function resultingProductionGood(
    era: Era,
    companyA: ProductionCompany,
    companyB: ProductionCompany
): { resultingGood: Good; isSiapSaji: boolean } | null {
    if (companyA.good === companyB.good) {
        return {
            resultingGood: companyA.good,
            isSiapSaji: false
        }
    }

    const isRiceSpicePair =
        (companyA.good === Good.Rice && companyB.good === Good.Spice) ||
        (companyA.good === Good.Spice && companyB.good === Good.Rice)
    if (!isRiceSpicePair) {
        return null
    }

    if (era === Era.A) {
        return null
    }

    return {
        resultingGood: Good.SiapSaji,
        isSiapSaji: true
    }
}

function mergerCompatibility(
    state: HydratedIndonesiaGameState,
    companyA: Company,
    companyB: Company
): { companyType: CompanyType; resultingGood?: Good; isSiapSaji: boolean } | null {
    if (companyA.type !== companyB.type) {
        return null
    }

    if (isShippingCompany(companyA) && isShippingCompany(companyB)) {
        return {
            companyType: CompanyType.Shipping,
            isSiapSaji: false
        }
    }

    if (!isProductionCompany(companyA) || !isProductionCompany(companyB)) {
        return null
    }

    const productionResult = resultingProductionGood(state.era, companyA, companyB)
    if (!productionResult) {
        return null
    }

    return {
        companyType: CompanyType.Production,
        resultingGood: productionResult.resultingGood,
        isSiapSaji: productionResult.isSiapSaji
    }
}

function hasMergedDeedThisYear(state: HydratedIndonesiaGameState, company: Company): boolean {
    const mergedDeedIdSet = new Set(state.mergedDeedIdsThisYear)
    return company.deeds.some((deed) => mergedDeedIdSet.has(deed.id))
}

function bidderIdsForMerger(
    state: HydratedIndonesiaGameState,
    companyA: Company,
    companyB: Company
): string[] {
    const eligibleIdSet = new Set<string>()
    eligibleIdSet.add(companyA.owner)
    eligibleIdSet.add(companyB.owner)

    for (const playerId of state.turnManager.turnOrder) {
        if (playerHasFreeCompanySlot(state, playerId)) {
            eligibleIdSet.add(playerId)
        }
    }

    return state.turnManager.turnOrder.filter((playerId) => eligibleIdSet.has(playerId))
}

function nominalValueForProposal(
    companyType: CompanyType,
    resultingGood: Good | undefined,
    totalUnits: number,
    isSiapSaji: boolean
): number {
    if (companyType === CompanyType.Shipping) {
        return totalUnits * SHIPPING_NOMINAL_VALUE_PER_UNIT
    }

    if (isSiapSaji) {
        return totalUnits * NOMINAL_VALUE_BY_GOOD[Good.Spice]
    }

    const good = resultingGood
    if (!good) {
        return 0
    }

    return totalUnits * NOMINAL_VALUE_BY_GOOD[good]
}

function mergerCompanySummary(
    state: HydratedIndonesiaGameState,
    company: Company
): MergerCompanySummary {
    return {
        companyId: company.id,
        ownerId: company.owner,
        unitCount: companyUnitCount(state, company),
        deedIds: company.deeds.map((deed) => deed.id),
        good: isProductionCompany(company) ? company.good : undefined
    }
}

export function evaluateLegalMergerOption(
    state: HydratedIndonesiaGameState,
    announcerId: string,
    companyA: Company,
    companyB: Company
): LegalMergerOption | null {
    const announcerState = state.getPlayerState(announcerId)
    if (announcerState.research.mergers <= 0) {
        return null
    }

    if (!canPlayerHoldMergedCompany(state, announcerId, companyA, companyB)) {
        return null
    }

    const compatibility = mergerCompatibility(state, companyA, companyB)
    if (!compatibility) {
        return null
    }

    const mergedDeedCount = companyA.deeds.length + companyB.deeds.length
    const maxMergedDeeds = announcerState.research.mergers + 1
    if (mergedDeedCount > maxMergedDeeds) {
        return null
    }

    if (hasMergedDeedThisYear(state, companyA) || hasMergedDeedThisYear(state, companyB)) {
        return null
    }

    const companyASummary = mergerCompanySummary(state, companyA)
    const companyBSummary = mergerCompanySummary(state, companyB)
    const totalUnits = companyASummary.unitCount + companyBSummary.unitCount
    const nominalValue = nominalValueForProposal(
        compatibility.companyType,
        compatibility.resultingGood,
        totalUnits,
        compatibility.isSiapSaji
    )

    const announcerCash = state.getPlayerState(announcerId).cash
    if (announcerCash < nominalValue) {
        return null
    }

    const eligibleBidderIds = bidderIdsForMerger(state, companyA, companyB)
    if (!eligibleBidderIds.includes(announcerId)) {
        return null
    }

    return {
        announcerId,
        companyAId: companyA.id,
        companyBId: companyB.id,
        companyType: compatibility.companyType,
        resultingGood: compatibility.resultingGood,
        isSiapSaji: compatibility.isSiapSaji,
        totalUnits,
        nominalValue,
        bidIncrement: Math.max(1, totalUnits),
        maxMergedDeeds,
        mergedDeedCount,
        eligibleBidderIds,
        companies: [companyASummary, companyBSummary]
    }
}

export function listLegalMergerOptionsForAnnouncer(
    state: HydratedIndonesiaGameState,
    announcerId: string
): LegalMergerOption[] {
    const options: LegalMergerOption[] = []
    for (let leftIndex = 0; leftIndex < state.companies.length; leftIndex += 1) {
        const companyA = state.companies[leftIndex]
        if (!companyA) {
            continue
        }
        for (let rightIndex = leftIndex + 1; rightIndex < state.companies.length; rightIndex += 1) {
            const companyB = state.companies[rightIndex]
            if (!companyB) {
                continue
            }
            const option = evaluateLegalMergerOption(state, announcerId, companyA, companyB)
            if (!option) {
                continue
            }
            options.push(option)
        }
    }

    options.sort((left, right) => {
        if (left.nominalValue !== right.nominalValue) {
            return left.nominalValue - right.nominalValue
        }
        if (left.companyAId !== right.companyAId) {
            return left.companyAId.localeCompare(right.companyAId)
        }
        return left.companyBId.localeCompare(right.companyBId)
    })

    return options
}

export function canAnyPlayerAnnounceMerger(state: HydratedIndonesiaGameState): boolean {
    for (const playerId of state.turnManager.turnOrder) {
        const playerState = state.getPlayerState(playerId)
        if (playerState.research.mergers <= 0) {
            continue
        }
        if (listLegalMergerOptionsForAnnouncer(state, playerId).length > 0) {
            return true
        }
    }

    return false
}

export function mergerAnnouncementOrder(state: HydratedIndonesiaGameState): string[] {
    return state.turnManager.turnOrder.filter((playerId) => {
        const playerState = state.getPlayerState(playerId)
        if (playerState.research.mergers <= 0) {
            return false
        }

        return listLegalMergerOptionsForAnnouncer(state, playerId).length > 0
    })
}

export function buildMergerBidOrder(
    state: HydratedIndonesiaGameState,
    announcerId: string,
    eligibleBidderIds: readonly string[]
): string[] {
    const orderedEligible = new Set(eligibleBidderIds)
    const rawOrder = [
        announcerId,
        ...HydratedAuction.generateBidOrder(state.turnManager.turnOrder, announcerId)
    ]
    const seen = new Set<string>()
    const bidOrder: string[] = []

    for (const playerId of rawOrder) {
        if (!orderedEligible.has(playerId) || seen.has(playerId)) {
            continue
        }
        seen.add(playerId)
        bidOrder.push(playerId)
    }

    return bidOrder
}

export function highestBidderId(auction: HydratedAuction<any>): string | null {
    const highBid = auction.highBid
    if (highBid === undefined) {
        return null
    }

    const participant = auction.participants.find((entry) => entry.bid === highBid)
    if (!participant) {
        return null
    }

    return participant.playerId
}

export function activeAuctionParticipantCount(auction: HydratedAuction<any>): number {
    return auction.participants.filter((participant) => !participant.passed).length
}

export function nextMergerBidderId(
    bidOrder: readonly string[],
    currentBidderId: string,
    auction: HydratedAuction<any>
): string | null {
    if (bidOrder.length === 0) {
        return null
    }

    const currentIndex = bidOrder.indexOf(currentBidderId)
    if (currentIndex < 0) {
        return null
    }

    for (let offset = 1; offset <= bidOrder.length; offset += 1) {
        const bidderId = bidOrder[(currentIndex + offset) % bidOrder.length]
        if (!bidderId) {
            continue
        }
        const participant = auction.participants.find((entry) => entry.playerId === bidderId)
        if (!participant || participant.passed) {
            continue
        }
        return bidderId
    }

    return null
}

export function companyCultivatedAreaIds(
    state: HydratedIndonesiaGameState,
    companyId: string
): string[] {
    const areaIds: string[] = []
    for (const area of Object.values(state.board.areas)) {
        if (!isCultivatedArea(area)) {
            continue
        }
        if (area.companyId !== companyId) {
            continue
        }
        areaIds.push(area.id)
    }
    return areaIds
}

export function isSiapSajiRemovalAreaValid(
    state: HydratedIndonesiaGameState,
    companyId: string,
    areaId: string
): boolean {
    const area = state.board.getArea(areaId)
    if (!isCultivatedArea(area) || area.companyId !== companyId) {
        return false
    }

    const cultivatedAreaIds = companyCultivatedAreaIds(state, companyId)
    if (!cultivatedAreaIds.includes(areaId)) {
        return false
    }

    const cultivatedAreaIdSet = new Set(cultivatedAreaIds)
    const node = state.board.graph.nodeById(areaId)
    if (!node) {
        return false
    }

    const hasExternalLandNeighbor = node.neighbors[IndonesiaNeighborDirection.Land].some(
        (neighborId) => !cultivatedAreaIdSet.has(neighborId)
    )
    const hasSeaNeighbor = node.neighbors[IndonesiaNeighborDirection.Sea].length > 0
    if (!hasExternalLandNeighbor && !hasSeaNeighbor) {
        return false
    }

    return true
}

export function validSiapSajiRemovalAreaIds(
    state: HydratedIndonesiaGameState,
    companyId: string
): string[] {
    return companyCultivatedAreaIds(state, companyId).filter((areaId) =>
        isSiapSajiRemovalAreaValid(state, companyId, areaId)
    )
}
