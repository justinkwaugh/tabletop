import { GameSession } from '@tabletop/frontend-components'
import { assertExists, type GameAction } from '@tabletop/common'
import {
    ActionType,
    BringVisitors,
    ConfirmTurn,
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
    setMarracashQueueEnd,
    setMarracashRefill,
    setMarracashSelection,
    type MarracashSelection,
    type MarracashSelectionValues
} from './stagedSelection.js'
import { marketPalettes } from '$lib/utils/marketColors.js'
import { latestTurnStep, moneyReports, type MoneyReport } from '$lib/utils/moneyReport.js'
import type { RefillChoice } from '$lib/utils/queueChoices.js'
import type { VisitorWalker } from '$lib/animators/visitorMoveAnimator.js'
import { historyHighlightFor, type HistoryHighlight } from '$lib/utils/historyHighlight.js'

const QueueWarningSeconds = 4

export type CustomerHighlight = { playerId: string; color: MarketColor }

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

    historyHighlight: HistoryHighlight | undefined = $state(undefined)
    customerHighlight: CustomerHighlight | undefined = $state(undefined)

    readonly moneyReports: MoneyReport[] = $derived(moneyReports(latestTurnStep(this.actions)))

    private readonly canAct = $derived(this.isPlayable && !this.isViewingHistory && this.isMyTurn)

    readonly canMove = $derived(
        this.canAct && this.validActionTypes.includes(ActionType.MoveVisitors)
    )
    readonly canAuction = $derived(
        this.canAct && this.validActionTypes.includes(ActionType.StartAuction)
    )
    readonly canBid = $derived(this.canAct && this.validActionTypes.includes(ActionType.PlaceBid))
    readonly canRefill = $derived(
        this.canAct && this.validActionTypes.includes(ActionType.BringVisitors)
    )
    readonly canConfirm = $derived(
        this.canAct && this.validActionTypes.includes(ActionType.ConfirmTurn)
    )
    // Local choices wait while the session is busy: a choice staged mid-transition would be
    // cleared as the new state publishes.
    private readonly canChooseMove = $derived(this.canMove && !this.busy)
    private readonly canChooseShop = $derived(this.canAuction && !this.busy)
    readonly canChooseRefill = $derived(this.canRefill && !this.busy)

    readonly canUndoAction = $derived(
        this.isPlayable && !this.isViewingHistory && this.undoableAction !== undefined
    )

    readonly selectedFountainId: FountainId | undefined = $derived(
        this.canChooseMove ? this.selection.fountain?.value : undefined
    )

    readonly selectedShopId: ShopId | undefined = $derived(
        this.canChooseShop ? this.selection.shop?.value : undefined
    )

    readonly movableFountainIds: FountainId[] = $derived(
        this.canChooseMove &&
            this.selectedShopId === undefined &&
            this.selectedFountainId === undefined
            ? this.gameState.fountains
                  .filter((fountain) => fountain.visitors.length > 0)
                  .map((fountain) => fountain.fountainId)
            : []
    )

    readonly auctionableShopIds: ShopId[] = $derived(
        this.canChooseShop &&
            this.selectedFountainId === undefined &&
            this.selectedShopId === undefined
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
        this.canChooseRefill ? this.selection.queueEnd?.value : undefined
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
        return this.selection.visitorCount?.value
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

    showQueueTooShort = $derived.by<boolean>(() => {
        void this.updatingVisibleState
        void this.canRefill
        return false
    })
    private queueWarningTimer: ReturnType<typeof setTimeout> | undefined

    readonly fillableEntranceIds: FountainId[] = $derived(
        this.chosenQueueEnd === undefined || this.chosenVisitorCount === undefined
            ? []
            : this.refillEntranceIds
    )

    myMoney(): number {
        assertExists(this.myPlayer, 'Only a seated player has money to show')
        return this.gameState.getPlayerState(this.myPlayer.id).getMoney()
    }

    visibleMoney(playerId: string): number | undefined {
        const concealed =
            this.primaryGame.config?.concealedCash === true &&
            playerId !== this.myPlayer?.id &&
            this.gameState.result === undefined
        return concealed ? undefined : this.gameState.getPlayerState(playerId).money
    }

    myMinimumBid(): number {
        assertExists(this.myPlayer, 'Only a seated player can bid')
        return this.gameState.minimumBid(this.myPlayer.id)
    }

    override beforeNewState() {
        this.resetAction()
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

    back() {
        if (this.busy) return
        if (this.hasManualSelection) {
            this.selection = popMarracashSelection(this.selection)
        }
    }

    highlightHistory(action: GameAction | undefined) {
        this.historyHighlight = action === undefined ? undefined : historyHighlightFor(action)
    }

    highlightCustomers(highlight: CustomerHighlight | undefined) {
        this.customerHighlight = highlight
    }

    resetAction() {
        this.selection = {}
    }

    selectFountain(fountainId: FountainId | undefined) {
        this.setSelection('fountain', fountainId)
    }

    chooseQueueEnd(end: QueueEnd) {
        if (this.busy) return
        this.selection = setMarracashQueueEnd(this.selection, end)
    }

    chooseVisitorCount(count: number) {
        this.setSelection('visitorCount', count)
    }

    chooseRefill(choice: RefillChoice) {
        if (this.busy) return
        this.hideQueueTooShort()
        this.selection = setMarracashRefill(this.selection, choice.end, choice.count)
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

    chooseShopToAuction(shopId: ShopId) {
        this.setSelection('shop', shopId)
    }

    async startAuction() {
        const shopId = this.selectedShopId
        assertExists(shopId, 'Starting an auction requires a chosen shop')
        await this.applyAction(this.createPlayerAction(StartAuction, { shopId }))
    }

    async confirmTurn() {
        await this.applyAction(this.createPlayerAction(ConfirmTurn, {}))
    }

    async placeBid(amount: number) {
        await this.applyAction(
            this.createPlayerAction(PlaceBid, {
                amount,
                simultaneousGroupId: this.gameState.auction?.id
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

    private setSelection<TStage extends keyof MarracashSelectionValues>(
        stage: TStage,
        value: MarracashSelectionValues[TStage] | undefined
    ) {
        if (this.busy) return
        this.selection = setMarracashSelection(this.selection, stage, value)
    }
}
