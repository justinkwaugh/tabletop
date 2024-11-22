import { GameSession, GameSessionMode } from '@tabletop/frontend-components'
import { HydratedSolGameState, SolGameState } from '@tabletop/sol'
import { Color, GameAction, OffsetCoordinates } from '@tabletop/common'

export class SolGameSession extends GameSession<SolGameState, HydratedSolGameState> {
    chosenAction: string | undefined = $state(undefined)

    myPlayerState = $derived.by(() =>
        this.gameState.players.find((p) => p.playerId === this.myPlayer?.id)
    )

    numPlayers = $derived.by(() => this.gameState.players.length)

    cancel() {}

    override willUndo() {
        this.resetAction()
    }

    resetAction() {
        this.chosenAction = undefined
    }

    override shouldAutoStepAction(action: GameAction) {
        return false
    }

    // async drawRoof(index: number) {
    //     const action = {
    //         ...this.createBaseAction(ActionType.DrawRoof),
    //         visibleIndex: index,
    //         revealsInfo: true
    //     }

    //     await this.doAction(action)
    // }
}
