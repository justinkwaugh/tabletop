import { GameSession } from '@tabletop/frontend-components'
import { uiBgColorForPlayer } from '$lib/utils/playerColors'
import { ActionType, HydratedKaivaiGameState, KaivaiGameState, PlaceBid } from '@tabletop/kaivai'

export class KaivaiGameSession extends GameSession {
    get gameState(): HydratedKaivaiGameState {
        return new HydratedKaivaiGameState(this.visibleGameState as KaivaiGameState)
    }

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

    getPlayerBgColor(playerId?: string) {
        return uiBgColorForPlayer(this.getPlayerColor(playerId)) ?? 'bg-gray-500'
    }

    getPlayerTextColor(playerId?: string) {
        return this.getPlayerColor(playerId) === 'yellow' ? 'text-black' : 'text-gray-100'
    }

    cancel() {
        this.chosenAction = undefined
    }

    resetAction() {
        this.chosenAction = undefined
    }

    createPlaceBidAction(bid: number): PlaceBid {
        return { ...this.createBaseAction(ActionType.PlaceBid), amount: bid } as PlaceBid
    }
}
