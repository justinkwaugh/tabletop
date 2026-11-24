import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, Visibility } from '@tabletop/common'
import { RoundEnd, roundEnd, type ValuationRules, EighteenXXPlayerAction } from '@tabletop/18xx'
import {
    FinalCompanyPass,
    Purchase,
    Selection,
    type HydratedEighteenFortySixState
} from './state.js'
import {
    chooseCard,
    hiddenDistribution,
    passFinalCompany,
    settleDistribution
} from './distribution.js'

export const ChooseDraftCard = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('ChooseDraftCard'),
        source: Type.Literal(ActionSource.User),
        cardId: Visibility.protect(Type.String(), { policy: Visibility.Policy.Actor }),
        revealsInfo: Type.Literal(true),
        metadata: Type.Optional(
            Type.Object({ finalCompany: Selection }, { additionalProperties: false })
        )
    },
    { additionalProperties: false }
)
export const PassFinalCompany = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('PassFinalCompany'),
        source: Type.Literal(ActionSource.User),
        revealsInfo: Type.Literal(true),
        metadata: Type.Optional(FinalCompanyPass)
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
                    purchases: Type.Array(Purchase),
                    roundEnd: Type.Optional(RoundEnd)
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export const ChooseValidator = Compile(ChooseDraftCard)
export const PassValidator = Compile(PassFinalCompany)
const ProjectedChooseDraftCard = Visibility.createProjectionSchema(ChooseDraftCard)
const ProjectedChooseValidator = Compile(ProjectedChooseDraftCard)
export function isChooseDraftCard(
    action: GameAction
): action is Type.Static<typeof ProjectedChooseDraftCard> {
    return ProjectedChooseValidator.Check(action)
}
export function isPassFinalCompany(
    action: GameAction
): action is Type.Static<typeof PassFinalCompany> {
    return PassValidator.Check(action)
}
export const RevealValidator = Compile(RevealDraft)
export function isRevealDraft(action: GameAction): action is Type.Static<typeof RevealDraft> {
    return RevealValidator.Check(action)
}
export class ChooseAction extends HydratableAction<typeof ChooseDraftCard> {
    declare playerId: string
    declare cardId: string
    declare metadata?: Type.Static<typeof ChooseDraftCard>['metadata']
    constructor(data: Type.Static<typeof ChooseDraftCard>) {
        super(data, ChooseValidator)
    }
    apply(state: HydratedEighteenFortySixState): void {
        const finalOffer = hiddenDistribution(state).finalOffer
        const finalCompany = finalOffer && { ...finalOffer }
        chooseCard(state, this.playerId, this.cardId)
        if (finalCompany) this.metadata = { finalCompany }
    }
}
export class PassAction extends HydratableAction<typeof PassFinalCompany> {
    declare playerId: string
    declare metadata?: Type.Static<typeof PassFinalCompany>['metadata']
    constructor(data: Type.Static<typeof PassFinalCompany>) {
        super(data, PassValidator)
    }
    apply(state: HydratedEighteenFortySixState): void {
        this.metadata = passFinalCompany(state, this.playerId)
    }
}
export class RevealAction extends HydratableAction<typeof RevealDraft> {
    declare metadata?: Type.Static<typeof RevealDraft>['metadata']
    readonly #valuationRules: ValuationRules
    constructor(data: Type.Static<typeof RevealDraft>, valuationRules: ValuationRules) {
        super(data, RevealValidator)
        this.#valuationRules = valuationRules
    }
    apply(state: HydratedEighteenFortySixState): void {
        const purchases = settleDistribution(state)
        this.metadata = { purchases, roundEnd: roundEnd(state, this.#valuationRules, 'opening') }
    }
}
