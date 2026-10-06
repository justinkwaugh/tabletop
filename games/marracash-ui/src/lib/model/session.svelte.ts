import { GameSession } from '@tabletop/frontend-components'
import { assertExists, type GameAction } from '@tabletop/common'
import {
    ActionType,
    BringVisitors,
    isValidVisitorCount,
    type MarketColor,
    MaxVisitorsBroughtIn,
    MoveVisitors,
    PlaceBid,
    routesFrom,
    StartAuction,
    type FountainId,
    type FountainState,
    type HydratedMarracashGameState,
    type MarracashProjectedState,
    QueueEnd,
    type Route,
    type ShopId,
    type ShopState
} from '@tabletop/marracash'
import {
    hasManualMarracashSelection,
    popMarracashSelection,
    setMarracashSelection,
    updateMarracashRefill,
    type MarracashSelection,
    type MarracashSelectionValues,
    type RefillDraft
} from './stagedSelection.js'
import { marketPalettes } from '$lib/utils/marketColors.js'
import {
    isOutcomeReport,
    latestTurnStep,
    moneyReports,
    type MoneyReport,
    type OutcomeReport
} from '$lib/utils/moneyReport.js'
import type { RefillChoice } from '$lib/utils/queueChoices.js'
import type { VisitorWalker } from '$lib/animators/visitorMoveAnimator.js'
import { historyHighlightFor, type HistoryHighlight } from '$lib/utils/historyHighlight.js'

const QueueWarningSeconds = 4

export type CustomerHighlight = { playerId: string; color: MarketColor }

type BidDraft = { auctionId: string; playerId: string; amount: number }

export class MarracashGameSession extends GameSession<
    MarracashProjectedState,
    HydratedMarracashGameState
> {
    private selection: MarracashSelection = $state({})
    readonly hasManualSelection = $derived(hasManualMarracashSelection(this.selection))
    readonly canUndo = $derived(
        this.isPlayable &&
            !this.isViewingHistory &&
            (this.hasManualSelection || Boolean(this.undoableAction))
    )

    readonly marketPalettes = $derived(marketPalettes(this.colors.colorBlind))

    movingVisitors: VisitorWalker[] = $state([])
    fountainVisitorOverrides: Partial<Record<FountainId, MarketColor[]>> = $state({})
    shopCustomerOverrides: Partial<Record<ShopId, number>> = $state({})

    readonly visibleFountains: FountainState[] = $derived(
        this.gameState.fountains.map((fountain) => {
            const visitors = this.fountainVisitorOverrides[fountain.fountainId]
            return visitors === undefined ? fountain : { ...fountain, visitors }
        })
    )
    readonly visibleShops: ShopState[] = $derived(
        this.gameState.shops.map((shop) => {
            const customers = this.shopCustomerOverrides[shop.shopId]
            return customers === undefined ? shop : { ...shop, customers }
        })
    )

    private highlightedHistoryAction: GameAction | undefined = $state.raw(undefined)
    readonly highlightedHistoryActionId = $derived(this.highlightedHistoryAction?.id)
    readonly historyHighlight: HistoryHighlight | undefined = $derived(
        this.highlightedHistoryAction === undefined
            ? undefined
            : historyHighlightFor(this.highlightedHistoryAction)
    )
    customerHighlight: CustomerHighlight | undefined = $state(undefined)
    playerAidOpen = $state(false)
    private bidDraft: BidDraft | undefined = $state(undefined)
    readonly draftBid: number | undefined = $derived.by(() => {
        const draft = this.bidDraft
        return draft !== undefined &&
            draft.auctionId === this.gameState.auction?.bidding.id &&
            draft.playerId === this.myPlayer?.id
            ? draft.amount
            : undefined
    })

    readonly moneyReports: MoneyReport[] = $derived(moneyReports(latestTurnStep(this.actions)))

    private readonly canAct = $derived(this.isPlayable && !this.isViewingHistory && this.isMyTurn)

    readonly canMove = $derived(this.canTake(ActionType.MoveVisitors))
    readonly canAuction = $derived(this.canTake(ActionType.StartAuction))
    readonly canBid = $derived(this.canTake(ActionType.PlaceBid))
    readonly canRefill = $derived(this.canTake(ActionType.BringVisitors))
    // A choice staged mid-transition would be cleared as the new state publishes.
    private readonly canChooseMove = $derived(this.canMove && !this.busy)
    private readonly canChooseShop = $derived(this.canAuction && !this.busy)
    readonly canChooseRefill = $derived(this.canRefill && !this.busy)

    readonly selectedFountainId: FountainId | undefined = $derived(
        this.canChooseMove ? this.selection.fountain?.value : undefined
    )

    readonly movableFountainIds: FountainId[] = $derived(
        this.canChooseMove && this.selectedFountainId === undefined
            ? this.gameState.fountains
                  .filter((fountain) => fountain.visitors.length > 0)
                  .map((fountain) => fountain.fountainId)
            : []
    )

    readonly finalTurnPlayerId: string | undefined = $derived(this.gameState.finalTurnPlayerId())

    readonly outcomes: OutcomeReport[] = $derived(this.moneyReports.filter(isOutcomeReport))

    readonly auctionableShopIds: ShopId[] = $derived(
        this.canChooseShop && this.selectedFountainId === undefined
            ? this.gameState.shops
                  .filter((shop) => shop.ownerId === undefined)
                  .map((shop) => shop.shopId)
            : []
    )

    readonly selectedRoutes: readonly Route[] = $derived(
        this.selectedFountainId === undefined ? [] : routesFrom(this.selectedFountainId)
    )

    readonly destinationFountainIds: FountainId[] = $derived(
        this.selectedRoutes.map((route) => route.to)
    )

    readonly chosenQueueEnd: QueueEnd | undefined = $derived(
        this.canChooseRefill ? this.selection.refill?.value.end : undefined
    )

    readonly visitorCountOptions: number[] = $derived.by(() => {
        const queueLength = this.gameState.queue.length
        const counts: number[] = []
        for (let count = 1; count <= MaxVisitorsBroughtIn; count++) {
            if (isValidVisitorCount(count, queueLength)) counts.push(count)
        }
        return counts
    })

    readonly chosenVisitorCount: number | undefined = $derived.by(() => {
        if (!this.canChooseRefill) return undefined
        if (this.visitorCountOptions.length === 1) return this.visitorCountOptions[0]
        return this.selection.refill?.value.count
    })

    readonly incomingQueueIndices: ReadonlySet<number> = $derived.by(() => {
        const end = this.chosenQueueEnd
        const count = this.chosenVisitorCount
        if (end === undefined || count === undefined) return new Set()
        const first = end === QueueEnd.Front ? 0 : this.gameState.queue.length - count
        return new Set(Array.from({ length: count }, (_, offset) => first + offset))
    })

    readonly refillEntranceIds: FountainId[] = $derived(
        this.canChooseRefill ? this.gameState.emptyEntranceIds() : []
    )

    showQueueTooShort = $state(false)
    private queueWarningTimer: ReturnType<typeof setTimeout> | undefined

    readonly fillableEntranceIds: FountainId[] = $derived(
        this.chosenQueueEnd === undefined || this.chosenVisitorCount === undefined
            ? []
            : this.refillEntranceIds
    )

    // Hidden cash can't be sampled, so only Host View, which explores the full state, may explore.
    override get canExplore(): boolean {
        return (
            (this.explorationPerspective() === undefined ||
                this.game.config?.concealedCash !== true) &&
            super.canExplore
        )
    }

    myMoney(): number {
        assertExists(this.myPlayer, 'Only a seated player has money to show')
        return this.gameState.getPlayerState(this.myPlayer.id).getMoney()
    }

    visibleMoney(playerId: string): number | undefined {
        const visible = this.gameState.isMoneyVisibleTo(
            this.myPlayer?.id,
            playerId,
            this.primaryGame.config
        )
        return visible ? this.gameState.getPlayerState(playerId).money : undefined
    }

    myMinimumBid(): number {
        assertExists(this.myPlayer, 'Only a seated player can bid')
        return this.gameState.minimumBid(this.myPlayer.id)
    }

    override beforeNewState() {
        this.resetAction()
        this.highlightedHistoryAction = undefined
        this.fountainVisitorOverrides = {}
        this.shopCustomerOverrides = {}
    }

    override async undo() {
        if (!this.canUndo || this.busy) return
        if (this.hasManualSelection) {
            this.selection = popMarracashSelection(this.selection)
            return
        }
        await super.undo()
    }

    highlightHistory(action: GameAction | undefined) {
        this.highlightedHistoryAction = action
    }

    toggleHistoryHighlight(action: GameAction) {
        this.highlightedHistoryAction =
            this.highlightedHistoryActionId === action.id ? undefined : action
    }

    highlightCustomers(highlight: CustomerHighlight | undefined) {
        this.customerHighlight = highlight
    }

    toggleCustomerHighlight(highlight: CustomerHighlight) {
        const current = this.customerHighlight
        const same = current?.playerId === highlight.playerId && current?.color === highlight.color
        this.customerHighlight = same ? undefined : highlight
    }

    setDraftBid(amount: number) {
        const auction = this.gameState.auction
        assertExists(auction, 'A draft bid needs an open auction')
        assertExists(this.myPlayer, 'Only a seated player can bid')
        this.bidDraft = { auctionId: auction.bidding.id, playerId: this.myPlayer.id, amount }
    }

    togglePlayerAid() {
        this.playerAidOpen = !this.playerAidOpen
    }

    closePlayerAid() {
        this.playerAidOpen = false
    }

    resetAction() {
        this.selection = {}
        this.hideQueueTooShort()
    }

    selectFountain(fountainId: FountainId | undefined) {
        this.setSelection('fountain', fountainId)
    }

    chooseQueueEnd(end: QueueEnd) {
        this.updateRefill({ end })
    }

    chooseVisitorCount(count: number) {
        this.updateRefill({ count })
    }

    chooseRefill(choice: RefillChoice) {
        if (this.busy) return
        this.hideQueueTooShort()
        this.updateRefill({ end: choice.end, count: choice.count })
    }

    warnQueueTooShort() {
        this.hideQueueTooShort()
        this.showQueueTooShort = true
        this.queueWarningTimer = setTimeout(
            () => this.hideQueueTooShort(),
            QueueWarningSeconds * 1000
        )
    }

    private hideQueueTooShort() {
        clearTimeout(this.queueWarningTimer)
        this.showQueueTooShort = false
    }

    async startAuction(shopId: ShopId) {
        if (this.busy) return
        await this.applyAction(this.createPlayerAction(StartAuction, { shopId }))
    }

    async placeBid(amount: number) {
        await this.applyAction(
            this.createPlayerAction(PlaceBid, {
                amount,
                simultaneousGroupId: this.gameState.auction?.bidding.id
            })
        )
    }

    async moveVisitorsTo(destinationId: FountainId) {
        const fountainId = this.selectedFountainId
        assertExists(fountainId, 'Moving visitors requires a selected fountain')
        const route = this.selectedRoutes.find((candidate) => candidate.to === destinationId)
        assertExists(route, `No route from fountain ${fountainId} reaches ${destinationId}`)
        await this.applyAction(
            this.createPlayerAction(MoveVisitors, { fountainId, direction: route.direction })
        )
    }

    async bringVisitorsTo(entranceId: FountainId) {
        const end = this.chosenQueueEnd
        const count = this.chosenVisitorCount
        assertExists(end, 'Bringing visitors requires a chosen queue end')
        assertExists(count, 'Bringing visitors requires a chosen visitor count')
        await this.applyAction(this.createPlayerAction(BringVisitors, { end, count, entranceId }))
    }

    private canTake(type: ActionType): boolean {
        return this.canAct && this.validActionTypes.includes(type)
    }

    private updateRefill(change: RefillDraft) {
        if (this.busy) return
        this.selection = updateMarracashRefill(this.selection, change)
    }

    private setSelection<TStage extends keyof MarracashSelectionValues>(
        stage: TStage,
        value: MarracashSelectionValues[TStage] | undefined
    ) {
        if (this.busy) return
        this.selection = setMarracashSelection(this.selection, stage, value)
    }
}
