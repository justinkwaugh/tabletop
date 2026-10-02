import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { controllingOwner } from '../finance/finance.js'
import {
    finishOperatingTurnReason,
    type OperatingTurnState
} from '../operating/finishOperatingTurn.js'
import type { TrainRules } from './trainPurchase.js'

export const FinishTrains = Type.Object(
    { ...PlayerAction.properties, type: Type.Literal('FinishTrains'), companyId: Type.String() },
    { additionalProperties: false }
)
export type FinishTrains = Type.Static<typeof FinishTrains>
const Validator = Compile(FinishTrains)
export function isFinishTrains(action: GameAction): action is FinishTrains {
    return (
        action instanceof HydratedFinishTrains ||
        (action.type === 'FinishTrains' && Validator.Check(action))
    )
}

export class HydratedFinishTrains
    extends HydratableAction<typeof FinishTrains>
    implements FinishTrains
{
    declare type: 'FinishTrains'
    declare playerId: string
    declare companyId: string
    readonly #rules: TrainRules
    constructor(data: FinishTrains, rules: TrainRules) {
        super(data instanceof HydratedFinishTrains ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & OperatingTurnState): void {
        assert(
            (this.source === ActionSource.User || this.source === ActionSource.System) &&
                state.activePlayerIds.includes(this.playerId) &&
                controllingOwner(state, this.companyId)?.playerId === this.playerId,
            'Only the operating company’s controlling owner may finish buying trains'
        )
        const reason = finishOperatingTurnReason(state, this.#rules, this.companyId)
        assert(!reason, reason ?? 'Cannot finish buying trains')
    }
}
