import { GameSession } from '@tabletop/frontend-components'
import { HydratedSolGameState, SolGameState } from '@tabletop/sol'
import { GameAction } from '@tabletop/common'
import type { ActionCategory } from '$lib/definition/actionCategory.js'

export class SolGameSession extends GameSession<SolGameState, HydratedSolGameState> {
    myPlayerState = $derived.by(() =>
        this.gameState.players.find((p) => p.playerId === this.myPlayer?.id)
    )

    numPlayers = $derived.by(() => this.gameState.players.length)

    chosenAction?: string = $state(undefined)
    chosenActionCategory?: ActionCategory = $state(undefined)
    chosenMothership?: string = $state(undefined)

    cancel() {}

    override willUndo() {
        this.resetAction()
    }

    resetAction() {
        this.chosenAction = undefined
    }

    override shouldAutoStepAction(_action: GameAction) {
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
