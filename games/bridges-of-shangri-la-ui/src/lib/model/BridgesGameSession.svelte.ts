import {
    ActionType,
    BeginJourney,
    BridgesGameState,
    HydratedBridgesGameState,
    MachineState,
    MasterType,
    PlaceMaster,
    Placement,
    RecruitStudents,
    Pass
} from '@tabletop/bridges-of-shangri-la'
import healer from '$lib/images/healer.png'
import rainmaker from '$lib/images/rainmaker.png'
import dragonbreeder from '$lib/images/dragonbreeder.png'
import firekeeper from '$lib/images/firekeeper.png'
import priest from '$lib/images/priest.png'
import yetiwhisperer from '$lib/images/yetiwhisperer.png'
import astrologer from '$lib/images/astrologer.png'
import { GameSession } from '@tabletop/frontend-components'
import { uiBgColorForPlayer } from '$lib/utils/playerColors'

export class BridgesGameSession extends GameSession {
    get gameState(): HydratedBridgesGameState {
        return new HydratedBridgesGameState(this.visibleGameState as BridgesGameState)
    }

    chosenAction: string | undefined = $state(undefined)
    chosenMasterType: MasterType | undefined = $state(undefined)
    chosenVillage: number | undefined = $state(undefined)

    myPlayerState = $derived.by(() =>
        this.gameState.players.find((p) => p.playerId === this.myPlayer?.id)
    )
    myTurnCount = $derived.by(() => {
        if (!this.myPlayer?.id) {
            return 0
        }
        return this.gameState.turnManager.turnCount(this.myPlayer.id)
    })

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
                if (this.gameState.machineState === MachineState.RecruitingStudents) {
                    return 'Recruit Another'
                } else {
                    return 'Recruit Students'
                }
            case ActionType.BeginJourney:
                return 'Begin Journey'
            case ActionType.Pass:
                if (this.gameState.machineState === MachineState.RecruitingStudents) {
                    return 'Skip'
                } else {
                    return 'Pass'
                }
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

    nameForMasterType(masterType: MasterType) {
        switch (masterType) {
            case MasterType.Astrologer:
                return 'Astrologer'
            case MasterType.DragonBreeder:
                return 'Dragon Breeder'
            case MasterType.Firekeeper:
                return 'Firekeeper'
            case MasterType.Healer:
                return 'Healer'
            case MasterType.Priest:
                return 'Priest'
            case MasterType.Rainmaker:
                return 'Rainmaker'
            case MasterType.YetiWhisperer:
                return 'Yeti Whisperer'
        }
    }

    cancel() {
        if (
            this.chosenAction === ActionType.PlaceMaster ||
            this.chosenAction === ActionType.RecruitStudents
        ) {
            if (this.chosenMasterType) {
                this.chosenMasterType = undefined
            } else {
                this.chosenAction = undefined
            }
        } else if (this.chosenAction === ActionType.BeginJourney) {
            if (this.chosenVillage) {
                this.chosenVillage = undefined
            } else {
                this.chosenAction = undefined
            }
        }
    }

    resetAction() {
        this.chosenAction = undefined
        this.chosenMasterType = undefined
        this.chosenVillage = undefined
    }

    createPlaceMasterAction(village: number, masterType: MasterType): PlaceMaster {
        const placement: Placement = { village, masterType }
        return { ...this.createBaseAction(ActionType.PlaceMaster), placement } as PlaceMaster
    }

    createRecruitStudentsAction(village: number, masterType: MasterType): RecruitStudents {
        const placement: Placement = { village, masterType }
        return {
            ...this.createBaseAction(ActionType.RecruitStudents),
            placement
        } as RecruitStudents
    }

    createPassAction(): Pass {
        return { ...this.createBaseAction(ActionType.Pass) } as Pass
    }

    createBeginJourneyAction(from: number, to: number): BeginJourney {
        return { ...this.createBaseAction(ActionType.BeginJourney), from, to } as BeginJourney
    }

    // createDrawTileAction(): DrawTile {
    //     return { ...this.createBaseAction(ActionType.DrawTile), revealsInfo: true } as DrawTile
    // }

    // createPlaceStallAction(coords: Coordinates, goodsType: GoodsType): PlaceStall {
    //     return { ...this.createBaseAction(ActionType.PlaceStall), coords, goodsType } as PlaceStall
    // }
}
