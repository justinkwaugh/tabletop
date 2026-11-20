import { assertExists } from '@tabletop/common'
import {
    BONUSES,
    PLACEMENT_LIMITS,
    boardMap,
    legalPlacements,
    placementBonuses,
    supplyOf,
    lowersLimit,
    type BonusId,
    type BonusPayment,
    type HexId,
    type HydratedRideTheRailsGameState,
    type LegalPlacement,
    type MapId,
    type RailroadId
} from '@tabletop/ride-the-rails'

export type OfferedPlacement = {
    railroadId: RailroadId
    isStart: boolean
    bonuses: BonusPayment[]
    /**
     * R-3.2.4, R-8: how far this placement lowers the turn's limit: the map's mountain cost for the
     * turn's first mountain a railroad pays it for, else none (0).
     */
    limitChange: number
}

export type BonusMark = { kind: 'bonus'; bonusId: BonusId; amount: number }

export type PlacementLimitMark = { kind: 'placement-limit'; change: number }

export type OfferMark = BonusMark | PlacementLimitMark

export type OfferedHex = {
    hexId: HexId
    placements: OfferedPlacement[]
    marks: OfferMark[]
    startOnly: boolean
}

export type RailroadChip = OfferedPlacement & {
    supplyLeft: number
}

export type BuildPopup = {
    hexId: HexId
    chips: RailroadChip[]
}

export type BoardOffer = {
    lit: OfferedHex[]
    scrim: { holes: HexId[] } | undefined
    popup: BuildPopup | undefined
}

export const EMPTY_BOARD_OFFER: BoardOffer = { lit: [], scrim: undefined, popup: undefined }

// R-3.2, R-4.1, R-4.2: every hex where the player may place now, with the railroads that may go
// there in R-1.4 order, in map order; R-4.3, R-3.2.4: each placement's bonuses and the marks.
export function placementOffer(
    state: HydratedRideTheRailsGameState,
    playerId: string
): OfferedHex[] {
    const byHex = new Map<HexId, LegalPlacement[]>()
    for (const placement of legalPlacements(state, playerId)) {
        byHex.set(placement.hexId, [...(byHex.get(placement.hexId) ?? []), placement])
    }
    return boardMap(state.mapId).hexes.flatMap((hex): OfferedHex[] => {
        const legal = byHex.get(hex.id)
        if (!legal) {
            return []
        }
        const placements = legal.map((placement) => offeredPlacement(state, placement))
        return [
            {
                hexId: hex.id,
                placements,
                marks: marksOf(state, hex.id, placements),
                startOnly: placements.every((placement) => placement.isStart)
            }
        ]
    })
}

// A hex opens the build stage only when more than one railroad may go there (U-2).
export function hexNeedingRailroadChoice(
    offered: readonly OfferedHex[],
    hexId: HexId | undefined
): OfferedHex | undefined {
    const hex = offered.find((candidate) => candidate.hexId === hexId)
    return hex && hex.placements.length > 1 ? hex : undefined
}

export function boardOffer(
    state: HydratedRideTheRailsGameState,
    offered: OfferedHex[],
    buildHexId: HexId | undefined
): BoardOffer {
    if (offered.length === 0) {
        return EMPTY_BOARD_OFFER
    }
    const picked = hexNeedingRailroadChoice(offered, buildHexId)
    return {
        lit: offered,
        scrim: { holes: offered.map((hex) => hex.hexId) },
        popup: picked
            ? {
                  hexId: picked.hexId,
                  chips: picked.placements.map((placement) => ({
                      ...placement,
                      supplyLeft: supplyOf(state, placement.railroadId)
                  }))
              }
            : undefined
    }
}

// R-4.3, R-3.2.5: what the engine would pay, read from the same bonus table.
function offeredPlacement(
    state: HydratedRideTheRailsGameState,
    placement: LegalPlacement
): OfferedPlacement {
    const bonuses = placementBonuses(
        state.mapId,
        placement,
        state.track,
        state.transcontinental,
        state.connectionClaim
    )
    return {
        railroadId: placement.railroadId,
        isStart: placement.isStart,
        bonuses,
        limitChange: limitChange(state, placement)
    }
}

// R-3.2.4, R-8: the turn's first mountain placement lowers the limit by the map's cost, unless the
// railroad is exempt (Orange on Germany); the engine reads the same table.
function limitChange(state: HydratedRideTheRailsGameState, placement: LegalPlacement): number {
    assertExists(state.building, 'The placement offer belongs to a building turn')
    const charged =
        !state.building.usedMountain &&
        lowersLimit(state.mapId, placement.railroadId, placement.hexId)
    return charged ? -PLACEMENT_LIMITS[state.mapId].mountainReduction : 0
}

function marksOf(
    state: HydratedRideTheRailsGameState,
    hexId: HexId,
    placements: readonly OfferedPlacement[]
): OfferMark[] {
    const limitMark = placementLimitMark(placements)
    return [...bonusMarks(state.mapId, placements), ...(limitMark ? [limitMark] : [])]
}

// One mark per bonus and amount any railroad's placement there pays, in bonus table order.
function bonusMarks(mapId: MapId, placements: readonly OfferedPlacement[]): BonusMark[] {
    const tableOrder = BONUSES[mapId].map((bonus) => bonus.id)
    const marks = new Map<string, BonusMark>()
    for (const { bonusId, amount } of placements.flatMap((placement) => placement.bonuses)) {
        marks.set(`${bonusId}:${amount}`, { kind: 'bonus', bonusId, amount })
    }
    return [...marks.values()].sort(
        (a, b) => tableOrder.indexOf(a.bonusId) - tableOrder.indexOf(b.bonusId)
    )
}

// R-3.2.4, R-8: the hex's mark when some railroad's placement there lowers the limit; none when
// every placement there leaves it as it is.
function placementLimitMark(
    placements: readonly OfferedPlacement[]
): PlacementLimitMark | undefined {
    const change = Math.min(0, ...placements.map((placement) => placement.limitChange))
    return change < 0 ? { kind: 'placement-limit', change } : undefined
}
