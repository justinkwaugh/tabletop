import { GameSession } from '@tabletop/frontend-components'
import { uiBgColorForPlayer } from '$lib/utils/playerColors'
import yellowHut from '$lib/images/yellowhut.png'
import yellowHut2 from '$lib/images/yellowhut2.png'
import blueHut from '$lib/images/bluehut.png'
import blueHut2 from '$lib/images/bluehut2.png'
import greenHut from '$lib/images/greenhut.png'
import greenHut2 from '$lib/images/greenhut2.png'
import redHut from '$lib/images/redhut.png'
import redHut2 from '$lib/images/redhut2.png'

import {
    ActionType,
    HutType,
    HydratedKaivaiGameState,
    KaivaiGameState,
    PlaceBid,
    PlaceHut
} from '@tabletop/kaivai'
import { PlayerColor, type AxialCoordinates } from '@tabletop/common'

export class KaivaiGameSession extends GameSession {
    get gameState(): HydratedKaivaiGameState {
        return new HydratedKaivaiGameState(this.visibleGameState as KaivaiGameState)
    }

    chosenAction: string | undefined = $state(undefined)
    chosenHutType: HutType | undefined = $state(undefined)

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

    getHutImage(hutType: HutType, playerId?: string) {
        const color = this.getPlayerColor(playerId)
        switch (hutType) {
            case HutType.Meeting:
                switch (color) {
                    case PlayerColor.Yellow:
                        return yellowHut2
                    case PlayerColor.Blue:
                        return blueHut2
                    case PlayerColor.Green:
                        return greenHut2
                    case PlayerColor.Red:
                        return redHut2
                }
                break
            case HutType.BoatBuilding:
            case HutType.Fishing:
                switch (color) {
                    case PlayerColor.Yellow:
                        return yellowHut
                    case PlayerColor.Blue:
                        return blueHut
                    case PlayerColor.Green:
                        return greenHut
                    case PlayerColor.Red:
                        return redHut
                }
                break
        }
    }

    cancel() {
        if (this.chosenHutType) {
            this.chosenHutType = undefined
        } else {
            this.chosenAction = undefined
        }
    }

    resetAction() {
        this.chosenAction = undefined
        this.chosenHutType = undefined
    }

    createPlaceBidAction(bid: number): PlaceBid {
        return { ...this.createBaseAction(ActionType.PlaceBid), amount: bid } as PlaceBid
    }

    createPlaceHutAction(coords: AxialCoordinates, hutType: HutType): PlaceHut {
        return { ...this.createBaseAction(ActionType.PlaceHut), coords, hutType } as PlaceHut
    }

    createMoveGodAction(coords: AxialCoordinates) {
        return { ...this.createBaseAction(ActionType.MoveGod), coords }
    }
}
