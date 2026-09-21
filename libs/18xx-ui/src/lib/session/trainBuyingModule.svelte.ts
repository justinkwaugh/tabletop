import { assert, assertExists } from '@tabletop/common'
import {
    BuyTrain,
    OfferPurchase,
    TrainPurchase,
    evaluatePurchaseOffer,
    isBuyTrain,
    isDistributeEarnings,
    isOfferPurchase,
    isRespondToPurchaseOffer,
    purchaseChoices,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type PurchaseOfferRequest,
    type TrainPurchaseRequest
} from '@tabletop/18xx'
import type { SessionContext } from './sessionContext.js'
import { StagedSelection, singleChoice } from './stagedSelection.svelte.js'
import {
    TrainBuyingStageOrder,
    type TrainBuyingStages,
    type TrainSource
} from './trainBuyingSelection.js'

type TrainBuyingState = ConstructorParameters<typeof TrainPurchase>[0] &
    Parameters<typeof evaluatePurchaseOffer>[0] &
    Pick<EighteenXXState, 'machineState' | 'trainPurchaseStep'>

export type TrainBuyingContext = SessionContext<
    TrainBuyingState,
    Pick<EighteenXXTitleRules, 'trainRules' | 'transferRules'>
>
type PurchaseOptions = () => ReturnType<typeof purchaseChoices>

export class TrainBuyingModule {
    readonly depotChoice = singleChoice<TrainPurchaseRequest>()
    readonly sourceStages = new StagedSelection<TrainBuyingStages>(
        TrainBuyingStageOrder,
        'pop-stage'
    )
    constructor(
        private readonly context: TrainBuyingContext,
        private readonly purchaseOptions: PurchaseOptions
    ) {}

    private buying = $derived.by(() => this.context.state.machineState === 'BuyingTrains')
    selection = $derived.by(() =>
        this.context.selectionsVisible && this.buying ? this.sourceStages.state : {}
    )
    source = $derived.by(() => this.selection.source?.value ?? 'depot')
    companyChoices = $derived.by(() =>
        this.purchaseOptions().flatMap((option) => {
            const { asset, seller } = option.request
            if (asset.kind !== 'train' || seller.kind !== 'company') return []
            const evaluation = this.evaluateOffer(option.request)
            const train = this.context.state.trainInventory.trains.find(
                (candidate) => candidate.id === asset.trainId
            )
            assertExists(train, 'Train purchase choice requires a train')
            const source: TrainSource =
                evaluation.buyerPlayerId === evaluation.sellerPlayerId ? 'mine' : 'others'
            return [{ ...option, definitionId: train.definitionId, source }]
        })
    )
    companyEvaluation = $derived.by(() => {
        const request = this.selection.purchase?.value
        return request ? this.evaluateOffer(request) : undefined
    })
    depotSelection = $derived.by(() =>
        this.context.selectionsVisible && this.buying ? this.depotChoice.value('choice') : undefined
    )
    model = $derived.by(
        () => new TrainPurchase(this.context.state, this.context.rules.trainRules)
    )
    offers = $derived.by(() => this.model.offers())
    marketOffers = $derived.by(() => this.model.marketOffers())
    exchanges = $derived.by(() => this.model.exchanges())
    preview = $derived.by(() =>
        this.depotSelection ? this.model.evaluate(this.depotSelection).details : undefined
    )
    nextPhase = $derived.by(() =>
        this.preview
            ? this.context.rules.trainRules.phaseAfterPurchase(
                  this.context.state,
                  this.preview.definitionId
              )
            : undefined
    )
    canBuy = $derived.by(
        () =>
            this.context.interactive &&
            this.buying &&
            this.context.validActionTypes.includes('BuyTrain')
    )
    limit = $derived.by(() => {
        const step = this.context.state.trainPurchaseStep
        return step
            ? this.context.rules.trainRules.trainLimit(this.context.state, step.companyId)
            : undefined
    })
    purchaseHistory = $derived.by(() => this.context.recordedActions.filter(isBuyTrain))
    currentPurchaseIds = $derived.by(() => {
        const step = this.context.state.trainPurchaseStep
        if (!step) return []
        const ids = new Set(step.purchasedTrainIds)
        const actions = this.context.recordedActions
        const start = actions.findLastIndex(
            (action) => isDistributeEarnings(action) && action.companyId === step.companyId
        )
        for (const action of actions.slice(start + 1)) {
            if (!isOfferPurchase(action) && !isRespondToPurchaseOffer(action)) continue
            const offer = action.metadata?.offer
            if (
                action.metadata?.accepted &&
                offer?.companyId === step.companyId &&
                offer.asset.kind === 'train'
            )
                ids.add(offer.asset.trainId)
        }
        return [...ids]
    })

    selectSource(source: TrainSource) {
        this.sourceStages.clear()
        this.sourceStages.choose('source', source)
    }
    selectCompanyTrain(request: PurchaseOfferRequest) {
        assert(
            this.companyChoices.some(
                (choice) =>
                    choice.request.asset.kind === 'train' &&
                    request.asset.kind === 'train' &&
                    choice.request.asset.trainId === request.asset.trainId &&
                    choice.source === this.source
            ),
            'Choose an available company train'
        )
        this.sourceStages.choose('purchase', { ...request })
    }
    setCompanyTrainPrice(price: number) {
        const request = this.selection.purchase?.value
        assert(request, 'Choose a company train first')
        this.sourceStages.choose('purchase', { ...request, price })
    }
    async buyCompanyTrain() {
        const request = this.selection.purchase?.value
        assert(
            request &&
                this.context.interactive &&
                this.context.validActionTypes.includes('OfferPurchase') &&
                this.companyEvaluation &&
                !this.companyEvaluation.reason,
            'Choose a legal company train purchase'
        )
        await this.context.applyAction(this.context.createPlayerAction(OfferPurchase, request))
    }
    select(request: TrainPurchaseRequest) {
        assert(this.canBuy && this.model.evaluate(request).details, 'Choose a legal train purchase')
        this.depotChoice.choose('choice', request)
    }
    async confirm() {
        const preview = this.preview
        assert(this.canBuy && preview, 'Choose a legal train purchase')
        await this.buy(preview)
    }
    async buy(request: TrainPurchaseRequest) {
        const preview = this.model.evaluate(request).details
        assert(this.canBuy && preview, 'Choose a legal train purchase')
        await this.context.applyAction(
            this.context.createPlayerAction(BuyTrain, {
                companyId: preview.companyId,
                trainId: preview.trainId,
                definitionId: preview.definitionId,
                expectedPrice: preview.price,
                ...(preview.exchangeTrainId ? { exchangeTrainId: preview.exchangeTrainId } : {})
            })
        )
    }

    private evaluateOffer(request: PurchaseOfferRequest) {
        return evaluatePurchaseOffer(
            this.context.state,
            request,
            this.context.rules.transferRules,
            this.context.rules.trainRules
        )
    }
}
