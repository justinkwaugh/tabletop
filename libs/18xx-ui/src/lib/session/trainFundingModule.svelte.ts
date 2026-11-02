import { assert } from '@tabletop/common'
import {
    DeclareBankruptcy,
    EmergencyTrainFunding,
    FundTrain,
    SellFundingShares,
    settlingFundingAction,
    isContributeTrainFunds,
    isIssueTreasuryShares,
    isSellFundingShares,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type ShareSaleDetails,
    type TrainPurchaseDetails
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'

type TrainFundingState = ConstructorParameters<typeof EmergencyTrainFunding>[0] &
    Pick<EighteenXXState, 'machineState' | 'trainFunding' | 'actionCount'>

export type TrainFundingSession = ModuleSession<
    TrainFundingState,
    Pick<EighteenXXTitleRules, 'stockRules' | 'trainRules'> &
        Partial<Pick<EighteenXXTitleRules, 'trainFundingRules'>>
>

export class TrainFundingModule {
    constructor(private readonly session: TrainFundingSession) {}

    model = $derived.by(() =>
        this.session.rules.trainFundingRules
            ? new EmergencyTrainFunding(
                  this.session.state,
                  this.session.rules.trainFundingRules,
                  this.session.rules.stockRules,
                  this.session.rules.trainRules
              )
            : undefined
    )
    purchases = $derived.by(() =>
        this.session.state.machineState === 'BuyingTrains' ? (this.model?.purchases() ?? []) : []
    )
    marketPurchases = $derived.by(() =>
        this.purchases.filter((purchase) => this.fromMarket(purchase))
    )
    /** A depot train may have no stored record yet: an unlimited supply records only bought trains. */
    depotPurchases = $derived.by(() =>
        this.purchases.filter((purchase) => !this.fromMarket(purchase))
    )
    /** Whether the help is optional, offered to a company that already owns a train. */
    voluntary = $derived.by(() => {
        const companyId =
            this.session.state.trainFunding?.purchase.companyId ?? this.purchases[0]?.companyId
        return !!companyId && !!this.model?.voluntary(companyId)
    })
    choice = $derived.by(() =>
        this.session.state.machineState === 'FundingTrain' ? this.model?.next() : undefined
    )
    canFund = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('FundTrain')
    )
    canResolve = $derived.by(
        () =>
            this.session.interactive &&
            this.session.state.machineState === 'FundingTrain' &&
            this.session.validActionTypes.some((type) =>
                [
                    'IssueTreasuryShares',
                    'ContributeTrainFunds',
                    'SellFundingShares',
                    'BuyTrain',
                    'DeclareBankruptcy'
                ].includes(type)
            )
    )
    purchase = $derived.by(() => this.session.state.trainFunding?.purchase ?? this.purchases[0])
    options = $derived.by(() => {
        const model = this.model
        return model && !this.session.state.trainFunding
            ? this.purchases.map((purchase) => ({ purchase, plan: model.preview(purchase) }))
            : []
    })
    plan = $derived.by(() => (this.purchase ? this.model?.preview(this.purchase) : undefined))
    /** Sales are chosen once funding has begun, so each press records one Action. */
    sales = $derived.by(() =>
        this.session.state.trainFunding && this.plan?.choice.kind === 'sell'
            ? this.plan.choice.sales
            : []
    )
    private actionsSinceFunding = $derived.by(() => {
        const actions = this.session.recordedActions
        const start = actions.findLastIndex((action) => action.type === 'FundTrain')
        return this.session.state.trainFunding && start >= 0 ? actions.slice(start + 1) : []
    })
    contributions = $derived.by(() => this.actionsSinceFunding.filter(isContributeTrainFunds))
    saleHistory = $derived.by(() =>
        this.actionsSinceFunding.flatMap((action) =>
            (isSellFundingShares(action) || isIssueTreasuryShares(action)) && action.metadata
                ? [{ id: action.id, details: action.metadata }]
                : []
        )
    )

    /** Begins funding the purchase; the engine settles every step that is not a sale. */
    async fund(purchase: TrainPurchaseDetails) {
        assert(this.canFund, 'Train funding is unavailable')
        await this.session.applyAction(
            this.session.createPlayerAction(FundTrain, {
                companyId: purchase.companyId,
                trainId: purchase.trainId,
                definitionId: purchase.definitionId,
                expectedPrice: purchase.price
            })
        )
    }
    /**
     * Takes the funding's next step: begins it, or makes the sale or declaration it waits for.
     * Each press records one Action, so one Undo reverses it.
     */
    async resolve(sale?: ShareSaleDetails) {
        if (!this.session.state.trainFunding) {
            assert(!sale, 'Begin funding before choosing a sale')
            const purchase = this.purchase
            assert(purchase, 'Funding requires a train')
            await this.fund(purchase)
            return
        }
        const choice = this.choice
        assert(this.canResolve && choice, 'Train funding is unavailable')
        const { applyAction, createPlayerAction } = this.session
        // Games recorded before the engine settled these steps may still wait on them.
        const settling = settlingFundingAction(choice)
        if (settling) await applyAction(createPlayerAction(settling.schema, settling.data))
        else if (choice.kind === 'bankrupt')
            await applyAction(createPlayerAction(DeclareBankruptcy, {}))
        else {
            assert(sale && this.sales.includes(sale), 'Choose a legal funding sale')
            await applyAction(
                createPlayerAction(SellFundingShares, {
                    seller: sale.seller,
                    companyId: sale.sales[0].companyId,
                    shares: sale.sales[0].shares,
                    expectedProceeds: sale.proceeds
                })
            )
        }
    }
    private fromMarket(purchase: TrainPurchaseDetails) {
        return this.session.state.trainInventory.trains.some(
            (train) => train.id === purchase.trainId && train.status === 'market'
        )
    }
}
