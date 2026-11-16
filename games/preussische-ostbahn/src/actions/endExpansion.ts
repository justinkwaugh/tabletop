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
import { RailroadId } from '../components/railroads.js'
import type { HydratedOstbahnGameState } from '../model/gameState.js'
import { directConnections } from '../model/network.js'

export type ExpansionResult = Type.Static<typeof ExpansionResult>
export const ExpansionResult = Type.Object({
    railroadId: Type.Enum(RailroadId),
    built: Type.Array(Type.String()),
    spent: Type.Number(),
    incomeAfter: Type.Number(),
    newConnections: Type.Array(Type.Enum(RailroadId))
})

export type EndExpansion = Type.Static<typeof EndExpansion>
export const EndExpansion = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EndExpansion),
            playerId: Type.String(),
            metadata: Type.Optional(ExpansionResult)
        })
    ])
)

export const EndExpansionValidator = Compile(EndExpansion)

export function isEndExpansion(action?: GameAction): action is EndExpansion {
    return action?.type === ActionType.EndExpansion
}

export type CompleteExpansion = Type.Static<typeof CompleteExpansion>
export const CompleteExpansion = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.CompleteExpansion),
            metadata: Type.Optional(ExpansionResult)
        })
    ])
)

export const CompleteExpansionValidator = Compile(CompleteExpansion)

export function isCompleteExpansion(action?: GameAction): action is CompleteExpansion {
    return action?.type === ActionType.CompleteExpansion
}

function finishExpansion(state: HydratedOstbahnGameState): ExpansionResult {
    const expansion = state.expansion
    assertExists(expansion, 'No Expansion in progress')
    const newConnections = directConnections(state.railroads, expansion.railroadId).filter(
        (id) => !expansion.connectedBefore.includes(id)
    )
    if (newConnections.length > 0) {
        state.dividendRailroadId = expansion.railroadId
    }
    state.expansion = undefined
    return {
        railroadId: expansion.railroadId,
        built: expansion.built,
        spent: expansion.spent,
        incomeAfter: state.income(expansion.railroadId),
        newConnections
    }
}

export class HydratedEndExpansion
    extends HydratableAction<typeof EndExpansion>
    implements EndExpansion
{
    declare type: ActionType.EndExpansion
    declare playerId: string
    declare metadata?: ExpansionResult

    constructor(data: EndExpansion) {
        super(data, EndExpansionValidator)
    }

    apply(state: HydratedOstbahnGameState, _context?: MachineContext) {
        assert(state.isExpanding(this.playerId), 'It is not your Expansion')
        this.metadata = finishExpansion(state)
    }

    static canEnd(state: HydratedOstbahnGameState, playerId: string): boolean {
        return state.isExpanding(playerId)
    }
}

export class HydratedCompleteExpansion
    extends HydratableAction<typeof CompleteExpansion>
    implements CompleteExpansion
{
    declare type: ActionType.CompleteExpansion
    declare metadata?: ExpansionResult

    constructor(data: CompleteExpansion) {
        super(data, CompleteExpansionValidator)
    }

    apply(state: HydratedOstbahnGameState, _context?: MachineContext) {
        this.metadata = finishExpansion(state)
    }
}
