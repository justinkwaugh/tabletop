import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedLwGameState } from '../model/gameState.js'
import { LocomotiveId, locomotiveData } from '../model/locomotives.js'

// New units for a works, or, with `from`, units upgraded from an older works.
export type CapacityPurchase = Type.Static<typeof CapacityPurchase>
export const CapacityPurchase = Type.Object({
    locomotiveId: Type.Enum(LocomotiveId),
    from: Type.Optional(Type.Enum(LocomotiveId)),
    units: Type.Number()
})

export type CapacityRecord = Type.Static<typeof CapacityRecord>
export const CapacityRecord = Type.Object({
    cost: Type.Number(),
    // The older works had no units left and left play.
    closed: Type.Boolean()
})

export type ExpandCapacityMetadata = Type.Static<typeof ExpandCapacityMetadata>
export const ExpandCapacityMetadata = Type.Object({
    purchases: Type.Array(CapacityRecord),
    cost: Type.Number()
})

// A whole Production Capacity turn: every purchase and upgrade, in order, which may be none.
export type ExpandCapacity = Type.Static<typeof ExpandCapacity>
export const ExpandCapacity = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ExpandCapacity),
            playerId: Type.String(),
            metadata: Type.Optional(ExpandCapacityMetadata),
            purchases: Type.Array(CapacityPurchase),
            // Ships everything the player can in each selling round of this Production phase.
            autoShip: Type.Optional(Type.Boolean())
        })
    ])
)

export const ExpandCapacityValidator = Compile(ExpandCapacity)

export function isExpandCapacity(action?: GameAction): action is ExpandCapacity {
    return action?.type === ActionType.ExpandCapacity
}

export class HydratedExpandCapacity
    extends HydratableAction<typeof ExpandCapacity>
    implements ExpandCapacity
{
    declare type: ActionType.ExpandCapacity
    declare playerId: string
    declare metadata?: ExpandCapacityMetadata
    declare purchases: CapacityPurchase[]
    declare autoShip?: boolean

    constructor(data: ExpandCapacity) {
        super(data, ExpandCapacityValidator)
    }

    apply(state: HydratedLwGameState, _context?: MachineContext) {
        const records = this.purchases.map((purchase) =>
            applyPurchase(state, this.playerId, purchase)
        )
        if (this.autoShip) {
            state.getPlayerState(this.playerId).autoShip = true
        }
        this.metadata = {
            purchases: records,
            cost: records.reduce((sum, record) => sum + record.cost, 0)
        }
    }
}

function applyPurchase(
    state: HydratedLwGameState,
    playerId: string,
    { locomotiveId, from, units }: CapacityPurchase
): CapacityRecord {
    const player = state.getPlayerState(playerId)
    if (from === undefined) {
        assert(
            state.canBuyCapacity(playerId, locomotiveId, units),
            'That capacity cannot be bought'
        )
        const cost = units * locomotiveData(locomotiveId).productionCost
        player.cash -= cost
        player.requirePlant(locomotiveId).units += units
        return { cost, closed: false }
    }
    assert(state.canShift(playerId, from, locomotiveId, units), 'Those units cannot be upgraded')
    const cost = units * state.shiftCost(from, locomotiveId)
    const source = player.requirePlant(from)
    player.cash -= cost
    source.units -= units
    player.requirePlant(locomotiveId).units += units
    const closed = source.units === 0
    player.removeEmptyPlants()
    return { cost, closed }
}
