import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    HydratableAction,
    MachineContext,
    assert,
    assertExists
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedLwGameState } from '../model/gameState.js'
import { LocomotiveId } from '../model/locomotives.js'
import { SaleOutcome, applySale } from '../model/market.js'

export type ShipmentRecord = Type.Static<typeof ShipmentRecord>
export const ShipmentRecord = Type.Object({
    locomotiveId: Type.Enum(LocomotiveId),
    units: Type.Number(),
    income: Type.Number(),
    // The Existing Orders die the shipment was matched against, before the sale.
    face: Type.Number(),
    outcome: Type.Enum(SaleOutcome)
})

export type ShipMetadata = Type.Static<typeof ShipMetadata>
export const ShipMetadata = Type.Object({
    shipments: Type.Array(ShipmentRecord),
    income: Type.Number(),
    sellingRound: Type.Number()
})

// One selling turn: the locomotives the player ships, which may be none.
export type Ship = Type.Static<typeof Ship>
export const Ship = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Ship),
            playerId: Type.String(),
            metadata: Type.Optional(ShipMetadata),
            locomotiveIds: Type.Array(Type.Enum(LocomotiveId))
        })
    ])
)

export const ShipValidator = Compile(Ship)

export function isShip(action?: GameAction): action is Ship {
    return action?.type === ActionType.Ship
}

export class HydratedShip extends HydratableAction<typeof Ship> implements Ship {
    declare type: ActionType.Ship
    declare playerId: string
    declare metadata?: ShipMetadata
    declare locomotiveIds: LocomotiveId[]

    constructor(data: Ship) {
        super(data, ShipValidator)
    }

    apply(state: HydratedLwGameState, _context?: MachineContext) {
        assert(
            new Set(this.locomotiveIds).size === this.locomotiveIds.length,
            'Each locomotive ships once a turn'
        )
        const player = state.getPlayerState(this.playerId)
        const shipments = this.locomotiveIds.map((locomotiveId) => {
            const plant = player.requirePlant(locomotiveId)
            const shipment = state.shipment(plant)
            assertExists(shipment, `There are no orders for ${locomotiveId}`)
            applySale(state.space(locomotiveId), shipment.plan)
            plant.shipped += shipment.plan.units
            player.cash += shipment.income
            return {
                locomotiveId,
                units: shipment.plan.units,
                income: shipment.income,
                face: shipment.plan.face,
                outcome: shipment.plan.outcome
            }
        })
        const round = state.requireSellingRound()
        round.shipped ||= shipments.length > 0
        state.leaveSellingRound(this.playerId)
        this.metadata = {
            shipments,
            income: shipments.reduce((sum, shipment) => sum + shipment.income, 0),
            sellingRound: round.number
        }
    }
}
