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
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { controllingOwner, finiteCashOwnedBy } from '../finance/finance.js'
import { endOperatingTurn, type OperatingTurnState } from '../operating/finishOperatingTurn.js'
import { BetweenCompaniesState } from '../operating/operatingSteps.js'
import { nextOperatingCompany } from '../operating/operatingSet.js'
import {
    BankruptcyRecord,
    currentDebt,
    settleCurrentDebt,
    type CashCrisisRules,
    type CashCrisisState
} from './cashCrisis.js'

export const GoBankrupt = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('GoBankrupt'),
        metadata: Type.Optional(
            Type.Object(
                {
                    record: BankruptcyRecord,
                    forgiven: Type.Integer({ minimum: 1 }),
                    surrendered: Type.Optional(CashPayment),
                    continuation: Type.Optional(Type.String())
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
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
    constructor(data: GoBankrupt, rules: CashCrisisRules) {
        super(data instanceof HydratedGoBankrupt ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & CashCrisisState & OperatingTurnState): void {
        const crisis = state.cashCrisis
        const debt = currentDebt(state)
        assertExists(crisis, 'Bankruptcy settles a cash crisis')
        assert(
            this.source === ActionSource.User && debt?.playerId === this.playerId,
            'Only the player in debt may go bankrupt'
        )
        const record = this.#rules.bankrupt(state, this.playerId)
        const player = { kind: 'player' as const, playerId: this.playerId }
        const cash = finiteCashOwnedBy(state, player)
        const surrendered = cash
            ? { from: player, to: { kind: 'bank' as const }, amount: cash }
            : undefined
        if (surrendered) settleCashPayments(state, [surrendered])
        state.bankruptPlayerIds = [...(state.bankruptPlayerIds ?? []), this.playerId]
        state.turnManager.turnOrder = state.turnManager.turnOrder.filter(
            (id) => id !== this.playerId
        )
        state.stockRound.passedPlayerIds = state.stockRound.passedPlayerIds.filter(
            (id) => id !== this.playerId
        )
        // A company left without a president cannot finish its own turn.
        const companyId =
            crisis.continuation !== BetweenCompaniesState &&
            state.operatingSet &&
            !state.operatingSet.completed
                ? nextOperatingCompany(state)
                : undefined
        if (companyId && !controllingOwner(state, companyId)) {
            endOperatingTurn(state, companyId)
            delete state.trainPurchaseStep
            crisis.continuation = BetweenCompaniesState
        }
        const forgiven = debt.amount
        const continuation = settleCurrentDebt(state)
        this.metadata = {
            record,
            forgiven,
            ...(surrendered ? { surrendered } : {}),
            ...(continuation ? { continuation } : {})
        }
    }
}
