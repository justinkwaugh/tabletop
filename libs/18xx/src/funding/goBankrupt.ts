import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { CashPayment } from '../finance/cashPayments.js'
import { controllingOwner } from '../finance/finance.js'
import { abandonOperatingTurn, type OperatingTurnState } from '../operating/finishOperatingTurn.js'
import { BetweenCompaniesState } from '../operating/operatingSteps.js'
import { nextOperatingCompany } from '../operating/operatingSet.js'
import { operatingRoundEnd } from '../operating/operatingRoundSnapshot.js'
import { RoundEnd } from '../ending/roundEnd.js'
import type { ValuationRules } from '../ending/finalWealth.js'
import {
    currentDebt,
    settleCurrentDebt,
    type CashCrisisRules,
    type CashCrisisState
} from './cashCrisis.js'
import { eliminatePlayer } from './elimination.js'
import { TitleChanges } from '../actions/titleChanges.js'

export type GoBankruptSchema<Changes extends Type.TSchema = TitleChanges> = Type.TObject<
    Omit<typeof PlayerAction.properties, 'type'> & {
        type: Type.TLiteral<'GoBankrupt'>
        metadata: Type.TOptional<
            Type.TObject<{
                changes: Changes
                forgiven: Type.TInteger
                surrendered: Type.TOptional<typeof CashPayment>
                continuation: Type.TOptional<Type.TString>
                roundEnd: Type.TOptional<typeof RoundEnd>
            }>
        >
    }
>
/** The bankruptcy Action of a cash crisis, recording the title's changes under its own schema. */
export function goBankruptSchema<Changes extends Type.TSchema>(
    changes: Changes
): GoBankruptSchema<Changes> {
    return Type.Object(
        {
            ...PlayerAction.properties,
            type: Type.Literal('GoBankrupt'),
            metadata: Type.Optional(
                Type.Object(
                    {
                        changes,
                        forgiven: Type.Integer({ minimum: 1 }),
                        surrendered: Type.Optional(CashPayment),
                        continuation: Type.Optional(Type.String()),
                        roundEnd: Type.Optional(RoundEnd)
                    },
                    { additionalProperties: false }
                )
            )
        },
        { additionalProperties: false }
    )
}
export const GoBankrupt: GoBankruptSchema = goBankruptSchema(TitleChanges)
export type GoBankrupt = Type.Static<typeof GoBankrupt>
const Validator = Compile(GoBankrupt)
export function isGoBankrupt(action: GameAction): action is GoBankrupt {
    return (
        action instanceof HydratedGoBankrupt ||
        (action.type === 'GoBankrupt' && Validator.Check(action))
    )
}

export class HydratedGoBankrupt extends HydratableAction<typeof GoBankrupt> implements GoBankrupt {
    declare type: 'GoBankrupt'
    declare playerId: string
    declare metadata?: GoBankrupt['metadata']
    readonly #rules: CashCrisisRules
    readonly #valuationRules: ValuationRules
    constructor(data: GoBankrupt, rules: CashCrisisRules, valuationRules: ValuationRules) {
        super(data instanceof HydratedGoBankrupt ? data.dehydrate() : data, Validator)
        this.#rules = rules
        this.#valuationRules = valuationRules
    }
    apply(state: HydratedGameState & CashCrisisState & OperatingTurnState): void {
        const crisis = state.cashCrisis
        const debt = currentDebt(state)
        assertExists(crisis, 'Bankruptcy settles a cash crisis')
        assert(
            this.source === ActionSource.User && debt?.playerId === this.playerId,
            'Only the player in debt may go bankrupt'
        )
        const { changes, surrendered } = eliminatePlayer(
            state,
            this.playerId,
            this.#rules.elimination,
            { kind: 'bank' }
        )
        // A company left without a president cannot finish its own turn.
        const companyId =
            crisis.continuation !== BetweenCompaniesState &&
            state.operatingSet &&
            !state.operatingSet.completed
                ? nextOperatingCompany(state)
                : undefined
        const abandoned = !!companyId && !controllingOwner(state, companyId)
        if (companyId && abandoned) {
            abandonOperatingTurn(state, companyId)
            crisis.continuation = BetweenCompaniesState
        }
        const forgiven = debt.amount
        const continuation = settleCurrentDebt(state)
        const ended = abandoned ? operatingRoundEnd(state, this.#valuationRules) : undefined
        this.metadata = {
            changes,
            forgiven,
            ...(surrendered ? { surrendered } : {}),
            ...(continuation ? { continuation } : {}),
            ...(ended ? { roundEnd: ended } : {})
        }
    }
}
