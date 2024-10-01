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
    Cube
} from '@tabletop/estates'
import { Color, GameAction, OffsetCoordinates } from '@tabletop/common'

export class EstatesGameSession extends GameSession {
    gameState = $derived.by(() => {
        return new HydratedEstatesGameState(this.visibleGameState as EstatesGameState)
    })

    chosenAction: string | undefined = $state(undefined)

    myPlayerState = $derived.by(() =>
        this.gameState.players.find((p) => p.playerId === this.myPlayer?.id)
    )

    myTurnCount = $derived.by(() => {
        if (!this.myPlayer?.id) {
            return 0
        }
        return this.gameState.turnManager.turnCount(this.myPlayer.id)
    })

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

    resetAction() {
        this.chosenAction = undefined
    }

    override shouldAutoStepAction(_action: GameAction) {
        return false
    }

    createStartAuctionAction(piece: Piece): StartAuction {
        return {
            ...(this.createBaseAction(ActionType.StartAuction) as StartAuction),
            piece
        }
    }

    createPlaceBidAction(amount: number): PlaceBid {
        return {
            ...(this.createBaseAction(ActionType.PlaceBid) as PlaceBid),
            amount
        }
    }

    async placeBid(amount: number) {
        const action = {
            ...(this.createBaseAction(ActionType.PlaceBid) as PlaceBid),
            amount
        }
        try {
            await this.applyAction(action)
        } finally {
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
        } finally {
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
        } finally {
            this.resetAction()
        }
    }
}
