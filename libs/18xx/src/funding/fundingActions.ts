import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import { Owner, sameOwner } from '../finance/finance.js'
import { settleCashPayments } from '../finance/cashPayments.js'
import { ShareSale, ShareSaleDetails, applyShareSale } from '../stock/shareSale.js'
import type { StockRules } from '../stock/stockRules.js'
import { TrainPurchaseRequest, type TrainRules } from '../trains/trainPurchase.js'
import {
    EmergencyTrainFunding,
    Bankruptcy,
    type FundingState,
    type TrainFundingRules
} from './trainFunding.js'

export const FundTrain = Type.Object(
    {
        ...PlayerAction.properties,
        ...TrainPurchaseRequest.properties,
        type: Type.Literal('FundTrain'),
        expectedPrice: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type FundTrain = Type.Static<typeof FundTrain>
export const IssueTreasuryShares = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('IssueTreasuryShares'),
        expectedProceeds: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(ShareSaleDetails)
    },
    { additionalProperties: false }
)
export type IssueTreasuryShares = Type.Static<typeof IssueTreasuryShares>
export const SellFundingShares = Type.Object(
    {
        ...PlayerAction.properties,
        ...ShareSale.properties,
        type: Type.Literal('SellFundingShares'),
        seller: Owner,
        expectedProceeds: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(ShareSaleDetails)
    },
    { additionalProperties: false }
)
export type SellFundingShares = Type.Static<typeof SellFundingShares>
export const ContributeTrainFunds = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('ContributeTrainFunds'),
        owner: Owner,
        amount: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type ContributeTrainFunds = Type.Static<typeof ContributeTrainFunds>
const BankruptcyActionFields = Type.Object({
    type: Type.Literal('DeclareBankruptcy'),
    metadata: Type.Optional(Bankruptcy)
})
export const DeclareBankruptcy: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof BankruptcyActionFields.properties
> = Type.Object(
    { ...GameAction.properties, ...BankruptcyActionFields.properties },
    { additionalProperties: false }
)
export type DeclareBankruptcy = Type.Static<typeof DeclareBankruptcy>
export const FundingAction: Type.TUnion<
    [
        typeof FundTrain,
        typeof IssueTreasuryShares,
        typeof SellFundingShares,
        typeof ContributeTrainFunds,
        typeof DeclareBankruptcy
    ]
> = Type.Union([
    FundTrain,
    IssueTreasuryShares,
    SellFundingShares,
    ContributeTrainFunds,
    DeclareBankruptcy
])
export type FundingAction = Type.Static<typeof FundingAction>
const Validator = Compile(FundingAction)
export function isFundingAction(action: GameAction): action is FundingAction {
    return action instanceof HydratedFundingAction || Validator.Check(action)
}
export class HydratedFundingAction extends HydratableAction<typeof FundingAction> {
    declare metadata?: ShareSaleDetails | Bankruptcy
    readonly #rules: TrainFundingRules
    readonly #stocks: StockRules
    readonly #trains: TrainRules
    constructor(
        data: FundingAction,
        rules: TrainFundingRules,
        stocks: StockRules,
        trains: TrainRules
    ) {
        super(data instanceof HydratedFundingAction ? data.dehydrate() : data, Validator)
        this.#rules = rules
        this.#stocks = stocks
        this.#trains = trains
    }
    isValid(state: FundingState): boolean {
        const data = this.dehydrate()
        const funding = new EmergencyTrainFunding(state, this.#rules, this.#stocks, this.#trains)
        if (data.type === 'FundTrain')
            return (
                data.source === ActionSource.User &&
                state.machineState === 'BuyingTrains' &&
                !data.exchangeTrainId &&
                !state.trainFunding &&
                !state.purchaseOffer &&
                !state.privateTrackLay &&
                !state.trackConsent &&
                state.activePlayerIds.includes(data.playerId) &&
                funding
                    .purchases()
                    .some(
                        (purchase) =>
                            purchase.companyId === data.companyId &&
                            purchase.trainId === data.trainId &&
                            purchase.definitionId === data.definitionId &&
                            purchase.price === data.expectedPrice &&
                            funding.begin(purchase).playerId === data.playerId
                    )
            )
        if (state.machineState !== 'FundingTrain' || !state.trainFunding) return false
        const next = funding.next()
        if (data.type === 'DeclareBankruptcy')
            return data.source === ActionSource.System && next.kind === 'bankrupt'
        if (
            data.source !== ActionSource.User ||
            data.playerId !== state.trainFunding.playerId ||
            !state.activePlayerIds.includes(data.playerId)
        )
            return false
        if (data.type === 'IssueTreasuryShares')
            return next.kind === 'issue' && next.details.proceeds === data.expectedProceeds
        if (data.type === 'ContributeTrainFunds')
            return (
                next.kind === 'contribute' &&
                sameOwner(data.owner, next.owner) &&
                data.amount === next.amount
            )
        return (
            next.kind === 'sell' &&
            sameOwner(next.owner, data.seller) &&
            next.sales.some(
                (sale) =>
                    sale.proceeds === data.expectedProceeds &&
                    sale.sales[0].companyId === data.companyId &&
                    sale.sales[0].shares === data.shares
            )
        )
    }
    apply(state: HydratedGameState & FundingState): void {
        assert(this.isValid(state), 'Invalid train funding action')
        const data = this.dehydrate()
        const funding = new EmergencyTrainFunding(state, this.#rules, this.#stocks, this.#trains)
        if (data.type === 'FundTrain') {
            const purchase = funding
                .purchases()
                .find((purchase) => purchase.trainId === data.trainId)!
            state.trainFunding = funding.begin(purchase)
            return
        }
        const next = funding.next()
        if (data.type === 'DeclareBankruptcy' && next.kind === 'bankrupt') {
            state.bankruptcy = {
                companyId: state.trainFunding!.purchase.companyId,
                playerId: state.trainFunding!.playerId,
                shortfall: next.shortfall
            }
            this.metadata = state.bankruptcy
        } else if (data.type === 'ContributeTrainFunds' && next.kind === 'contribute') {
            settleCashPayments(state, [
                {
                    from: next.owner,
                    to: { kind: 'company', companyId: state.trainFunding!.purchase.companyId },
                    amount: next.amount
                }
            ])
        } else {
            const details =
                next.kind === 'issue'
                    ? next.details
                    : next.kind === 'sell' && data.type === 'SellFundingShares'
                      ? next.sales.find(
                            (sale) =>
                                sale.sales[0].companyId === data.companyId &&
                                sale.sales[0].shares === data.shares
                        )
                      : undefined
            assert(details, 'Funding sale requires a settlement')
            applyShareSale(state, details)
            for (const sale of details.sales)
                state.trainFunding!.sales.push({
                    seller: details.seller,
                    companyId: sale.companyId,
                    shares: sale.shares
                })
            this.metadata = details
        }
    }
}
