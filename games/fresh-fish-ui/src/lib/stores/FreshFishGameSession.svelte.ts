import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    Coordinates,
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
import { type GameAction } from '@tabletop/common'

export class FreshFishGameSession extends GameSession {
    chosenAction: string | undefined = $state(undefined)

    gameState = $derived.by(() => {
        return new HydratedFreshFishGameState(this.visibleGameState as FreshFishGameState)
    })

    previewExpropriateCoords: Coordinates[] = $state([])
    highlightedCoords: Coordinates | undefined = $state()

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

    previewExpropriation(coords: Coordinates) {
        const expropriator = new Expropriator(this.gameState.board, coords)
        const { expropriatedCoords } = expropriator.calculateExpropriation()
        this.previewExpropriateCoords = expropriatedCoords
    }

    clearExpropriationPreview() {
        this.previewExpropriateCoords = []
    }

    isExpropriationPreviewed(coords: Coordinates) {
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

    override willUpdateGameState(): void {
        this.chosenAction = undefined
    }

    highlightCoords(coords: Coordinates) {
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

    createPlaceDiskAction(coords: Coordinates): PlaceDisk {
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

    createPlaceStallAction(coords: Coordinates, goodsType: GoodsType): PlaceStall {
        return { ...this.createBaseAction(ActionType.PlaceStall), coords, goodsType } as PlaceStall
    }

    createPlaceMarketAction(coords: Coordinates): PlaceMarket {
        return { ...this.createBaseAction(ActionType.PlaceMarket), coords } as PlaceMarket
    }
}
