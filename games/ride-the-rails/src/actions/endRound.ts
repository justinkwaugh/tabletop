import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { RailroadId } from '../data/railroads.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { currentRoundNumber, isLastRound, turnOrderByMoney } from '../rules/endOfRound.js'
import { PlayerMoney, moneyOf } from '../rules/scoring.js'
import { availableRailroads } from '../rules/supply.js'

export type EndRoundMetadata = Type.Static<typeof EndRoundMetadata>
export const EndRoundMetadata = Type.Object({
    round: Type.Integer({ minimum: 1 }),
    turnOrder: Type.Array(Type.String()),
    money: Type.Array(PlayerMoney),
    railroadId: Type.Optional(RailroadId)
})

export type EndRound = Type.Static<typeof EndRound>
export const EndRound = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.EndRound),
            metadata: Type.Optional(EndRoundMetadata)
        })
    ])
)

export const EndRoundValidator = Compile(EndRound)

export function isEndRound(action?: GameAction): action is EndRound {
    return action?.type === ActionType.EndRound
}

export class HydratedEndRound extends HydratableAction<typeof EndRound> implements EndRound {
    declare type: ActionType.EndRound
    declare metadata?: EndRoundMetadata

    constructor(data: EndRound) {
        super(data, EndRoundValidator)
    }

    // R-2.5
    apply(state: HydratedRideTheRailsGameState, _context?: MachineContext) {
        assert(HydratedEndRound.canEndRound(state), 'Round 6 ends the game instead (R-6.1)')
        const round = currentRoundNumber(state)
        const availableBefore = availableRailroads(state)

        const turnOrder = turnOrderByMoney(state)
        state.turnManager.turnOrder = turnOrder

        state.roundManager.endRound(state.actionCount)
        state.roundManager.startRound(state.actionCount + 1)

        const railroadId = availableRailroads(state).find((id) => !availableBefore.includes(id))
        this.metadata = {
            round,
            turnOrder,
            money: moneyOf(state, turnOrder),
            ...(railroadId ? { railroadId } : {})
        }
    }

    // R-2.5, R-6.1
    static canEndRound(state: HydratedRideTheRailsGameState): boolean {
        return !isLastRound(state)
    }
}
