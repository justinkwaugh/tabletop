import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, Visibility, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphAction } from './gameAction.js'
import { declareDefense } from '../model/attackThreat.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export type DeclareDefense = Type.Static<typeof DeclareDefense>
export const DeclareDefense = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclareDefense),
            playerId: Type.String(),
            unitIds: Type.Array(Type.String(), { minItems: 1 }),
            /** Rule 11, step 4: kept from the attacker until the attack is pressed. */
            leaderIds: Visibility.protect(Type.Array(Type.String(), { maxItems: 2 }), {
                policy: Visibility.Policy.Actor
            })
        })
    ])
)

export const DeclareDefenseValidator = Compile(DeclareDefense)

export function isDeclareDefense(action?: GameAction): action is DeclareDefense {
    return action?.type === ActionType.DeclareDefense
}

export class HydratedDeclareDefense
    extends NapoleonsTriumphAction<typeof DeclareDefense>
    implements DeclareDefense
{
    declare type: ActionType.DeclareDefense
    declare playerId: string
    declare unitIds: string[]
    declare leaderIds: string[]

    constructor(data: DeclareDefense) {
        super(data, DeclareDefenseValidator)
    }

    protected perform(state: HydratedNapoleonsTriumphGameState) {
        assertExists(this.leaderIds, 'The defense leading units are not known here')
        declareDefense(state, this.unitIds, this.leaderIds)
    }
}
