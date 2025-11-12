import { GameSession, GameSessionMode } from '@tabletop/frontend-components'
import {
    HydratedEstatesGameState,
    EstatesGameState,
    Company,
    Piece,
    StartAuction,
    ActionType,
    PlaceBid,
    AuctionRecipient,
    ChooseRecipient,
    PlaceCube,
    Cube,
    PlaceMayor,
    Roof,
    Barrier,
    isPlaceBid,
    isDrawRoof
} from '@tabletop/estates'
import { Color, GameAction, OffsetCoordinates } from '@tabletop/common'

export class EstatesGameSession extends GameSession<EstatesGameState, HydratedEstatesGameState> {
    chosenAction: string | undefined = $state(undefined)

    myPlayerState = $derived.by(() =>
        this.gameState.players.find((p) => p.playerId === this.myPlayer?.id)
    )

    currentBid = $state(1)
    validBid = $derived(Math.max(this.currentBid, (this.gameState.auction?.highBid ?? 0) + 1))

    mobileView: boolean | undefined = $state()
    touching: boolean = $state(false)

    shouldHideHud = $derived(this.touching)

    getCompanyColor(company: Company): Color {
        switch (company) {
            case Company.Skyline:
                return Color.Blue
            case Company.Sienna:
                return Color.Red
            case Company.Golden:
                return Color.Yellow
            case Company.Emerald:
                return Color.Green
            case Company.Heather:
                return Color.Purple
            case Company.Collar:
                return Color.Gray
            default:
                return Color.Black
        }
    }

    cancel() {}

    override willUndo() {
        this.resetAction()
    }

    resetAction() {
        this.chosenAction = undefined
        this.currentBid = 1
    }

    override shouldAutoStepAction(action: GameAction) {
        if (isPlaceBid(action) || isDrawRoof(action)) {
            return true
        }
        return false
    }

    async drawRoof(index: number) {
        const action = {
            ...this.createBaseAction(ActionType.DrawRoof),
            visibleIndex: index,
            revealsInfo: true
        }

        await this.doAction(action)
    }

    async startAuction(piece: Piece) {
        const action = {
            ...(this.createBaseAction(ActionType.StartAuction) as StartAuction),
            piece
        }
        await this.doAction(action)
    }

    async placeBid(amount: number) {
        const action = {
            ...(this.createBaseAction(ActionType.PlaceBid) as PlaceBid),
            amount
        }
        await this.doAction(action)
    }

    async chooseRecipient(recipient: AuctionRecipient) {
        const action = {
            ...(this.createBaseAction(ActionType.ChooseRecipient) as ChooseRecipient),
            recipient
        }

        await this.doAction(action)
    }

    async placeCube(cube: Cube, coords: OffsetCoordinates) {
        const action: PlaceCube = {
            ...(this.createBaseAction(ActionType.PlaceCube) as PlaceCube),
            cube,
            coords
        }
        await this.doAction(action)
    }

    async placeRoof(roof: Roof, coords: OffsetCoordinates) {
        const action = {
            ...this.createBaseAction(ActionType.PlaceRoof),
            roof,
            coords
        }
        await this.doAction(action)
    }

    async placeBarrier(barrier: Barrier, coords: OffsetCoordinates) {
        const action = {
            ...this.createBaseAction(ActionType.PlaceBarrier),
            barrier,
            coords
        }
        await this.doAction(action)
    }

    async removeBarrier(barrier: Barrier, coords: OffsetCoordinates) {
        const action = {
            ...this.createBaseAction(ActionType.RemoveBarrier),
            barrier,
            coords
        }
        await this.doAction(action)
    }

    async placeMayor(row: number) {
        const action: PlaceMayor = {
            ...(this.createBaseAction(ActionType.PlaceMayor) as PlaceMayor),
            row
        }

        await this.doAction(action)
    }

    async discardPiece() {
        if (!this.gameState.chosenPiece) {
            return
        }

        const action = {
            ...this.createBaseAction(ActionType.DiscardPiece),
            piece: this.gameState.chosenPiece
        }

        await this.doAction(action)
    }

    async embezzle() {
        if (this.gameState.chosenPiece) {
            return
        }

        const action = {
            ...this.createBaseAction(ActionType.Embezzle)
        }

        await this.doAction(action)
    }

    async doAction(action: GameAction) {
        if (!this.isPlayable) {
            return
        }

        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error for action', e, action)
            this.resetAction()
        }
    }
}
