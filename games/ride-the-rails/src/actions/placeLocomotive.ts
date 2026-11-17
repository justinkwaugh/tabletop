import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HexId } from '../data/hexes.js'
import { lowersLimit } from '../data/placementLimits.js'
import { RailroadId } from '../data/railroads.js'
import { CityId } from '../data/boardMap.js'
import { boardMap, isLongDistance } from '../data/boardMaps.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { claimOf, placementBonuses, type BonusPayment } from '../rules/bonuses.js'
import { isBuildingTurnOf, recordPlacement } from '../rules/buildingTurn.js'
import {
    hasLegalPlacement,
    placementTest,
    type LegalPlacement,
    type PlacementRefusal
} from '../rules/placement.js'
import { railroadsIn } from '../rules/track.js'

export type PlaceLocomotiveRefusal = 'not-building-turn' | 'off-map' | PlacementRefusal

export type PlaceLocomotiveVerdict =
    { legal: true; isStart: boolean } | { legal: false; reason: PlaceLocomotiveRefusal }

// R-3.2.5, R-4.3: one bonus the placement paid to its player.
export type PaidBonus = Type.Static<typeof PaidBonus>
export const PaidBonus = Type.Object({
    bonusId: Type.String(),
    amount: Type.Integer({ minimum: 1 }),
    cityId: Type.Optional(CityId)
})

export type PlaceLocomotiveMetadata = Type.Static<typeof PlaceLocomotiveMetadata>
export const PlaceLocomotiveMetadata = Type.Object({
    isStart: Type.Boolean(),
    bonuses: Type.Array(PaidBonus)
})

export type PlaceLocomotive = Type.Static<typeof PlaceLocomotive>
export const PlaceLocomotive = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceLocomotive),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceLocomotiveMetadata),
            railroadId: RailroadId,
            hexId: HexId
        })
    ])
)

export const PlaceLocomotiveValidator = Compile(PlaceLocomotive)

export function isPlaceLocomotive(action?: GameAction): action is PlaceLocomotive {
    return action?.type === ActionType.PlaceLocomotive
}

export class HydratedPlaceLocomotive
    extends HydratableAction<typeof PlaceLocomotive>
    implements PlaceLocomotive
{
    declare type: ActionType.PlaceLocomotive
    declare playerId: string
    declare metadata?: PlaceLocomotiveMetadata
    declare railroadId: RailroadId
    declare hexId: HexId

    constructor(data: PlaceLocomotive) {
        super(data, PlaceLocomotiveValidator)
    }

    // R-3.2.1, R-3.2.2, R-4.1, R-4.2: the placement test, inside the player's building turn.
    verdict(state: HydratedRideTheRailsGameState): PlaceLocomotiveVerdict {
        if (!isBuildingTurnOf(state, this.playerId)) {
            return { legal: false, reason: 'not-building-turn' }
        }
        if (!boardMap(state.mapId).hasHex(this.hexId)) {
            return { legal: false, reason: 'off-map' }
        }
        return placementTest(state, this.playerId, this.railroadId, this.hexId)
    }

    // R-3.2, R-4.1, R-4.2, R-4.3: the locomotive goes on the map and its bonuses are paid now.
    apply(state: HydratedRideTheRailsGameState, _context?: MachineContext) {
        const verdict = this.verdict(state)
        if (!verdict.legal) {
            throw new Error(
                `${this.railroadId} cannot be placed in ${this.hexId}: ${verdict.reason}`
            )
        }
        const placement: LegalPlacement = {
            railroadId: this.railroadId,
            hexId: this.hexId,
            isStart: verdict.isStart
        }
        const bonuses = placementBonuses(
            state.mapId,
            placement,
            state.track,
            state.transcontinental,
            state.connectionClaim
        )
        state.track[this.hexId] = [...railroadsIn(state.track, this.hexId), this.railroadId]
        this.countPlacement(state)
        this.payBonuses(state, bonuses)

        this.metadata = { isStart: placement.isStart, bonuses }
    }

    // R-3.2.3, R-3.2.4, R-8
    private countPlacement(state: HydratedRideTheRailsGameState) {
        assertExists(state.building, 'A placement needs a building turn')
        state.building = recordPlacement(state.building, {
            chargesMountain: lowersLimit(state.mapId, this.railroadId, this.hexId),
            longDistance: isLongDistance(this.hexId)
        })
    }

    // R-3.2.5, R-4.3.3, R-8: every bonus to the placing player; the Transcontinental and a
    // connection bonus are claimed once.
    private payBonuses(state: HydratedRideTheRailsGameState, bonuses: readonly BonusPayment[]) {
        const player = state.getPlayerState(this.playerId)
        for (const bonus of bonuses) {
            player.money += bonus.amount
            switch (claimOf(state.mapId, bonus)) {
                case 'transcontinental':
                    state.transcontinental = { playerId: this.playerId, amount: bonus.amount }
                    break
                case 'connection':
                    state.connectionClaim = { playerId: this.playerId }
                    break
                case undefined:
                    break
            }
        }
    }

    static canPlace(state: HydratedRideTheRailsGameState, playerId: string): boolean {
        return isBuildingTurnOf(state, playerId) && hasLegalPlacement(state, playerId)
    }
}
