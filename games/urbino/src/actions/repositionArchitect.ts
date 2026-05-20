import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedUrbinoGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { hasAnyValidPlacement, isValidRepositionTarget } from '../logic/board.js'

export type RepositionArchitectMetadata = Type.Static<typeof RepositionArchitectMetadata>
export const RepositionArchitectMetadata = Type.Object({})

export type RepositionArchitect = Type.Static<typeof RepositionArchitect>
export const RepositionArchitect = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RepositionArchitect),
            playerId: Type.String(),
            architectIndex: Type.Number(), // 0 or 1
            position: Type.Number(),       // target square (0-80)
            metadata: Type.Optional(RepositionArchitectMetadata),
        })
    ])
)

export const RepositionArchitectValidator = Compile(RepositionArchitect)

export function isRepositionArchitect(action?: GameAction): action is RepositionArchitect {
    return action?.type === ActionType.RepositionArchitect
}

export class HydratedRepositionArchitect
    extends HydratableAction<typeof RepositionArchitect>
    implements RepositionArchitect
{
    declare type: ActionType.RepositionArchitect
    declare playerId: string
    declare architectIndex: number
    declare position: number
    declare metadata?: RepositionArchitectMetadata

    constructor(data: RepositionArchitect) {
        super(data, RepositionArchitectValidator)
    }

    apply(state: HydratedUrbinoGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid RepositionArchitect action')
        }
        state.architects[this.architectIndex] = this.position
        state.hasRepositionedThisTurn = true
        this.metadata = {}
    }

    isValid(state: HydratedUrbinoGameState): boolean {
        if (state.hasRepositionedThisTurn) return false
        if (this.architectIndex !== 0 && this.architectIndex !== 1) return false
        if (!isValidRepositionTarget(state.board, state.architects, this.architectIndex, this.position)) return false
        const player = state.players.find((p) => p.playerId === this.playerId)
        if (!player) return false
        const newArchitects = [...state.architects]
        newArchitects[this.architectIndex] = this.position
        return hasAnyValidPlacement(state.board, newArchitects, this.playerId, player.remainingBuildings, state.monumentsVariant)
    }

    static canReposition(state: HydratedUrbinoGameState): boolean {
        return !state.hasRepositionedThisTurn
    }
}
