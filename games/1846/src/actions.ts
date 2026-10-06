import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    GameAction,
    HydratableAction,
    Visibility
} from '@tabletop/common'
import { Purchase, type HydratedEighteenFortySixState } from './state.js'
import { chooseCard, passFinalCompany, settleDistribution } from './distribution.js'

export const ChooseDraftCard = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('ChooseDraftCard'),
        source: Type.Literal(ActionSource.User),
        cardId: Visibility.protect(Type.String(), { policy: Visibility.Policy.Actor }),
        revealsInfo: Type.Literal(true)
    },
    { additionalProperties: false }
)
export const PassFinalCompany = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('PassFinalCompany'),
        source: Type.Literal(ActionSource.User),
        revealsInfo: Type.Literal(true)
    },
    { additionalProperties: false }
)
export const RevealDraft = Type.Object(
    {
        ...GameAction.properties,
        type: Type.Literal('RevealDraft'),
        source: Type.Literal(ActionSource.System),
        revealsInfo: Type.Literal(true),
        metadata: Type.Optional(
            Type.Object(
                {
                    purchases: Type.Array(Purchase)
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export const ChooseValidator = Compile(ChooseDraftCard)
export const PassValidator = Compile(PassFinalCompany)
export const RevealValidator = Compile(RevealDraft)
export class ChooseAction extends HydratableAction<typeof ChooseDraftCard> {
    declare playerId: string
    declare cardId: string
    constructor(data: Type.Static<typeof ChooseDraftCard>) {
        super(data, ChooseValidator)
    }
    apply(state: HydratedEighteenFortySixState): void {
        chooseCard(state, this.playerId, this.cardId)
    }
}
export class PassAction extends HydratableAction<typeof PassFinalCompany> {
    declare playerId: string
    constructor(data: Type.Static<typeof PassFinalCompany>) {
        super(data, PassValidator)
    }
    apply(state: HydratedEighteenFortySixState): void {
        passFinalCompany(state, this.playerId)
    }
}
export class RevealAction extends HydratableAction<typeof RevealDraft> {
    declare metadata?: Type.Static<typeof RevealDraft>['metadata']
    constructor(data: Type.Static<typeof RevealDraft>) {
        super(data, RevealValidator)
    }
    apply(state: HydratedEighteenFortySixState): void {
        settleDistribution(state)
        this.metadata = { purchases: structuredClone(state.purchases) }
    }
}
