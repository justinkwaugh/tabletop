import { GameSession } from '@tabletop/frontend-components'
import { HydratedEstatesGameState, EstatesGameState, Company } from '@tabletop/estates'
import { Color, GameAction } from '@tabletop/common'

export class EstatesGameSession extends GameSession {
    gameState = $derived.by(() => {
        return new HydratedEstatesGameState(this.visibleGameState as EstatesGameState)
    })

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

    resetAction() {}

    override shouldAutoStepAction(_action: GameAction) {
        return false
    }
}
