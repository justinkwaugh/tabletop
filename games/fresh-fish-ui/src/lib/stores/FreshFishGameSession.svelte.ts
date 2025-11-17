import { GameSession } from '@tabletop/frontend-components'
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

export class FreshFishGameSession extends GameSession<
    FreshFishGameState,
    HydratedFreshFishGameState
> {
    chosenAction: string | undefined = $state(undefined)
    previewExpropriateCoords: OffsetTupleCoordinates[] = $state([])
    highlightedCoords: OffsetTupleCoordinates | undefined = $state()

    nameForActionType(actionType: string) {
        switch (actionType) {
            case ActionType.DrawTile:
                return 'Draw Tile'
            case ActionType.PlaceBid:
                return 'Place Bid'
            case ActionType.PlaceDisk:
                return 'Place Disk'
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
        this.previewExpropriateCoords = expropriatedCoords
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
        return { ...this.createBaseAction(ActionType.PlaceDisk), coords } as PlaceDisk
    }

    createDrawTileAction(): DrawTile {
        return { ...this.createBaseAction(ActionType.DrawTile), revealsInfo: true } as DrawTile
    }

    createPlaceBidAction(amount: number): PlaceBid {
        return {
            ...this.createBaseAction(ActionType.PlaceBid),
            amount,
            simultaneousGroupId: this.gameState.currentAuction?.id
        } as PlaceBid
    }

    createPlaceStallAction(coords: OffsetTupleCoordinates, goodsType: GoodsType): PlaceStall {
        return { ...this.createBaseAction(ActionType.PlaceStall), coords, goodsType } as PlaceStall
    }

    createPlaceMarketAction(coords: OffsetTupleCoordinates): PlaceMarket {
        return { ...this.createBaseAction(ActionType.PlaceMarket), coords } as PlaceMarket
    }
}
