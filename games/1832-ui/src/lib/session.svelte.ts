import {
    AnswerMerger,
    MergingState,
    PassMerger,
    ProposeMerger,
    SellTakeoverShares,
    mergerDecision,
    mergerOptions,
    mergerTerms,
    takeoverSales,
    takeoverShortfall,
    isSellTakeoverShares,
    takeoverPayments,
    type MergerOption,
    BuyCoalRights,
    EighteenThirtyTwoPriceProtection,
    EighteenThirtyTwoRedemption,
    EighteenThirtyTwoTitleRules,
    PlaceRevenueToken,
    RevenueTokenPrivateIds,
    TakeLondonShare,
    londonShareCompanies,
    revenueTokenChoices,
    revenueTokenUnplaced,
    type EighteenThirtyTwoState,
    type HydratedEighteenThirtyTwoState,
    type RevenueTokenChoice
} from '@tabletop/1832'
import { assertExists } from '@tabletop/common'
import { undoableStagedSelection } from '@tabletop/frontend-components'
import {
    cashOwnedBy,
    sameOwner,
    type Owner,
    type ShareSaleDetails,
    DiscardMergedTrain
} from '@tabletop/18xx'
import {
    ShareActions,
    StopRightsActions,
    createEighteenXXSessionClass,
    type HistoricalMapState,
    type TitlePrivatePower
} from '@tabletop/18xx-ui'
import { mapState1832 } from './mapState.js'
import { createRouteWorker } from './routeWorker.js'
import { awaitedDecision1832, mergedDiscardTerms } from './awaitedDecision.js'
import { EighteenThirtyTwoMapView } from './mapView.js'
import { EighteenThirtyTwoPresentation } from './presentation.js'
import { PrivateOperatingPowers } from './privatePowers.js'
import {
    MergedDiscardStageOrder,
    MergerStageOrder,
    stageMergerCompany,
    stageMergerPartner,
    stageSystemPresidency,
    stagedMergerChoices,
    toggleMergedDiscard,
    type MergedDiscardSelection,
    type MergedDiscardValues,
    type MergerSelection,
    type MergerSelectionValues
} from './stagedSelection.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<
        typeof EighteenThirtyTwoState,
        HydratedEighteenThirtyTwoState
    >
> = createEighteenXXSessionClass<typeof EighteenThirtyTwoState, HydratedEighteenThirtyTwoState>(
    EighteenThirtyTwoTitleRules,
    EighteenThirtyTwoMapView,
    EighteenThirtyTwoPresentation,
    createRouteWorker
)

const TokenPrivates = [
    { kind: 'port', name: 'Port' },
    { kind: 'cotton', name: 'Cotton' }
] as const

export class EighteenThirtyTwoSession extends BaseSession {
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        // Undo pops the latest choice first: the System's president, the partner, the company.
        this.localSelections.register(
            undoableStagedSelection<MergerSelectionValues>(
                MergerStageOrder,
                () => this.mergerSelection,
                (selection) => (this.mergerSelection = selection)
            )
        )
        this.localSelections.register(
            undoableStagedSelection<MergedDiscardValues>(
                MergedDiscardStageOrder,
                () => this.mergedDiscardSelection,
                (selection) => (this.mergedDiscardSelection = selection)
            )
        )
    }
    readonly canChooseAction = $derived(
        this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState
    )
    readonly stockPanels = this.titleStockPanels<'company'>([
        {
            id: 'company',
            label: 'Company action',
            available: () => this.shareActions.companyOptions.length > 0
        }
    ])
    readonly shareActions = new ShareActions<HydratedEighteenThirtyTwoState>(
        this,
        EighteenThirtyTwoPriceProtection,
        EighteenThirtyTwoRedemption
    )
    /** The merger phase's open decision, and who makes it. */
    readonly mergerDecision = $derived(
        this.gameState.machineState === MergingState ? mergerDecision(this.gameState) : undefined
    )
    /** The merger decision when it is this player's, shown even while an action is pending. */
    readonly myMergerDecision = $derived(
        this.mergerDecision &&
            !this.isViewingHistory &&
            this.mergerDecision.playerId === this.myPlayer?.id
            ? this.mergerDecision
            : undefined
    )
    /** The mergers the player may propose, with what each would cost or make. */
    readonly mergerProposals = $derived.by(() => {
        const decision = this.myMergerDecision
        if (decision?.kind !== 'propose') return []
        return mergerOptions(this.gameState, decision.playerId).map((option) => ({
            option,
            proposerPlayerId: decision.playerId,
            terms: mergerTerms(this.gameState, option, decision.playerId)
        }))
    })
    /** The proposals grouped by the pair of companies they would merge. */
    readonly mergerPairings = $derived.by(() => {
        const keys = [
            ...new Set(
                this.mergerProposals.map(({ option }) => `${option.companyId}|${option.partnerId}`)
            )
        ]
        return keys.map((key) => {
            const proposals = this.mergerProposals.filter(
                ({ option }) => `${option.companyId}|${option.partnerId}` === key
            )
            const [{ option }] = proposals
            return { companyId: option.companyId, partnerId: option.partnerId, proposals }
        })
    })
    /** The merger being chosen: the player's company, then the company to merge it with. */
    private mergerSelection = $state<MergerSelection>({})
    private readonly mergerChoices = $derived(stagedMergerChoices(this.mergerSelection))
    readonly mergerCompanyIds = $derived([
        ...new Set(this.mergerPairings.map((pairing) => pairing.companyId))
    ])
    readonly mergerCompanyId = $derived(
        this.onlyOrChosen(this.mergerCompanyIds, this.mergerChoices.companyId)
    )
    readonly mergerPartnerIds = $derived(
        this.mergerPairings
            .filter((pairing) => pairing.companyId === this.mergerCompanyId)
            .map((pairing) => pairing.partnerId)
    )
    readonly mergerPartnerId = $derived(
        this.onlyOrChosen(this.mergerPartnerIds, this.mergerChoices.partnerId)
    )
    /**
     * What merging the chosen pair could make: a System under either president, and a takeover
     * either way. Yielding initiator status is offered as its result, the other president's
     * System or the other company buying.
     */
    readonly mergerOutcomes = $derived.by(() => {
        const pairing = this.mergerPairings.find(
            (pairing) =>
                pairing.companyId === this.mergerCompanyId &&
                pairing.partnerId === this.mergerPartnerId
        )
        if (!pairing) return undefined
        const systems = pairing.proposals.flatMap((proposal) =>
            proposal.terms.kind === 'system' ? [{ ...proposal, terms: proposal.terms }] : []
        )
        const presidencies = systems.filter(
            (proposal, index) =>
                !systems
                    .slice(0, index)
                    .some((earlier) => earlier.terms.president === proposal.terms.president)
        )
        const system =
            presidencies.find(
                (proposal) => !!proposal.option.yielded === this.mergerChoices.yielded
            ) ?? presidencies[0]
        // The player's company buying comes before it being bought.
        const takeovers = pairing.proposals
            .flatMap((proposal) =>
                proposal.terms.kind === 'takeover' ? [{ ...proposal, terms: proposal.terms }] : []
            )
            .toSorted(
                (left, right) => Number(!!left.option.yielded) - Number(!!right.option.yielded)
            )
        return {
            companyId: pairing.companyId,
            partnerId: pairing.partnerId,
            system,
            presidencies,
            takeovers
        }
    })
    /** The only choice, or the one chosen while it is still a choice. */
    private onlyOrChosen(choices: readonly string[], chosen: string | undefined) {
        if (chosen && choices.includes(chosen)) return chosen
        return choices.length === 1 ? choices[0] : undefined
    }
    chooseMergerCompany(companyId: string) {
        this.mergerSelection = stageMergerCompany(
            this.mergerSelection,
            companyId,
            this.mergerCompanyId
        )
    }
    chooseMergerPartner(partnerId: string) {
        this.mergerSelection = stageMergerPartner(
            this.mergerSelection,
            partnerId,
            this.mergerPartnerId
        )
    }
    chooseSystemPresidency(yielded: boolean) {
        this.mergerSelection = stageSystemPresidency(this.mergerSelection, yielded)
    }
    /** The proposal the player is asked to answer, with what it would cost or make. */
    readonly mergerAnswer = $derived.by(() => {
        const decision = this.myMergerDecision
        if (decision?.kind !== 'answer') return undefined
        const { proposal } = decision
        return {
            proposal,
            terms: mergerTerms(this.gameState, proposal, proposal.proposerPlayerId)
        }
    })
    /** The sales the buyer's president may make toward a takeover, by company. */
    readonly takeoverFunding = $derived.by(() => {
        const decision = this.myMergerDecision
        const funding = this.gameState.mergerPhase?.funding
        if (decision?.kind !== 'fund' || !funding) return undefined
        const sales = takeoverSales(this.gameState, funding)
        const companyIds = [...new Set(sales.map((sale) => sale.sales[0].companyId))]
        const payments = takeoverPayments(this.gameState, funding.buyerId, funding.targetId)
        const cash = (owner: Owner) => {
            const amount = cashOwnedBy(this.gameState, owner)
            return typeof amount === 'number' ? amount : 0
        }
        const president = { kind: 'player' as const, playerId: funding.playerId }
        const recorded = this.actions.slice(0, this.gameState.actionCount)
        const firstSale = recorded.findLastIndex((action) => !isSellTakeoverShares(action)) + 1
        return {
            ...funding,
            price: payments.reduce((sum, payment) => sum + payment.amount, 0),
            treasury: cash({ kind: 'company', companyId: funding.buyerId }),
            presidentCash: cash(president),
            ownSharesPaid: payments
                .filter((payment) => sameOwner(payment.to, president))
                .reduce((sum, payment) => sum + payment.amount, 0),
            sold: recorded
                .slice(firstSale)
                .flatMap((action) =>
                    isSellTakeoverShares(action) && action.metadata ? [action.metadata] : []
                ),
            shortfall: takeoverShortfall(
                this.gameState,
                funding.buyerId,
                funding.targetId,
                funding.playerId
            ),
            companies: companyIds.map((companyId) => ({
                companyId,
                sales: sales.filter((sale) => sale.sales[0].companyId === companyId)
            }))
        }
    })
    readonly mergedTrainDiscards = $derived.by(() => {
        const discards =
            this.myMergerDecision?.kind === 'discard'
                ? mergedDiscardTerms(this.gameState, this.myMergerDecision.playerId)
                : undefined
        if (!discards) return undefined
        const definitionIds = [...new Set(discards.trains.map((train) => train.definitionId))]
        return {
            ...discards,
            // Trains of one kind are interchangeable, so each kind is one choice.
            kinds: definitionIds.map((definitionId) => ({
                definitionId,
                trainIds: discards.trains
                    .filter((train) => train.definitionId === definitionId)
                    .map((train) => train.id)
            }))
        }
    })
    private mergedDiscardSelection = $state<MergedDiscardSelection>({})
    /** The kind of train chosen for discard, while it is still a choice. */
    readonly mergedDiscardChoice = $derived(
        this.mergedTrainDiscards?.kinds.find(
            (kind) => kind.definitionId === this.mergedDiscardSelection.kind?.value
        )
    )
    chooseMergedDiscard(definitionId: string) {
        this.mergedDiscardSelection = toggleMergedDiscard(this.mergedDiscardSelection, definitionId)
    }
    async discardChosenMergedTrain(): Promise<void> {
        const discards = this.mergedTrainDiscards
        const trainId = this.mergedDiscardChoice?.trainIds[0]
        assertExists(discards, 'No merged company is over its train limit')
        assertExists(trainId, 'Choose a train to discard')
        await this.discardMergedTrain(discards.companyId, trainId)
    }
    async proposeMerger(option: MergerOption): Promise<void> {
        await this.applyAction(this.createPlayerAction(ProposeMerger, option))
    }
    async passMerger(): Promise<void> {
        await this.applyAction(this.createPlayerAction(PassMerger, {}))
    }
    async answerMerger(accept: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(AnswerMerger, { accept }))
    }
    async sellTakeoverShares(sale: ShareSaleDetails): Promise<void> {
        const [{ companyId, shares }] = sale.sales
        await this.applyAction(this.createPlayerAction(SellTakeoverShares, { companyId, shares }))
    }
    async discardMergedTrain(companyId: string, trainId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(DiscardMergedTrain, { companyId, trainId }))
    }
    readonly revenueTokenChoices = $derived(
        this.myPlayer && !this.isViewingHistory
            ? revenueTokenChoices(this.gameState, this.myPlayer.id)
            : []
    )
    readonly keyWestChoice = $derived(
        this.revenueTokenChoices.find((choice) => choice.kind === 'key-west')
    )
    protected override titleAwaitedDecision(state: HydratedEighteenThirtyTwoState) {
        const names = {
            companyName: (companyId: string) => this.companyName(companyId),
            companyInitials: (companyId: string) => this.companyInitials(companyId),
            playerName: (playerId: string) => this.getPlayerName(playerId),
            money: this.presentation.money
        }
        return this.shareActions.awaitedDecision(state, names) ?? awaitedDecision1832(state, names)
    }
    // The FEC places its Key West token in Miami instead of a station (§7.5).
    override get titleStationActions() {
        const choice = this.keyWestChoice
        return choice && this.canChooseAction
            ? [
                  {
                      id: 'key-west',
                      label: 'Place Key West token in Miami',
                      run: () => this.placeRevenueToken(choice)
                  }
              ]
            : []
    }
    readonly coalRights = new StopRightsActions(this, 'BuyCoalRights', (companyId) =>
        this.createPlayerAction(BuyCoalRights, { companyId })
    )
    readonly londonCompanies = $derived(
        this.myPlayer && this.canChooseAction
            ? londonShareCompanies(this.gameState, this.myPlayer.id)
            : []
    )
    /** What a private lets its owning company do, while that power remains to be used. */
    privateOperationDescription(privateCompanyId: string): string | undefined {
        return revenueTokenUnplaced(this.gameState, privateCompanyId)
            ? PrivateOperatingPowers[privateCompanyId]
            : undefined
    }
    protected override get titlePrivatePowers(): readonly TitlePrivatePower[] {
        const playerId = this.myPlayer?.id
        if (!playerId) return []
        return TokenPrivates.flatMap(({ kind, name }): TitlePrivatePower[] => {
            const choices = this.revenueTokenChoices.filter((choice) => choice.kind === kind)
            if (!choices.length) return []
            return [
                {
                    kind: 'location',
                    privateCompanyId: RevenueTokenPrivateIds[kind],
                    playerId,
                    label: `${name} token`,
                    stationStepLabel: `Place ${name} token`,
                    prompt: `Choose a ${kind === 'port' ? 'coastal' : 'non-coastal'} city for the ${name} token`,
                    locationIds: [...new Set(choices.map((choice) => choice.locationId))],
                    choose: (locationId, nodeId) => this.chooseTokenCity(kind, locationId, nodeId)
                }
            ]
        })
    }
    // In a hex with several cities, such as Atlanta, the city clicked is the choice.
    private async chooseTokenCity(
        kind: 'port' | 'cotton',
        locationId: string,
        nodeId: string | undefined
    ) {
        const cities = this.revenueTokenChoices.filter(
            (choice) => choice.kind === kind && choice.locationId === locationId
        )
        const choice =
            cities.length === 1 ? cities[0] : cities.find((city) => city.nodeId === nodeId)
        if (choice) await this.placeRevenueToken(choice)
    }
    async placeRevenueToken(choice: RevenueTokenChoice): Promise<void> {
        await this.applyAction(this.createPlayerAction(PlaceRevenueToken, choice))
    }
    async takeLondonShare(certificateId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(TakeLondonShare, { certificateId }))
    }
    protected override projectMapState(state: HydratedEighteenThirtyTwoState): HistoricalMapState {
        return mapState1832(state)
    }
}
