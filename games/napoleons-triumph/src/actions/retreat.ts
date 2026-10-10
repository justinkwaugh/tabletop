import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { afterRetreat } from '../model/attackResolution.js'
import { currentAttack } from '../model/attackState.js'
import { mustDefend } from '../model/attackThreat.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { executeRetreat } from '../model/retreat.js'
import { LossEntry } from '../model/attack.js'

export type RetreatMetadata = Type.Static<typeof RetreatMetadata>
export const RetreatMetadata = Type.Object({
    losses: Type.Array(LossEntry),
    fromLocale: Type.Integer(),
    beforeCombat: Type.Boolean(),
    demoralized: Type.Boolean()
})

export type Retreat = Type.Static<typeof Retreat>
export const Retreat = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Retreat),
            playerId: Type.String(),
            metadata: Type.Optional(RetreatMetadata),
            losses: Type.Record(Type.String(), Type.Integer({ minimum: 1 })),
            destinations: Type.Record(Type.String(), Type.Integer()),
            kept: Type.Record(Type.String(), Type.String())
        })
    ])
)

export const RetreatValidator = Compile(Retreat)

export function isRetreat(action?: GameAction): action is Retreat {
    return action?.type === ActionType.Retreat
}

export class HydratedRetreat extends HydratableAction<typeof Retreat> implements Retreat {
    declare type: ActionType.Retreat
    declare playerId: string
    declare metadata?: RetreatMetadata
    declare losses: Record<string, number>
    declare destinations: Record<string, number>
    declare kept: Record<string, string>

    constructor(data: Retreat) {
        super(data, RetreatValidator)
    }

    apply(state: HydratedNapoleonsTriumphGameState) {
        const attack = currentAttack(state)
        const beforeCombat = attack.attackerWon === undefined
        if (beforeCombat) {
            if (mustDefend(state)) {
                throw Error('Pieces blocking the approach must defend it')
            }
            attack.retreatBeforeCombat = true
        }
        const fromLocale = state.map.approach(attack.defenseApproach).locale
        const outcome = executeRetreat(state, {
            losses: this.losses,
            destinations: this.destinations,
            kept: this.kept
        })
        afterRetreat(state, outcome.demoralized)
        this.metadata = {
            losses: outcome.losses,
            fromLocale,
            beforeCombat,
            demoralized: outcome.demoralized
        }
    }
}
