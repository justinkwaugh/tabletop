import { GameSession, type PresentedTransition } from '@tabletop/frontend-components'
import { assert, assertExists } from '@tabletop/common'
import {
    ActionType,
    BuyShare,
    EndTurn,
    PayRepairs,
    PlaceTrack,
    SaleListRefusal,
    ScrapTrack,
    SellShare,
    buyShareRefusal,
    endTurnRefusal,
    hasOpenSpace,
    normalizePromontoryPointConfig,
    payRepairsRefusal,
    saleListRefusal,
    scrapTrackRefusal,
    sellShareRefusal,
    type HydratedPromontoryPointGameState,
    type PromontoryPointProjectedState,
    type RailroadId,
    type SpaceId,
    type TradeRefusal
} from '@tabletop/promontory-point'
import { boardOffer, OfferView, type BoardOffer } from './boardOffer.js'
import { CardPreview } from './cardPreview.svelte.js'
import {
    emptyRepairsDraft,
    everySaleStartingWith,
    hasManualRepairsDraft,
    popRepairsDraft,
    repairsDraftView,
    stageEverySale,
    stageSale,
    stagedSales,
    type RepairsDecision,
    type RepairsDraft,
    type RepairsDraftView
} from './repairsDraft.js'
import {
    repairsPlacementBeingDecided,
    repairsTownBeingDecided,
    thisTurnPlacements
} from './thisTurn.js'
import {
    emptyTurnDraft,
    piecePick,
    popTurnDraft,
    pressPiece,
    type PiecePick,
    type TurnDraft
} from './turnDraft.js'

export class PromontoryPointGameSession extends GameSession<
    PromontoryPointProjectedState,
    HydratedPromontoryPointGameState
> {
    private turnDraft: TurnDraft = $state(emptyTurnDraft())

    readonly cardPreview = new CardPreview()

    // A hand piece's pointer hover or keyboard focus; never set by touch.
    hoveredPiece: RailroadId | undefined = $state()

    // R-X.1: the seat on screen when it is the one the state asks to decide.
    decidingPlayerId: string | undefined = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return !this.isViewingHistory &&
            playerId !== undefined &&
            this.gameState.activePlayerIds.includes(playerId)
            ? playerId
            : undefined
    })

    fourPieceVariant: boolean = $derived(
        normalizePromontoryPointConfig(this.game.config).fourPieceVariant
    )

    // R-2.2 step 1, R-3.3-H1: the revealed turn pieces still to place.
    handPieces: RailroadId[] = $derived(this.gameState.turn?.pieces ?? [])

    private canPlaceTrack = $derived(this.validActionTypes.includes(ActionType.PlaceTrack))

    private canScrapTrack = $derived(this.validActionTypes.includes(ActionType.ScrapTrack))

    // R-3.3, R-3.3-H1: a piece with a legal hex to place on, or with no room and a placement left.
    pickablePieces: RailroadId[] = $derived.by(() => {
        const playerId = this.decidingPlayerId
        if (playerId === undefined || (!this.canPlaceTrack && !this.canScrapTrack)) {
            return []
        }
        return [...new Set(this.handPieces)].filter((railroadId) =>
            hasOpenSpace(this.gameState.track, railroadId)
                ? this.canPlaceTrack
                : this.canScrapTrack &&
                  scrapTrackRefusal(this.gameState, playerId, railroadId) === undefined
        )
    })

    // O-2: the picked piece while it is still in hand and may be placed or set aside.
    piecePick: PiecePick | undefined = $derived(
        piecePick(this.turnDraft, this.pickablePieces, this.handPieces)
    )

    pickedPiece: RailroadId | undefined = $derived(this.piecePick?.railroadId)

    // R-3.3: the picked piece has no legal hex, so the only way on is to scrap it.
    pickedPieceHasNoRoom: boolean = $derived(
        this.pickedPiece !== undefined && !hasOpenSpace(this.gameState.track, this.pickedPiece)
    )

    // R-4.3: staged sales, tied to the debtor and the placement whose Repairs they answer.
    private stagedRepairs: { stepKey: string; draft: RepairsDraft } | undefined = $state()

    // R-4.3-H4, R-X.1: the Repairs step when the seat on screen is the debtor deciding it.
    private repairsStep: { key: string; decision: RepairsDecision } | undefined = $derived.by(
        () => {
            const playerId = this.decidingPlayerId
            const pending = this.gameState.pendingRepairs
            const debtor = pending?.debtors[0]
            if (pending === undefined || debtor === undefined || debtor.playerId !== playerId) {
                return undefined
            }
            const placement = repairsPlacementBeingDecided(this.gameState, this.actions)
            return {
                key: `${debtor.playerId}:${placement?.id}`,
                decision: {
                    railroadId: pending.railroadId,
                    owed: debtor.owed,
                    holdings: this.gameState.getPlayerState(debtor.playerId),
                    priceIndex: this.gameState.priceIndex
                }
            }
        }
    )

    // R-4.3: the staged sales while their step is the one on screen and every share is still held.
    private liveRepairsDraft: RepairsDraft = $derived.by(() => {
        const step = this.repairsStep
        const staged = this.stagedRepairs
        if (step === undefined || staged === undefined || staged.stepKey !== step.key) {
            return emptyRepairsDraft()
        }
        const { holdings, owed, priceIndex } = step.decision
        return saleListRefusal(holdings, owed, priceIndex, stagedSales(staged.draft)) ===
            SaleListRefusal.NotHeld
            ? emptyRepairsDraft()
            : staged.draft
    })

    // R-4.3, R-4.3-H1 to H3: the deciding debtor's draft, running line and send.
    repairsDraft: RepairsDraftView | undefined = $derived.by(() => {
        const step = this.repairsStep
        return step === undefined
            ? undefined
            : repairsDraftView(step.decision, stagedSales(this.liveRepairsDraft))
    })

    private hasStagedRepairsSale: boolean = $derived(hasManualRepairsDraft(this.liveRepairsDraft))

    hasManualSelection: boolean = $derived(
        this.piecePick?.source === 'manual' || this.hasStagedRepairsSale
    )

    // R-X.2: Undo pops a manual pick, else undoes the Undo Candidate; a draw leaves no candidate.
    canUndo: boolean = $derived(
        !this.isViewingHistory && (this.hasManualSelection || this.undoableAction !== undefined)
    )

    boardOffer: BoardOffer = $derived.by(() => {
        const picked = this.pickedPiece
        const decidingPlayerId = this.decidingPlayerId
        return boardOffer({
            state: this.gameState,
            view: this.updatingVisibleState
                ? OfferView.Updating
                : this.isViewingHistory
                  ? OfferView.History
                  : OfferView.Live,
            placing:
                picked !== undefined && decidingPlayerId !== undefined && this.canPlaceTrack
                    ? { railroadId: picked, decidingPlayerId }
                    : undefined,
            hovered: this.hoveredPiece,
            placements: thisTurnPlacements(this.gameState, this.actions),
            repairsTown: repairsTownBeingDecided(this.gameState, this.actions)
        })
    })

    pressPiece(railroadId: RailroadId) {
        assert(
            this.pickablePieces.includes(railroadId),
            `${railroadId} is not a piece the seat may pick now`
        )
        if (this.piecePick?.source === 'auto' && this.piecePick.railroadId === railroadId) {
            return
        }
        this.turnDraft = pressPiece(this.turnDraft, railroadId)
    }

    hoverPiece(railroadId: RailroadId | undefined) {
        this.hoveredPiece = railroadId
    }

    // R-3.1, R-2.2, R-2.2-H1: undefined when the seat may buy one now.
    buyRefusal(railroadId: RailroadId): TradeRefusal | undefined {
        const playerId = this.decidingPlayerId
        return playerId === undefined
            ? undefined
            : buyShareRefusal(this.gameState, playerId, railroadId)
    }

    // R-3.2, R-3.2-H1, R-2.2, R-2.2-H1: undefined when the seat may sell one now.
    sellRefusal(railroadId: RailroadId): TradeRefusal | undefined {
        const playerId = this.decidingPlayerId
        return playerId === undefined
            ? undefined
            : sellShareRefusal(this.gameState, playerId, railroadId)
    }

    override async undo() {
        const step = this.repairsStep
        if (this.hasStagedRepairsSale && step !== undefined) {
            this.stagedRepairs = {
                stepKey: step.key,
                draft: popRepairsDraft(this.liveRepairsDraft)
            }
            return
        }
        if (this.hasManualSelection) {
            this.turnDraft = popTurnDraft(this.turnDraft)
            return
        }
        await super.undo()
    }

    // The turn draft lives until the next shown state, whatever brought it; the Repairs draft
    // survives a reconciliation, and its step key drops it once the step or the debtor changes.
    override beforeNewState(transition: PresentedTransition) {
        this.turnDraft = emptyTurnDraft()
        if (transition.kind !== 'reconciliation') {
            this.stagedRepairs = undefined
        }
    }

    // R-4.3, R-4.3-H2: Sell one stages one more share; R-4.3-H3: short after every sale, one
    // press stages them all.
    stageRepairsSale(railroadId: RailroadId) {
        const step = this.repairsStep
        const view = this.repairsDraft
        assertExists(step, 'Only the deciding debtor stages a sale')
        assertExists(view, 'Only the deciding debtor stages a sale')
        const entry = view.entries.find((held) => held.railroadId === railroadId)
        assertExists(entry, `The debtor holds no ${railroadId} share to sell`)
        assert(!entry.locked, `Sell ${railroadId} is locked`)
        this.stagedRepairs = {
            stepKey: step.key,
            draft: view.shortAfterEverySale
                ? stageEverySale(everySaleStartingWith(step.decision.holdings.shares, railroadId))
                : stageSale(this.liveRepairsDraft, railroadId)
        }
    }

    // R-4.3, R-X.1: the debtor's own press sends the staged sales, even a forced payment.
    async sendRepairs() {
        const view = this.repairsDraft
        assertExists(view, 'Only the deciding debtor sends a Repairs payment')
        assert(view.send.ready, 'The send is offered only for a legal sale list')
        await this.payRepairs(view.send.sales)
    }

    // R-3.1
    async buyShare(railroadId: RailroadId) {
        if (this.decidingPlayerId === undefined || this.buyRefusal(railroadId) !== undefined) {
            return
        }
        await this.applyAction(this.createPlayerAction(BuyShare, { railroadId }))
    }

    // R-3.2, R-3.2-H1
    async sellShare(railroadId: RailroadId) {
        if (this.decidingPlayerId === undefined || this.sellRefusal(railroadId) !== undefined) {
            return
        }
        await this.applyAction(this.createPlayerAction(SellShare, { railroadId }))
    }

    // R-3.3: a press on a lit hex sends; a press on an unlit hex places nothing.
    async placeTrack(spaceId: SpaceId) {
        const railroadId = this.pickedPiece
        assertExists(railroadId, 'A hex is pressed to place only once a piece is picked')
        if (!this.boardOffer.lit.includes(spaceId)) {
            return
        }
        this.turnDraft = emptyTurnDraft()
        await this.applyAction(this.createPlayerAction(PlaceTrack, { railroadId, spaceId }))
    }

    // R-3.3, R-3.3-H1, R-2.2-H2
    async scrapTrack() {
        const railroadId = this.pickedPiece
        assertExists(railroadId, 'A piece is set aside only once it is picked')
        assert(this.pickedPieceHasNoRoom, `${railroadId} has a legal hex, so it is placed`)
        this.turnDraft = emptyTurnDraft()
        await this.applyAction(this.createPlayerAction(ScrapTrack, { railroadId }))
    }

    // R-2.2 step 4, R-6.3: `returnKeptPiece` only in the variant with a piece left over.
    async endTurn(returnKeptPiece?: boolean) {
        const playerId = this.decidingPlayerId
        assertExists(playerId, 'Only the deciding seat ends its turn')
        assert(
            endTurnRefusal(this.gameState, playerId, returnKeptPiece, this.fourPieceVariant) ===
                undefined,
            'End turn is offered only when it may be sent'
        )
        await this.applyAction(
            this.createPlayerAction(
                EndTurn,
                returnKeptPiece === undefined ? {} : { returnKeptPiece }
            )
        )
    }

    // R-4.3, R-4.3-H1 to H4: the first debtor's sales, in order.
    async payRepairs(sales: RailroadId[]) {
        const playerId = this.decidingPlayerId
        assertExists(playerId, 'Only the deciding debtor pays')
        assert(
            payRepairsRefusal(this.gameState, playerId, sales) === undefined,
            'A Repairs payment is sent only with a legal sale list'
        )
        this.stagedRepairs = undefined
        await this.applyAction(this.createPlayerAction(PayRepairs, { sales }))
    }
}
