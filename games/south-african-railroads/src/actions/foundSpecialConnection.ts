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
import { RailroadId } from '../maps/types.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { Payout, payShareholders } from '../model/payouts.js'
import { RailroadDividend } from './payDividends.js'

export type FoundSpecialConnectionMetadata = Type.Static<typeof FoundSpecialConnectionMetadata>
export const FoundSpecialConnectionMetadata = Type.Object({
    cost: Type.Number(),
    rates: Type.Array(RailroadDividend),
    payouts: Type.Array(Payout)
})

export type FoundSpecialConnection = Type.Static<typeof FoundSpecialConnection>
export const FoundSpecialConnection = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.FoundSpecialConnection),
            playerId: Type.String(),
            metadata: Type.Optional(FoundSpecialConnectionMetadata),
            railroadId: Type.Enum(RailroadId),
            partnerId: Type.Enum(RailroadId)
        })
    ])
)

export const FoundSpecialConnectionValidator = Compile(FoundSpecialConnection)

export function isFoundSpecialConnection(action?: GameAction): action is FoundSpecialConnection {
    return action?.type === ActionType.FoundSpecialConnection
}

// The Texas Special: in place of building, the railroad pays from its treasury to join a partner
// whose track meets its own, and both pay their shareholders a special dividend.
export class HydratedFoundSpecialConnection
    extends HydratableAction<typeof FoundSpecialConnection>
    implements FoundSpecialConnection
{
    declare type: ActionType.FoundSpecialConnection
    declare playerId: string
    declare metadata?: FoundSpecialConnectionMetadata
    declare railroadId: RailroadId
    declare partnerId: RailroadId

    constructor(data: FoundSpecialConnection) {
        super(data, FoundSpecialConnectionValidator)
    }

    apply(state: HydratedSarGameState, _context?: MachineContext) {
        const special = state.map.definition.specialConnection
        assertExists(special, 'This map has no special connection')
        assert(
            state.builderRailroads(this.playerId).includes(this.railroadId),
            'You cannot build for this railroad'
        )
        assert(
            state.specialConnectionPartners(this.railroadId).includes(this.partnerId),
            `The ${special.name} cannot be founded between those railroads`
        )
        state.railroad(this.railroadId).treasury -= special.cost
        state.specialConnection = [this.railroadId, this.partnerId]
        state.delegation = undefined
        const rates = [this.railroadId, this.partnerId].map((railroadId) => ({
            railroadId,
            perShare: state.specialDividendPerShare(railroadId)
        }))
        this.metadata = { cost: special.cost, rates, payouts: payShareholders(state, rates) }
    }

    static canFound(state: HydratedSarGameState, playerId: string): boolean {
        return (
            state.freeBuild === undefined &&
            state
                .builderRailroads(playerId)
                .some((railroadId) => state.specialConnectionPartners(railroadId).length > 0)
        )
    }
}
