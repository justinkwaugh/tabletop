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
import healer from '$lib/images/healer.png'
import rainmaker from '$lib/images/rainmaker.png'
import dragonbreeder from '$lib/images/dragonbreeder.png'
import firekeeper from '$lib/images/firekeeper.png'
import priest from '$lib/images/priest.png'
import yetiwhisperer from '$lib/images/yetiwhisperer.png'
import astrologer from '$lib/images/astrologer.png'
import { GameSession } from '@tabletop/frontend-components'
import { type GameAction } from '@tabletop/common'
import { uiBgColorForPlayer } from '$lib/utils/playerColors'

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
        return uiBgColorForPlayer(this.playerColorsById.get(playerId ?? 'unknown')) ?? 'bg-gray-500'
    }

    getPlayerTextColor(playerId?: string) {
        return this.playerColorsById.get(playerId ?? 'unknown') === 'yellow'
            ? 'text-black'
            : 'text-gray-100'
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

    imageForMasterType(masterType: MasterType) {
        switch (masterType) {
            case MasterType.Astrologer:
                return astrologer
            case MasterType.DragonBreeder:
                return dragonbreeder
            case MasterType.Firekeeper:
                return firekeeper
            case MasterType.Healer:
                return healer
            case MasterType.Priest:
                return priest
            case MasterType.Rainmaker:
                return rainmaker
            case MasterType.YetiWhisperer:
                return yetiwhisperer
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
