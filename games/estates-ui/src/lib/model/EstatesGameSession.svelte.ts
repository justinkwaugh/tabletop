import { GameSession } from '@tabletop/frontend-components'
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
    Barrier
} from '@tabletop/estates'
import { Color, GameAction, OffsetCoordinates } from '@tabletop/common'

export class EstatesGameSession extends GameSession<EstatesGameState, HydratedEstatesGameState> {
    chosenAction: string | undefined = $state(undefined)

    myPlayerState = $derived.by(() =>
        this.gameState.players.find((p) => p.playerId === this.myPlayer?.id)
    )

    currentBid = $state(1)
    validBid = $derived(Math.max(this.currentBid, (this.gameState.auction?.highBid ?? 0) + 1))

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
        console.log('reset action')
        this.chosenAction = undefined
        this.currentBid = 1
    }

    override shouldAutoStepAction(_action: GameAction) {
        return false
    }

    createPlaceBidAction(amount: number): PlaceBid {
        return {
            ...(this.createBaseAction(ActionType.PlaceBid) as PlaceBid),
            amount
        }
    }

    async drawRoof(index: number) {
        const action = {
            ...this.createBaseAction(ActionType.DrawRoof),
            visibleIndex: index,
            revealsInfo: true
        }

        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error drawing roof', e)
            this.resetAction()
        }
    }

    async startAuction(piece: Piece) {
        const action = {
            ...(this.createBaseAction(ActionType.StartAuction) as StartAuction),
            piece
        }
        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error starting auction', e)
            this.resetAction()
        }
    }

    async placeBid(amount: number) {
        const action = {
            ...(this.createBaseAction(ActionType.PlaceBid) as PlaceBid),
            amount
        }
        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error placing bid', e)
            this.resetAction()
        }
    }

    async chooseRecipient(recipient: AuctionRecipient) {
        const action = {
            ...(this.createBaseAction(ActionType.ChooseRecipient) as ChooseRecipient),
            recipient
        }

        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error choosing recipient', e)
            this.resetAction()
        }
    }

    async placeCube(cube: Cube, coords: OffsetCoordinates) {
        const action: PlaceCube = {
            ...(this.createBaseAction(ActionType.PlaceCube) as PlaceCube),
            cube,
            coords
        }
        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error placing cube', e)
            this.resetAction()
        }
    }

    async placeRoof(roof: Roof, coords: OffsetCoordinates) {
        const action = {
            ...this.createBaseAction(ActionType.PlaceRoof),
            roof,
            coords
        }
        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error placing roof', e)
            this.resetAction()
        }
    }

    async placeBarrier(barrier: Barrier, coords: OffsetCoordinates) {
        const action = {
            ...this.createBaseAction(ActionType.PlaceBarrier),
            barrier,
            coords
        }
        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error placing roof', e)
            this.resetAction()
        }
    }

    async removeBarrier(barrier: Barrier, coords: OffsetCoordinates) {
        const action = {
            ...this.createBaseAction(ActionType.RemoveBarrier),
            barrier,
            coords
        }
        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error placing roof', e)
            this.resetAction()
        }
    }

    async placeMayor(row: number) {
        const action: PlaceMayor = {
            ...(this.createBaseAction(ActionType.PlaceMayor) as PlaceMayor),
            row
        }

        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error placing mayor', e)
            this.resetAction()
        }
    }

    async discardPiece() {
        if (!this.gameState.chosenPiece) {
            return
        }

        const action = {
            ...this.createBaseAction(ActionType.DiscardPiece),
            piece: this.gameState.chosenPiece
        }

        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error placing mayor', e)
            this.resetAction()
        }
    }

    async embezzle() {
        if (this.gameState.chosenPiece) {
            return
        }

        const action = {
            ...this.createBaseAction(ActionType.Embezzle)
        }

        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error embezzling', e)
            this.resetAction()
        }
    }
}
