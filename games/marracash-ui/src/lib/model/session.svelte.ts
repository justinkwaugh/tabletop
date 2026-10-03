import { GameSession } from '@tabletop/frontend-components'
import { assertExists } from '@tabletop/common'
import {
    ActionType,
    BringVisitors,
    isValidVisitorCount,
    MaxVisitorsBroughtIn,
    MoveVisitors,
    PlaceBid,
    routesFrom,
    StartAuction,
    type FountainId,
    type HydratedMarracashGameState,
    type MarracashProjectedState,
    QueueEnd,
    type Route,
    type ShopId
} from '@tabletop/marracash'
import {
    hasManualMarracashSelection,
    popMarracashSelection,
    setMarracashQueueEnd,
    setMarracashSelection,
    type MarracashSelection,
    type MarracashSelectionValues
} from './stagedSelection.js'
import { marketPalettes } from '$lib/utils/marketColors.js'

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

    readonly selectedFountainId: FountainId | undefined = $derived(
        this.canMove ? this.selection.fountain?.value : undefined
    )

    readonly selectedShopId: ShopId | undefined = $derived(
        this.canAuction ? this.selection.shop?.value : undefined
    )

    readonly movableFountainIds: FountainId[] = $derived(
        this.canMove && this.selectedShopId === undefined && this.selectedFountainId === undefined
            ? this.gameState.fountains
                  .filter((fountain) => fountain.visitors.length > 0)
                  .map((fountain) => fountain.fountainId)
            : []
    )

    readonly auctionableShopIds: ShopId[] = $derived(
        this.canAuction &&
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
        this.canRefill ? this.selection.queueEnd?.value : undefined
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
        if (!this.canRefill || this.chosenQueueEnd === undefined) return undefined
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
        this.canRefill ? this.gameState.emptyEntranceIds() : []
    )

    readonly fillableEntranceIds: FountainId[] = $derived(
        this.chosenVisitorCount === undefined ? [] : this.refillEntranceIds
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
        if (this.hasManualSelection) {
            this.selection = popMarracashSelection(this.selection)
        }
    }

    resetAction() {
        this.selection = {}
    }

    selectFountain(fountainId: FountainId | undefined) {
        this.setSelection('fountain', fountainId)
    }

    chooseQueueEnd(end: QueueEnd) {
        this.selection = setMarracashQueueEnd(this.selection, end)
    }

    chooseVisitorCount(count: number) {
        this.setSelection('visitorCount', count)
    }

    chooseShopToAuction(shopId: ShopId) {
        this.setSelection('shop', shopId)
    }

    async startAuction() {
        const shopId = this.selectedShopId
        assertExists(shopId, 'Starting an auction requires a chosen shop')
        await this.applyAction(this.createPlayerAction(StartAuction, { shopId }))
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
        this.selection = setMarracashSelection(this.selection, stage, value)
    }
}
