import { AnimationContext, GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    HydratedFreshFishGameState,
    PlaceDisk,
    DrawTile,
    PlaceBid,
    PlaceStall,
    type FreshFishGameState,
    GoodsType,
    PlaceMarket,
    isDrawTile,
    isMarketTile,
    Expropriator,
    isPlaceDisk,
    isPlaceMarket,
    isPlaceStall
} from '@tabletop/fresh-fish'
import { OffsetTupleCoordinates, type GameAction } from '@tabletop/common'
import {
    hasManualFreshFishSelection,
    isActionType,
    popFreshFishSelection,
    setFreshFishSelection,
    type FreshFishSelection
} from '../model/stagedSelection.js'

export class FreshFishGameSession extends GameSession<
    FreshFishGameState,
    HydratedFreshFishGameState
> {
    private selection: FreshFishSelection = $state({})
    private automaticAction = $derived(
        this.isMyTurn &&
            this.validActionTypes.length === 1 &&
            this.validActionTypes[0] !== ActionType.DrawTile
            ? this.validActionTypes[0]
            : undefined
    )

    get chosenAction(): string | undefined {
        return this.selection.action?.value ?? this.automaticAction
    }

    set chosenAction(action: string | undefined) {
        if (action !== undefined && !isActionType(action)) {
            throw new Error(`Unknown Fresh Fish action type: ${action}`)
        }
        this.selection = setFreshFishSelection(this.selection, 'action', action)
    }

    get hasManualSelection(): boolean {
        return hasManualFreshFishSelection(this.selection)
    }

    override async undo() {
        if (this.hasManualSelection) {
            this.selection = popFreshFishSelection(this.selection)
            return
        }
        await super.undo()
    }
    previewExpropriateCoords: OffsetTupleCoordinates[] = $state([])
    highlightedCoords: OffsetTupleCoordinates | undefined = $state()

    override beforeNewState() {
        this.selection = {}
    }

    override async onGameStateChange(_args: {
        to: HydratedFreshFishGameState
        from?: HydratedFreshFishGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        this.clearExpropriationPreview()
        this.clearHighlightedCoords()
    }

    nameForActionType(actionType: string) {
        switch (actionType) {
            case ActionType.DrawTile:
                return 'Draw Tile'
            case ActionType.PlaceBid:
                return 'Place Bid'
            case ActionType.PlaceDisk:
                return 'Place Disc'
            case ActionType.PlaceMarket:
                return 'Place Market'
            case ActionType.PlaceStall:
                return 'Place Stall'
            default:
                return actionType
        }
    }

    previewExpropriation(coords: OffsetTupleCoordinates) {
        const expropriator = new Expropriator(this.gameState.board)
        const { expropriatedCoords } = expropriator.calculateExpropriation(coords)
        this.previewExpropriateCoords = expropriatedCoords.filter(
            ([x, y]) => x !== coords[0] || y !== coords[1]
        )
    }

    clearExpropriationPreview() {
        this.previewExpropriateCoords = []
    }

    isExpropriationPreviewed(coords: OffsetTupleCoordinates) {
        for (const expCoords of this.previewExpropriateCoords) {
            if (expCoords[0] === coords[0] && expCoords[1] === coords[1]) {
                return true
            }
        }
        return false
    }

    setHighlightedCoordsForAction(action: GameAction) {
        switch (true) {
            case isPlaceDisk(action) || isPlaceMarket(action) || isPlaceStall(action):
                this.highlightCoords((action as PlaceDisk).coords)
                break
            default:
                this.clearHighlightedCoords()
        }
    }

    // Should change this to just look at last action
    override onHistoryAction(action?: GameAction) {
        if (!action) {
            this.clearHighlightedCoords()
            return
        }
        this.setHighlightedCoordsForAction(action)
    }

    override onHistoryExit() {
        this.clearHighlightedCoords()
    }

    highlightCoords(coords: OffsetTupleCoordinates) {
        this.highlightedCoords = coords
    }

    clearHighlightedCoords() {
        this.highlightedCoords = undefined
    }

    override shouldAutoStepAction(action: GameAction) {
        return (
            super.shouldAutoStepAction(action) ||
            action.type === ActionType.PlaceBid ||
            (isDrawTile(action) && isMarketTile(action.metadata?.chosenTile))
        )
    }

    createPlaceDiskAction(coords: OffsetTupleCoordinates): PlaceDisk {
        return this.createPlayerAction(PlaceDisk, { coords })
    }

    createDrawTileAction(): DrawTile {
        return this.createPlayerAction(DrawTile)
    }

    createPlaceBidAction(amount: number): PlaceBid {
        return this.createPlayerAction(PlaceBid, {
            amount,
            simultaneousGroupId: this.gameState.currentAuction?.id
        })
    }

    createPlaceStallAction(coords: OffsetTupleCoordinates, goodsType: GoodsType): PlaceStall {
        return this.createPlayerAction(PlaceStall, { coords, goodsType })
    }

    createPlaceMarketAction(coords: OffsetTupleCoordinates): PlaceMarket {
        return this.createPlayerAction(PlaceMarket, { coords })
    }
}
