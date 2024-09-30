import { GameSession } from '@tabletop/frontend-components'
import { HydratedEstatesGameState, EstatesGameState } from '@tabletop/estates'
import { GameAction } from '@tabletop/common'

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

    getPlayerSvgColor(playerId?: string) {
        return this.getPlayerColor(playerId) === 'yellow' ? 'black' : 'white'
    }

    cancel() {}

    resetAction() {}

    override shouldAutoStepAction(_action: GameAction) {
        return false
    }
}
