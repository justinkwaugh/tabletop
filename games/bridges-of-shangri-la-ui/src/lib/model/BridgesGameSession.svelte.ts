import {
    ActionType,
    BeginJourney,
    BridgesGameState,
    HydratedBridgesGameState,
    isBeginJourney,
    isPlaceMaster,
    isRecruitStudents,
    MasterType,
    PlaceMaster,
    RecruitStudents
} from '@tabletop/bridges-of-shangri-la'

import { GameSession } from '@tabletop/frontend-components'
import { type GameAction } from '@tabletop/common'

export class BridgesGameSession extends GameSession {
    chosenMasterType: string | undefined = $state(undefined)

    hydratedState: HydratedBridgesGameState = $derived.by(() => {
        return new HydratedBridgesGameState(this.gameState)
    })

    get gameState(): BridgesGameState {
        return this.visibleGameState as BridgesGameState
    }

    private playerNamesById = $derived(
        new Map(this.game.players.map((player) => [player.id, player.name]))
    )

    private playerColorsById = $derived(
        new Map(this.gameState.players.map((player) => [player.playerId, player.color]))
    )

    getPlayerName(playerId?: string) {
        if (!playerId) return 'Someone'
        return this.playerNamesById.get(playerId) ?? 'Someone'
    }

    getPlayerBgColor(playerId?: string) {
        return 'bg-gray-500'
        //     return uiBgColorForPlayer(this.playerColorsById.get(playerId ?? 'unknown')) ?? 'bg-gray-500'
    }

    getPlayerTextColor(playerId?: string) {
        return this.playerColorsById.get(playerId ?? 'unknown') === 'yellow'
            ? 'text-black'
            : 'text-white'
    }

    nameForActionType(actionType: string) {
        switch (actionType) {
            case ActionType.PlaceMaster:
                return 'Place Master'
            case ActionType.RecruitStudents:
                return 'Recruit Students'
            case ActionType.BeginJourney:
                return 'Begin Journey'
            default:
                return actionType
        }
    }

    // createPlaceDiskAction(coords: Coordinates): PlaceDisk {
    //     return { ...this.createBaseAction(ActionType.PlaceDisk), coords } as PlaceDisk
    // }

    // createDrawTileAction(): DrawTile {
    //     return { ...this.createBaseAction(ActionType.DrawTile), revealsInfo: true } as DrawTile
    // }

    // createPlaceStallAction(coords: Coordinates, goodsType: GoodsType): PlaceStall {
    //     return { ...this.createBaseAction(ActionType.PlaceStall), coords, goodsType } as PlaceStall
    // }
}
