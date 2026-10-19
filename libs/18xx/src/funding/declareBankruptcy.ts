import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import { CashPayment } from '../finance/cashPayments.js'
import { controllingOwner } from '../finance/finance.js'
import { endOperatingTurn, type OperatingTurnState } from '../operating/finishOperatingTurn.js'
import { BetweenCompaniesState } from '../operating/operatingSteps.js'
import type { StockRules } from '../stock/stockRules.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { eliminatePlayer } from './elimination.js'
import { inReceivership, type ReceivershipRules } from '../finance/receivership.js'
import {
    Bankruptcy,
    EmergencyTrainFunding,
    type FundingState,
    type TrainFundingRules
} from './trainFunding.js'

const TitleChanges = Type.Record(Type.String(), Type.Unknown())
export type DeclareBankruptcySchema<Changes extends Type.TSchema = typeof TitleChanges> =
    Type.TObject<
        Omit<typeof GameAction.properties, 'type'> & {
            type: Type.TLiteral<'DeclareBankruptcy'>
            metadata: Type.TOptional<
                Type.TObject<
                    typeof Bankruptcy.properties & {
                        changes: Type.TOptional<Changes>
                        surrendered: Type.TOptional<typeof CashPayment>
                        continuation: Type.TOptional<Type.TString>
                    }
                >
            >
        }
    >
/**
 * The funding bankruptcy Action. A title that eliminates the player records its changes under
 * its own schema and where play continues; otherwise the bankruptcy ends the game.
 */
export function declareBankruptcySchema(): DeclareBankruptcySchema
export function declareBankruptcySchema<Changes extends Type.TSchema>(
    changes: Changes
): DeclareBankruptcySchema<Changes>
export function declareBankruptcySchema(
    changes: Type.TSchema = TitleChanges
): DeclareBankruptcySchema<Type.TSchema> {
    return Type.Object(
        {
            ...GameAction.properties,
            type: Type.Literal('DeclareBankruptcy'),
            metadata: Type.Optional(
                Type.Object(
                    {
                        ...Bankruptcy.properties,
                        changes: Type.Optional(changes),
                        surrendered: Type.Optional(CashPayment),
                        continuation: Type.Optional(Type.String())
                    },
                    { additionalProperties: false }
                )
            )
        },
        { additionalProperties: false }
    )
}
export const DeclareBankruptcy: DeclareBankruptcySchema = declareBankruptcySchema()
export type DeclareBankruptcy = Type.Static<typeof DeclareBankruptcy>
const DeclareBankruptcyValidator = Compile(DeclareBankruptcy)
export function isDeclareBankruptcy(action: GameAction): action is DeclareBankruptcy {
    return (
        action instanceof HydratedDeclareBankruptcy ||
        (action.type === 'DeclareBankruptcy' && DeclareBankruptcyValidator.Check(action))
    )
}
export class HydratedDeclareBankruptcy
    extends HydratableAction<typeof DeclareBankruptcy>
    implements DeclareBankruptcy
{
    declare type: 'DeclareBankruptcy'
    declare metadata?: DeclareBankruptcy['metadata']
    readonly #rules: TrainFundingRules
    readonly #stocks: StockRules
    readonly #trains: TrainRules
    readonly #receivership?: ReceivershipRules
    constructor(
        data: DeclareBankruptcy,
        rules: TrainFundingRules,
        stocks: StockRules,
        trains: TrainRules,
        receivership?: ReceivershipRules
    ) {
        super(
            data instanceof HydratedDeclareBankruptcy ? data.dehydrate() : data,
            DeclareBankruptcyValidator
        )
        this.#rules = rules
        this.#stocks = stocks
        this.#trains = trains
        this.#receivership = receivership
    }
    isValid(state: FundingState): boolean {
        const funding = new EmergencyTrainFunding(state, this.#rules, this.#stocks, this.#trains)
        if (state.machineState !== 'FundingTrain' || !state.trainFunding) return false
        return (
            (this.source === ActionSource.System ||
                (this.source === ActionSource.User &&
                    this.playerId !== undefined &&
                    funding.canAct(this.playerId))) &&
            funding.next().kind === 'bankrupt'
        )
    }
    apply(state: HydratedGameState & FundingState & OperatingTurnState): void {
        assert(this.isValid(state), 'Invalid DeclareBankruptcy action')
        const funding = new EmergencyTrainFunding(state, this.#rules, this.#stocks, this.#trains)
        const next = funding.next()
        assert(
            next.kind === 'bankrupt' && state.trainFunding,
            'Bankruptcy requires exhausted funding'
        )
        const bankruptcy = {
            companyId: state.trainFunding.purchase.companyId,
            playerId: state.trainFunding.playerId,
            shortfall: next.shortfall
        }
        const { elimination } = this.#rules
        if (!elimination) {
            state.bankruptcy = bankruptcy
            this.metadata = bankruptcy
            return
        }
        const { changes, surrendered } = eliminatePlayer(state, bankruptcy.playerId, elimination, {
            kind: 'company',
            companyId: bankruptcy.companyId
        })
        // A successor president inherits the obligation; a receivership buys what it can
        // afford; otherwise the turn cannot go on.
        const successor = controllingOwner(state, bankruptcy.companyId)
        const receivers =
            !successor && this.#receivership && inReceivership(state, bankruptcy.companyId)
                ? this.#receivership.operators(state, bankruptcy.companyId)
                : undefined
        if (!successor) delete state.trainFunding
        if (receivers) state.activePlayerIds = receivers
        if (!successor && !receivers) {
            endOperatingTurn(state, bankruptcy.companyId)
            delete state.trainPurchaseStep
        }
        this.metadata = {
            ...bankruptcy,
            changes,
            ...(surrendered ? { surrendered } : {}),
            continuation: successor
                ? 'FundingTrain'
                : receivers
                  ? 'BuyingTrains'
                  : BetweenCompaniesState
        }
    }
}
