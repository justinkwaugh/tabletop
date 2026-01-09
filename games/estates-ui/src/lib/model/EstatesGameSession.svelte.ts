import { GameSession } from '@tabletop/frontend-components'
import {
    HydratedEstatesGameState,
    EstatesGameState,
    Company,
    Piece,
    StartAuction,
    PlaceBid,
    AuctionRecipient,
    ChooseRecipient,
    PlaceCube,
    Cube,
    PlaceMayor,
    Roof,
    Barrier,
    isPlaceBid,
    isDrawRoof,
    DrawRoof,
    PlaceRoof,
    PlaceBarrier,
    RemoveBarrier,
    DiscardPiece,
    Embezzle
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
        const action = this.createAction(DrawRoof, { visibleIndex: index })
        await this.doAction(action)
    }

    async startAuction(piece: Piece) {
        const action = this.createAction(StartAuction, { piece })
        await this.doAction(action)
    }

    async placeBid(amount: number) {
        const action = this.createAction(PlaceBid, { amount })
        await this.doAction(action)
    }

    async chooseRecipient(recipient: AuctionRecipient) {
        const action = this.createAction(ChooseRecipient, { recipient })
        await this.doAction(action)
    }

    async placeCube(cube: Cube, coords: OffsetCoordinates) {
        const action = this.createAction(PlaceCube, { cube, coords })
        await this.doAction(action)
    }

    async placeRoof(roof: Roof, coords: OffsetCoordinates) {
        const action = this.createAction(PlaceRoof, { roof, coords })
        await this.doAction(action)
    }

    async placeBarrier(barrier: Barrier, coords: OffsetCoordinates) {
        const action = this.createAction(PlaceBarrier, { barrier, coords })
        await this.doAction(action)
    }

    async removeBarrier(barrier: Barrier, coords: OffsetCoordinates) {
        const action = this.createAction(RemoveBarrier, { barrier, coords })
        await this.doAction(action)
    }

    async placeMayor(row: number) {
        const action = this.createAction(PlaceMayor, { row })
        await this.doAction(action)
    }

    async discardPiece() {
        if (!this.gameState.chosenPiece) {
            return
        }

        const action = this.createAction(DiscardPiece, { piece: this.gameState.chosenPiece })
        await this.doAction(action)
    }

    async embezzle() {
        if (this.gameState.chosenPiece) {
            return
        }

        const action = this.createAction(Embezzle, {})
        await this.doAction(action)
    }

    async doAction(action: GameAction) {
        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error for action', e, action)
            this.resetAction()
        }
    }
}
