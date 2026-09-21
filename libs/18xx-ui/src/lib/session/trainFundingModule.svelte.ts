import { assert } from '@tabletop/common'
import {
    BuyTrain,
    ContributeTrainFunds,
    EmergencyTrainFunding,
    FundTrain,
    IssueTreasuryShares,
    SellFundingShares,
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
    Pick<EighteenXXTitleRules, 'trainFundingRules' | 'stockRules' | 'trainRules'>
>

export class TrainFundingModule {
    constructor(private readonly session: TrainFundingSession) {}

    model = $derived.by(
        () =>
            new EmergencyTrainFunding(
                this.session.state,
                this.session.rules.trainFundingRules,
                this.session.rules.stockRules,
                this.session.rules.trainRules
            )
    )
    purchases = $derived.by(() =>
        this.session.state.machineState === 'BuyingTrains' ? this.model.purchases() : []
    )
    choice = $derived.by(() =>
        this.session.state.machineState === 'FundingTrain' ? this.model.next() : undefined
    )
    canFund = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('FundTrain')
    )
    canResolve = $derived.by(
        () =>
            this.session.interactive &&
            this.session.state.machineState === 'FundingTrain' &&
            this.session.validActionTypes.length > 0
    )
    purchase = $derived.by(() => this.session.state.trainFunding?.purchase ?? this.purchases[0])
    plan = $derived.by(() => (this.purchase ? this.model.preview(this.purchase) : undefined))
    sales = $derived.by(() => (this.plan?.choice.kind === 'sell' ? this.plan.choice.sales : []))
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

    async fund(purchase: TrainPurchaseDetails, buy = true) {
        assert(this.canFund, 'Train funding is unavailable')
        await this.session.applyAction(
            this.session.createPlayerAction(FundTrain, {
                companyId: purchase.companyId,
                trainId: purchase.trainId,
                definitionId: purchase.definitionId,
                expectedPrice: purchase.price
            })
        )
        await this.completeCashFunding(buy)
    }
    async resolve(sale?: ShareSaleDetails) {
        if (sale)
            assert(
                (this.canFund || this.canResolve) && this.sales.includes(sale),
                'Choose a legal funding sale'
            )
        const purchase = this.purchase
        assert(purchase, 'Funding requires a train')
        if (!this.session.state.trainFunding) {
            await this.fund(purchase, !sale)
            if (!sale) return
        }
        if (sale) {
            await this.applyChoice(sale)
            await this.completeCashFunding(false)
        } else await this.completeCashFunding(true)
    }

    private async applyChoice(sale?: ShareSaleDetails) {
        const choice = this.choice
        assert(this.canResolve && choice, 'Train funding is unavailable')
        const { applyAction, createPlayerAction } = this.session
        switch (choice.kind) {
            case 'issue':
                await applyAction(
                    createPlayerAction(IssueTreasuryShares, {
                        expectedProceeds: choice.details.proceeds
                    })
                )
                break
            case 'contribute':
                await applyAction(
                    createPlayerAction(ContributeTrainFunds, {
                        owner: choice.owner,
                        amount: choice.amount
                    })
                )
                break
            case 'sell':
                assert(sale, 'Choose shares to sell')
                await applyAction(
                    createPlayerAction(SellFundingShares, {
                        seller: sale.seller,
                        companyId: sale.sales[0].companyId,
                        shares: sale.sales[0].shares,
                        expectedProceeds: sale.proceeds
                    })
                )
                break
            case 'buy':
                await applyAction(
                    createPlayerAction(BuyTrain, {
                        companyId: choice.purchase.companyId,
                        trainId: choice.purchase.trainId,
                        definitionId: choice.purchase.definitionId,
                        expectedPrice: choice.purchase.price
                    })
                )
                break
        }
    }
    private continuesAutomatically(buy: boolean) {
        const kind = this.choice?.kind
        return (
            kind === 'issue' ||
            (buy && (kind === 'contribute' || kind === 'buy')) ||
            (!buy && kind === 'contribute' && this.plan?.requiresSales === true)
        )
    }
    private async completeCashFunding(buy: boolean) {
        await this.session.settled()
        while (this.canResolve && this.continuesAutomatically(buy)) {
            const actionCount = this.session.state.actionCount
            await this.applyChoice()
            await this.session.settled()
            if (this.session.state.actionCount === actionCount) break
        }
    }
}
