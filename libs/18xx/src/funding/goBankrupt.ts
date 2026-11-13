import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
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
    crisisInsolvencyChoices,
    crisisSales,
    currentDebt,
    debtInsolvency,
    settleCurrentDebt,
    type CashCrisisRules,
    type CashCrisisState
} from './cashCrisis.js'
import { eliminatePlayer } from './elimination.js'
import { TitleChanges } from '../actions/titleChanges.js'
import type { FundingState } from './trainFunding.js'

export type GoBankruptSchema<Changes extends Type.TSchema = TitleChanges> = Type.TObject<
    Omit<typeof EighteenXXPlayerAction.properties, 'type'> & {
        type: Type.TLiteral<'GoBankrupt'>
        choice: Type.TOptional<Type.TString>
        metadata: Type.TOptional<
            Type.TObject<{
                changes: Changes
                forgiven: Type.TInteger
                surrendered: Type.TOptional<typeof CashPayment>
                presidedCompanyId: Type.TOptional<Type.TString>
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
            ...EighteenXXPlayerAction.properties,
            type: Type.Literal('GoBankrupt'),
            /** The president's choice in a failing company's insolvency, as 1849's bank loan. */
            choice: Type.Optional(Type.String()),
            metadata: Type.Optional(
                Type.Object(
                    {
                        changes,
                        forgiven: Type.Integer({ minimum: 1 }),
                        surrendered: Type.Optional(CashPayment),
                        presidedCompanyId: Type.Optional(Type.String()),
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
    declare choice?: string
    declare metadata?: GoBankrupt['metadata']
    readonly #rules: CashCrisisRules
    readonly #valuationRules: ValuationRules
    constructor(data: GoBankrupt, rules: CashCrisisRules, valuationRules: ValuationRules) {
        super(data instanceof HydratedGoBankrupt ? data.dehydrate() : data, Validator)
        this.#rules = rules
        this.#valuationRules = valuationRules
    }
    /**
     * Whether the player in debt may go bankrupt now. A company's debt fails its company only
     * once no sale can pay it, with one of its president's choices if they have any; the System
     * declares it when they have none.
     */
    isValidFor(state: CashCrisisState & FundingState): boolean {
        const debt = currentDebt(state)
        if (debt?.playerId !== this.playerId) return false
        if (!debtInsolvency(this.#rules, debt))
            return this.source === ActionSource.User && this.choice === undefined
        if (crisisSales(state, this.#rules, this.playerId).length) return false
        const choices = crisisInsolvencyChoices(state, this.#rules, debt)
        return choices.length
            ? this.source === ActionSource.User &&
                  this.choice !== undefined &&
                  choices.includes(this.choice)
            : this.choice === undefined
    }
    apply(state: HydratedGameState & CashCrisisState & OperatingTurnState & FundingState): void {
        const crisis = state.cashCrisis
        const debt = currentDebt(state)
        assertExists(crisis, 'Bankruptcy settles a cash crisis')
        assertExists(debt, 'Bankruptcy settles a debt')
        assert(this.isValidFor(state), 'Only the player in debt may go bankrupt, once allowed')
        const operatingCompany = () =>
            crisis.continuation !== BetweenCompaniesState &&
            state.operatingSet &&
            !state.operatingSet.completed
                ? nextOperatingCompany(state)
                : undefined
        const insolvency = debtInsolvency(this.#rules, debt)
        if (insolvency && debt.companyId) {
            const companyId = debt.companyId
            const failsOwnTurn = operatingCompany() === companyId
            const changes = insolvency.fail(
                state,
                { companyId, playerId: this.playerId, shortfall: debt.amount },
                this.choice
            )
            // A company failing in its own turn ends it, as a failed train purchase does.
            if (failsOwnTurn) {
                abandonOperatingTurn(state, companyId)
                crisis.continuation = BetweenCompaniesState
            }
            const forgiven = debt.amount
            const continuation = settleCurrentDebt(state)
            // The president stays the ended turn's owner, unless they have left the game.
            if (failsOwnTurn)
                state.activePlayerIds = state.turnManager.turnOrder.includes(this.playerId)
                    ? [this.playerId]
                    : state.turnManager.turnOrder.slice(0, 1)
            const ended = failsOwnTurn ? operatingRoundEnd(state, this.#valuationRules) : undefined
            this.metadata = {
                changes,
                forgiven,
                ...(continuation ? { continuation } : {}),
                ...(ended ? { roundEnd: ended } : {})
            }
            return
        }
        const { elimination } = this.#rules
        assertExists(elimination, 'A player’s own debt is settled by elimination')
        const operatingAtBankruptcy = operatingCompany()
        const presidedCompanyId =
            operatingAtBankruptcy &&
            controllingOwner(state, operatingAtBankruptcy)?.playerId === this.playerId
                ? operatingAtBankruptcy
                : undefined
        const { changes, surrendered } = eliminatePlayer(state, this.playerId, elimination, {
            kind: 'bank'
        })
        // A company left without a president cannot finish its own turn.
        const companyId = operatingCompany()
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
            ...(presidedCompanyId ? { presidedCompanyId } : {}),
            ...(continuation ? { continuation } : {}),
            ...(ended ? { roundEnd: ended } : {})
        }
    }
}
