import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphAction } from './gameAction.js'
import { counterAttack, counterAttackAccountWith } from '../model/attackResolution.js'
import { currentAttack } from '../model/attackState.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { CombatMetadata, combatMetadata } from './lossRecord.js'

export type CounterAttack = Type.Static<typeof CounterAttack>
export const CounterAttack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CounterAttack),
            playerId: Type.String(),
            metadata: Type.Optional(CombatMetadata),
            unitIds: Type.Array(Type.String(), { maxItems: 2 })
        })
    ])
)

export const CounterAttackValidator = Compile(CounterAttack)

export function isCounterAttack(action?: GameAction): action is CounterAttack {
    return action?.type === ActionType.CounterAttack
}

export class HydratedCounterAttack
    extends NapoleonsTriumphAction<typeof CounterAttack>
    implements CounterAttack
{
    declare type: ActionType.CounterAttack
    declare playerId: string
    declare metadata?: CombatMetadata
    declare unitIds: string[]

    constructor(data: CounterAttack) {
        super(data, CounterAttackValidator)
    }

    protected perform(state: HydratedNapoleonsTriumphGameState) {
        const { initialResult } = currentAttack(state)
        const account = counterAttackAccountWith(
            this.unitIds.flatMap((id) => state.findUnit(id) ?? [])
        )
        this.metadata = combatMetadata(counterAttack(state, this.unitIds), initialResult, account)
    }
}
