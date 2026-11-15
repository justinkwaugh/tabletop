import { assertExists } from '@tabletop/common'
import {
    AnswerTakeover,
    AssignLuxuryFerry,
    BuyFerry,
    OfferTakeover,
    PassTakeover,
    TitleRules1833NE,
    ferryChoices,
    ferryDefinition,
    fewestSwaps,
    luxuryChoices,
    mergedTrainDiscards,
    offerReason,
    redemptionTerms,
    takeoverDecision,
    takeoverTargets,
    unissuedShareIds,
    type HydratedState1833NE,
    type State1833NE
} from '@tabletop/1833ne'
import { DiscardMergedTrain, nextOperatingCompany, sameOwner, type Owner } from '@tabletop/18xx'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import { undoableStagedSelection } from '@tabletop/frontend-components'
import { awaitedTakeover, type TakeoverNames } from './takeovers.js'
import {
    TakeoverStageOrder,
    TurnInStageOrder,
    chosenTurnInKind,
    stageTakeoverSwaps,
    stageTakeoverTarget,
    stageTurnInKind,
    takeoverSwaps,
    takeoverTarget,
    withSwaps,
    type TakeoverSelection,
    type TakeoverSelectionValues,
    type TurnInSelection,
    type TurnInSelectionValues
} from './takeoverSelection.js'
import { MapView1833NE } from './mapView.js'
import { Presentation1833NE } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof State1833NE, HydratedState1833NE>
> = createEighteenXXSessionClass<typeof State1833NE, HydratedState1833NE>(
    TitleRules1833NE,
    MapView1833NE,
    Presentation1833NE,
    createRouteWorker
)

export type FerryOffer = { locationId: string; name: string; value: number }

export class Session1833NE extends BaseSession {
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        // Undo pops the swaps, then the target; then the train kind to turn in.
        this.localSelections.register(
            undoableStagedSelection<TakeoverSelectionValues>(
                TakeoverStageOrder,
                () => this.takeoverSelection,
                (selection) => (this.takeoverSelection = selection)
            )
        )
        this.localSelections.register(
            undoableStagedSelection<TurnInSelectionValues>(
                TurnInStageOrder,
                () => this.turnInSelection,
                (selection) => (this.turnInSelection = selection)
            )
        )
    }
    readonly canChooseAction = $derived(
        this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState &&
            !this.gameState.purchaseOffer &&
            !this.decisions.selection &&
            !this.privateActions.selection
    )
    readonly ferryOffers = $derived.by((): FerryOffer[] =>
        this.validActionTypes.includes('BuyFerry')
            ? ferryChoices(this.gameState).map((locationId) => {
                  const ferry = ferryDefinition(locationId)
                  assertExists(ferry, `Unknown ferry ${locationId}`)
                  return ferry
              })
            : []
    )
    readonly luxuryOffers = $derived.by((): FerryOffer[] =>
        this.validActionTypes.includes('AssignLuxuryFerry')
            ? luxuryChoices(this.gameState).map((locationId) => {
                  const ferry = ferryDefinition(locationId)
                  assertExists(ferry, `Unknown ferry ${locationId}`)
                  return ferry
              })
            : []
    )
    // Buying a ferry is optional, beside track and stations (§6.2 B).
    override get titleOperatingModes() {
        if (this.ferryOffers.length)
            return [{ id: 'ferries', label: 'Buy ferry', shortLabel: 'Ferry' }]
        if (this.luxuryOffers.length)
            return [{ id: 'ferries', label: 'Luxury ferry', shortLabel: 'Luxury' }]
        return []
    }
    private operatingCompanyId(): string {
        const companyId = nextOperatingCompany(this.gameState)
        assertExists(companyId, 'Ferries belong to the operating corporation')
        return companyId
    }
    async buyFerry(locationId: string): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(BuyFerry, { companyId: this.operatingCompanyId(), locationId })
        )
    }
    async assignLuxuryFerry(locationId: string): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(AssignLuxuryFerry, {
                companyId: this.operatingCompanyId(),
                locationId
            })
        )
    }
    readonly takeoverNames: TakeoverNames = {
        companyName: (companyId) => this.companyName(companyId),
        companyInitials: (companyId) => this.companyInitials(companyId),
        playerName: (playerId) => this.getPlayerName(playerId),
        money: this.presentation.money
    }
    /** The takeover step's open decision, and who makes it. */
    readonly takeoverDecision = $derived(takeoverDecision(this.gameState))
    /** The takeover decision when it is this player's. */
    readonly myTakeoverDecision = $derived(
        this.takeoverDecision &&
            !this.isViewingHistory &&
            this.takeoverDecision.playerId === this.myPlayer?.id
            ? this.takeoverDecision
            : undefined
    )
    readonly takeoverCompanyId = $derived(
        this.myTakeoverDecision?.kind === 'offer' ? this.myTakeoverDecision.companyId : undefined
    )
    readonly takeoverTargetIds = $derived(
        this.takeoverCompanyId ? takeoverTargets(this.gameState, this.takeoverCompanyId) : []
    )
    private takeoverSelection = $state<TakeoverSelection>({})
    readonly takeoverTargetId = $derived(
        takeoverTarget(this.takeoverSelection, this.takeoverTargetIds)?.value
    )
    readonly takeoverSwaps = $derived.by(() => {
        const companyId = this.takeoverCompanyId
        const targetId = this.takeoverTargetId
        if (!companyId || !targetId) return []
        return takeoverSwaps(
            this.takeoverSelection,
            fewestSwaps(this.gameState, companyId, targetId) ?? []
        ).value
    })
    readonly takeoverOffer = $derived(
        this.takeoverCompanyId && this.takeoverTargetId
            ? {
                  companyId: this.takeoverCompanyId,
                  targetId: this.takeoverTargetId,
                  swaps: this.takeoverSwaps
              }
            : undefined
    )
    readonly takeoverTerms = $derived(
        this.takeoverOffer ? redemptionTerms(this.gameState, this.takeoverOffer) : undefined
    )
    readonly takeoverOfferReason = $derived(
        this.takeoverOffer ? offerReason(this.gameState, this.takeoverOffer) : undefined
    )
    /** The acquirer's unissued shares, the most it can swap in all. */
    readonly takeoverSwapLimit = $derived(
        this.takeoverCompanyId ? unissuedShareIds(this.gameState, this.takeoverCompanyId).length : 0
    )
    chooseTakeoverTarget(targetId: string) {
        this.takeoverSelection = stageTakeoverTarget(
            this.takeoverSelection,
            targetId,
            this.takeoverTargetId
        )
    }
    setTakeoverSwaps(holder: Owner, shares: number) {
        const holding = this.takeoverTerms?.holdings.find((entry) =>
            sameOwner(entry.holder, holder)
        )
        assertExists(holding, 'Only a holder of the target swaps shares')
        const others = this.takeoverSwaps
            .filter((swap) => !sameOwner(swap.holder, holder))
            .reduce((sum, swap) => sum + swap.shares, 0)
        const clamped = Math.max(
            0,
            Math.min(shares, holding.maximumSwaps, this.takeoverSwapLimit - others)
        )
        this.takeoverSelection = stageTakeoverSwaps(
            this.takeoverSelection,
            withSwaps(this.takeoverSwaps, holder, clamped)
        )
    }
    async offerTakeover(): Promise<void> {
        const offer = this.takeoverOffer
        assertExists(offer, 'Choose a corporation to take over')
        await this.applyAction(this.createPlayerAction(OfferTakeover, offer))
    }
    async passTakeover(): Promise<void> {
        const companyId = this.takeoverCompanyId
        assertExists(companyId, 'No corporation is deciding on a takeover')
        await this.applyAction(this.createPlayerAction(PassTakeover, { companyId }))
    }
    /** The offer this player is asked to accept or refuse. */
    readonly takeoverAnswer = $derived(
        this.myTakeoverDecision?.kind === 'answer' ? this.myTakeoverDecision.offer : undefined
    )
    async answerTakeover(accept: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(AnswerTakeover, { accept }))
    }
    readonly takeoverTurnIns = $derived.by(() => {
        const decision = this.myTakeoverDecision
        const discards =
            decision?.kind === 'discard'
                ? mergedTrainDiscards(this.gameState, decision.playerId)
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
    private turnInSelection = $state<TurnInSelection>({})
    readonly turnInChoice = $derived(
        this.takeoverTurnIns?.kinds.find(
            (kind) => kind.definitionId === chosenTurnInKind(this.turnInSelection)
        )
    )
    chooseTurnIn(definitionId: string) {
        this.turnInSelection = stageTurnInKind(this.turnInSelection, definitionId)
    }
    async turnInChosenTrain(): Promise<void> {
        const turnIns = this.takeoverTurnIns
        const trainId = this.turnInChoice?.trainIds[0]
        assertExists(turnIns, 'No acquirer is over its train limit')
        assertExists(trainId, 'Choose a train to turn in')
        await this.applyAction(
            this.createPlayerAction(DiscardMergedTrain, { companyId: turnIns.companyId, trainId })
        )
    }
    protected override titleAwaitedDecision(state: HydratedState1833NE) {
        return awaitedTakeover(state, this.takeoverNames)
    }
}
