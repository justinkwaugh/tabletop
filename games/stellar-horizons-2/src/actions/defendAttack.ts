import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { DeclaredAttack, answerAttack, isValidAnswer } from '../model/attacks.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type DefendAttack = Type.Static<typeof DefendAttack>
export const DefendAttack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DefendAttack),
            playerId: Type.String(),
            // A fleet combat's defender may add their base; an assault's or a ground combat's
            // their CVs in the system (rulebook 1.3).
            includeBase: Type.Boolean(),
            shipIds: Type.Array(Type.String()),
            metadata: Type.Optional(DeclaredAttack)
        })
    ])
)

export const DefendAttackValidator = Compile(DefendAttack)

export function isDefendAttack(action?: GameAction): action is DefendAttack {
    return action?.type === ActionType.DefendAttack
}

export class HydratedDefendAttack
    extends HydratableAction<typeof DefendAttack>
    implements DefendAttack
{
    declare type: ActionType.DefendAttack
    declare playerId: string
    declare includeBase: boolean
    declare shipIds: string[]
    declare metadata?: DeclaredAttack

    constructor(data: DefendAttack) {
        super(data, DefendAttackValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (
            state.combat?.defenderId !== this.playerId ||
            !isValidAnswer(state, this.includeBase, this.shipIds)
        ) {
            throw Error('Invalid DefendAttack action')
        }
        this.metadata = answerAttack(state, this.includeBase, this.shipIds)
        this.revealsInfo = true
    }
}
