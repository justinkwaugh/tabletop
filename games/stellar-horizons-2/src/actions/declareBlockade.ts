import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { BlockadeResult, canBlockade, declareBlockade } from '../model/blockades.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type DeclareBlockade = Type.Static<typeof DeclareBlockade>
export const DeclareBlockade = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclareBlockade),
            playerId: Type.String(),
            systemId: Type.String(),
            targetIds: Type.Array(Type.String()),
            metadata: Type.Optional(BlockadeResult)
        })
    ])
)

export const DeclareBlockadeValidator = Compile(DeclareBlockade)

export function isDeclareBlockade(action?: GameAction): action is DeclareBlockade {
    return action?.type === ActionType.DeclareBlockade
}

// Rulebook 4.4 and 4.6: the Player's ships in the system must have more combat value than the
// named Players' ships and settlements there, all together.
export class HydratedDeclareBlockade
    extends HydratableAction<typeof DeclareBlockade>
    implements DeclareBlockade
{
    declare type: ActionType.DeclareBlockade
    declare playerId: string
    declare systemId: string
    declare targetIds: string[]
    declare metadata?: BlockadeResult

    constructor(data: DeclareBlockade) {
        super(data, DeclareBlockadeValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (
            state.remainingBlockaders.at(0) !== this.playerId ||
            state.escalationDiscard !== undefined ||
            !canBlockade(state, this.playerId, this.systemId, this.targetIds)
        ) {
            throw Error('Invalid DeclareBlockade action')
        }
        this.metadata = declareBlockade(state, this.playerId, this.systemId, this.targetIds)
        this.revealsInfo = true
    }
}
