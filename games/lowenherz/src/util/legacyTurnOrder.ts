import { assert } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { LowenherzProjectedState } from '../model/gameState.js'
import { rotateToStart } from './decisionPlan.js'

// Stored before the turn manager owned seating and the first player castle. An undo
// recorded in that format restores firstPlayerId alone onto the current representation.
const LegacyTurnOrderValidator = Compile(
    Type.Object({
        turnOrder: Type.Optional(Type.Array(Type.String())),
        firstPlayerId: Type.Optional(Type.String())
    })
)

export function moveLegacyTurnOrderToTurnManager(
    data: LowenherzProjectedState
): LowenherzProjectedState {
    assert(LegacyTurnOrderValidator.Check(data), 'Invalid stored Lowenherz turn order')
    const { turnOrder: seating, firstPlayerId, ...current } = data
    if (seating === undefined && firstPlayerId === undefined) return data

    const turnOrder = seating ?? data.turnManager.turnOrder
    assert(
        turnOrder.length === data.turnManager.turnOrder.length &&
            turnOrder.every((playerId) => data.turnManager.turnOrder.includes(playerId)),
        'Stored Lowenherz seating does not match its turn manager'
    )
    const first = firstPlayerId ?? turnOrder[0]
    assert(turnOrder.includes(first), 'Stored Lowenherz first player is not seated')

    return {
        ...current,
        turnManager: { ...data.turnManager, turnOrder: rotateToStart(turnOrder, first) }
    }
}
