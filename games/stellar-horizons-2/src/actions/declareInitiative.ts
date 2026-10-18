import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { maxInitiativeBid } from '../model/economy.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type DeclareInitiative = Type.Static<typeof DeclareInitiative>
export const DeclareInitiative = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclareInitiative),
            playerId: Type.String(),
            influence: Type.Number()
        })
    ])
)

export const DeclareInitiativeValidator = Compile(DeclareInitiative)

export function isDeclareInitiative(action?: GameAction): action is DeclareInitiative {
    return action?.type === ActionType.DeclareInitiative
}

// Rulebook 4.1: each Player declares the IP they will spend on their roll before anyone rolls.
export class HydratedDeclareInitiative
    extends HydratableAction<typeof DeclareInitiative>
    implements DeclareInitiative
{
    declare type: ActionType.DeclareInitiative
    declare playerId: string
    declare influence: number

    constructor(data: DeclareInitiative) {
        super(data, DeclareInitiativeValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        if (
            !Number.isInteger(this.influence) ||
            this.influence < 0 ||
            this.influence > maxInitiativeBid(state, this.playerId) ||
            player.initiativeBid !== undefined
        ) {
            throw Error('Invalid DeclareInitiative action')
        }
        player.influence -= this.influence
        player.initiativeBid = this.influence
    }
}
