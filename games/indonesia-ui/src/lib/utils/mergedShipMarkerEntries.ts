import type { GameAction } from '@tabletop/common'
import { Color } from '@tabletop/common'
import {
    CompanyType,
    isIndonesiaNodeId,
    isMergeCompanies,
    type HydratedIndonesiaGameState,
    type IndonesiaNodeId
} from '@tabletop/indonesia'
import { shadeHexColor } from '$lib/utils/color.js'
import { markerPointsForSeaAreaShipList } from '$lib/utils/shipMarkers.js'
import { shipSlotKey } from '$lib/utils/shipSlotKey.js'
import { shippingStyleByCompanyId, type ShippingStyle } from '$lib/utils/shippingStyles.js'

export type MergedShipMarkerEntry = {
    key: string
    animationKey: string
    baseShipKey?: string
    areaId: string
    companyId: string
    x: number
    y: number
    style: ShippingStyle
    ownerColor: string
    ownerStrokeColor: string
    remainingCapacity?: number
    capacityBadgeTextColor: string
    animationRole: 'exit' | 'pop'
}

const SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_YELLOW = 0.16
const SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_BLUE = 0.12

function shipCapacityPresentation(args: {
    gameState: HydratedIndonesiaGameState
    companyId: string
    ownerId: string
    seaAreaId: IndonesiaNodeId
    companyShipOrdinal: number
    ownerColor: string
    ownerPlayerColor: Color
}): {
    remainingCapacity?: number
    capacityBadgeTextColor: string
    ownerStrokeColor: string
} {
    const { gameState, companyId, ownerId, seaAreaId, companyShipOrdinal, ownerColor, ownerPlayerColor } =
        args
    const ownerHullLevel = gameState.getPlayerState(ownerId).research.hull
    const capacityPerShip = 1 + ownerHullLevel
    const usedCapacity = gameState.operatingCompanyShipUseCount(companyId, seaAreaId)

    return {
        remainingCapacity: Math.max(
            0,
            Math.min(capacityPerShip, (companyShipOrdinal + 1) * capacityPerShip - usedCapacity)
        ),
        capacityBadgeTextColor: ownerPlayerColor === Color.Yellow ? '#111827' : '#f8fafc',
        ownerStrokeColor:
            ownerPlayerColor === Color.Yellow
                ? shadeHexColor(ownerColor, SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_YELLOW)
                : ownerPlayerColor === Color.Blue
                  ? shadeHexColor(ownerColor, SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_BLUE)
                  : 'none'
    }
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
    if (left.length !== right.length) {
        return false
    }

    const leftSorted = [...left].sort()
    const rightSorted = [...right].sort()
    return leftSorted.every((value, index) => value === rightSorted[index])
}

function mergedShippingCompanyForAction(args: {
    from: HydratedIndonesiaGameState
    to: HydratedIndonesiaGameState
    action: GameAction
}): Extract<(typeof args.to.companies)[number], { type: CompanyType.Shipping }> | null {
    const { from, to, action } = args
    if (!isMergeCompanies(action) || action.metadata?.proposal.companyType !== CompanyType.Shipping) {
        return null
    }

    const companyA = from.companies.find((company) => company.id === action.metadata?.proposal.companyAId)
    const companyB = from.companies.find((company) => company.id === action.metadata?.proposal.companyBId)
    if (!companyA || !companyB || companyA.type !== CompanyType.Shipping || companyB.type !== CompanyType.Shipping) {
        return null
    }

    const expectedDeedIds = [...companyA.deeds, ...companyB.deeds].map((deed) => deed.id)
    const fromCompanyIdSet = new Set(from.companies.map((company) => company.id))
    const winnerId = action.metadata?.auctionResult.winnerId

    return (
        to.companies.find(
            (
                company
            ): company is Extract<(typeof args.to.companies)[number], { type: CompanyType.Shipping }> =>
                company.type === CompanyType.Shipping &&
                !fromCompanyIdSet.has(company.id) &&
                company.owner === winnerId &&
                sameStringSet(
                    company.deeds.map((deed) => deed.id),
                    expectedDeedIds
                )
        ) ?? null
    )
}

export function mergedShipMarkerEntriesForAction(args: {
    from: HydratedIndonesiaGameState
    to: HydratedIndonesiaGameState
    action: GameAction
    ownerColorForPlayerId: (playerId: string) => string
    ownerPlayerColorForPlayerId: (playerId: string) => Color
}): MergedShipMarkerEntry[] {
    const { from, to, action, ownerColorForPlayerId, ownerPlayerColorForPlayerId } = args
    if (!isMergeCompanies(action) || action.metadata?.proposal.companyType !== CompanyType.Shipping) {
        return []
    }

    const mergedCompany = mergedShippingCompanyForAction({ from, to, action })
    if (!mergedCompany) {
        return []
    }

    const oldCompanyIds = new Set([
        action.metadata.proposal.companyAId,
        action.metadata.proposal.companyBId
    ])
    const fromCompanyById = new Map(from.companies.map((company) => [company.id, company]))
    const oldStyleByCompanyId = shippingStyleByCompanyId(from)
    const newStyleByCompanyId = shippingStyleByCompanyId(to)
    const mergedOwnerColor = ownerColorForPlayerId(mergedCompany.owner)
    const mergedOwnerPlayerColor = ownerPlayerColorForPlayerId(mergedCompany.owner)
    const entries: MergedShipMarkerEntry[] = []

    for (const area of Object.values(from.board.areas)) {
        if (!('ships' in area) || area.ships.length === 0) {
            continue
        }

        const toArea = to.board.getArea(area.id)
        if (!('ships' in toArea) || toArea.ships.length !== area.ships.length) {
            continue
        }

        const oldPoints = markerPointsForSeaAreaShipList(area.id, area.ships)
        const newPoints = markerPointsForSeaAreaShipList(toArea.id, toArea.ships)
        const markerCount = Math.min(area.ships.length, toArea.ships.length, oldPoints.length, newPoints.length)
        const oldOrdinalByCompanyId = new Map<string, number>()
        const newOrdinalByCompanyId = new Map<string, number>()

        for (let markerIndex = 0; markerIndex < markerCount; markerIndex += 1) {
            const oldCompanyId = area.ships[markerIndex]
            const newCompanyId = toArea.ships[markerIndex]
            const oldCompanyOrdinal = oldOrdinalByCompanyId.get(oldCompanyId) ?? 0
            oldOrdinalByCompanyId.set(oldCompanyId, oldCompanyOrdinal + 1)
            const newCompanyOrdinal = newOrdinalByCompanyId.get(newCompanyId) ?? 0
            newOrdinalByCompanyId.set(newCompanyId, newCompanyOrdinal + 1)

            if (oldCompanyId === newCompanyId || !oldCompanyIds.has(oldCompanyId) || newCompanyId !== mergedCompany.id) {
                continue
            }

            const oldCompany = fromCompanyById.get(oldCompanyId)
            const oldPoint = oldPoints[markerIndex]
            const newPoint = newPoints[markerIndex]
            if (!oldCompany || !oldPoint || !newPoint) {
                continue
            }

            const oldOwnerColor = ownerColorForPlayerId(oldCompany.owner)
            const oldOwnerPlayerColor = ownerPlayerColorForPlayerId(oldCompany.owner)
            const oldCapacityPresentation =
                oldCompany.type === CompanyType.Shipping && isIndonesiaNodeId(area.id)
                    ? shipCapacityPresentation({
                          gameState: from,
                          companyId: oldCompany.id,
                          ownerId: oldCompany.owner,
                          seaAreaId: area.id as IndonesiaNodeId,
                          companyShipOrdinal: oldCompanyOrdinal,
                          ownerColor: oldOwnerColor,
                          ownerPlayerColor: oldOwnerPlayerColor
                      })
                    : {
                          remainingCapacity: undefined,
                          capacityBadgeTextColor:
                              oldOwnerPlayerColor === Color.Yellow ? '#111827' : '#f8fafc',
                          ownerStrokeColor:
                              oldOwnerPlayerColor === Color.Yellow
                                  ? shadeHexColor(
                                        oldOwnerColor,
                                        SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_YELLOW
                                    )
                                  : oldOwnerPlayerColor === Color.Blue
                                    ? shadeHexColor(
                                          oldOwnerColor,
                                          SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_BLUE
                                      )
                                    : 'none'
                      }
            const mergedCapacityPresentation =
                isIndonesiaNodeId(toArea.id)
                    ? shipCapacityPresentation({
                          gameState: to,
                          companyId: mergedCompany.id,
                          ownerId: mergedCompany.owner,
                          seaAreaId: toArea.id as IndonesiaNodeId,
                          companyShipOrdinal: newCompanyOrdinal,
                          ownerColor: mergedOwnerColor,
                          ownerPlayerColor: mergedOwnerPlayerColor
                      })
                    : {
                          remainingCapacity: undefined,
                          capacityBadgeTextColor:
                              mergedOwnerPlayerColor === Color.Yellow ? '#111827' : '#f8fafc',
                          ownerStrokeColor:
                              mergedOwnerPlayerColor === Color.Yellow
                                  ? shadeHexColor(
                                        mergedOwnerColor,
                                        SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_YELLOW
                                    )
                                  : mergedOwnerPlayerColor === Color.Blue
                                    ? shadeHexColor(
                                          mergedOwnerColor,
                                          SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_BLUE
                                      )
                                    : 'none'
                      }
            const baseShipKey = shipSlotKey(area.id, markerIndex)

            entries.push({
                key: `merged-ship-exit-${action.id}-${area.id}-${markerIndex}`,
                animationKey: `merged-ship-exit-${action.id}-${area.id}-${markerIndex}`,
                baseShipKey,
                areaId: area.id,
                companyId: oldCompany.id,
                x: oldPoint.x,
                y: oldPoint.y,
                style: oldStyleByCompanyId.get(oldCompany.id) ?? 'a',
                ownerColor: oldOwnerColor,
                ownerStrokeColor: oldCapacityPresentation.ownerStrokeColor,
                remainingCapacity: oldCapacityPresentation.remainingCapacity,
                capacityBadgeTextColor: oldCapacityPresentation.capacityBadgeTextColor,
                animationRole: 'exit'
            })

            entries.push({
                key: `merged-ship-pop-${action.id}-${area.id}-${markerIndex}`,
                animationKey: `merged-ship-pop-${action.id}-${area.id}-${markerIndex}`,
                areaId: toArea.id,
                companyId: mergedCompany.id,
                x: newPoint.x,
                y: newPoint.y,
                style: newStyleByCompanyId.get(mergedCompany.id) ?? mergedCompany.shipStyle ?? 'a',
                ownerColor: mergedOwnerColor,
                ownerStrokeColor: mergedCapacityPresentation.ownerStrokeColor,
                remainingCapacity: mergedCapacityPresentation.remainingCapacity,
                capacityBadgeTextColor: mergedCapacityPresentation.capacityBadgeTextColor,
                animationRole: 'pop'
            })
        }
    }

    return entries
}
