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
import { GameSession, getColorBlindBgColor } from '@tabletop/frontend-components'
import { uiBgColorForPlayer } from '$lib/utils/playerColors'

export class BridgesGameSession extends GameSession {
    get gameState(): HydratedBridgesGameState {
        return new HydratedBridgesGameState(this.visibleGameState as BridgesGameState)
    }

    chosenAction: string | undefined = $state(undefined)
    chosenMasterType: MasterType | undefined = $state(undefined)
    chosenVillage: number | undefined = $state(undefined)
    highlightedVillages: number[] = $state([])

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
        const playerColor = this.getPlayerColor(playerId)
        return this.colorBlind ? getColorBlindBgColor(playerColor) : uiBgColorForPlayer(playerColor)
    }

    getPlayerTextColor(playerId?: string) {
        return this.getPlayerColor(playerId) === 'yellow' ? 'text-black' : 'text-gray-100'
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

    nameForMasterType(masterType: MasterType, withArticle = false) {
        switch (masterType) {
            case MasterType.Astrologer:
                return `${withArticle ? 'an ' : ''} Astrologer`
            case MasterType.DragonBreeder:
                return `${withArticle ? 'a ' : ''} Dragon Breeder`
            case MasterType.Firekeeper:
                return `${withArticle ? 'a ' : ''} Firekeeper`
            case MasterType.Healer:
                return `${withArticle ? 'a ' : ''} Healer`
            case MasterType.Priest:
                return `${withArticle ? 'a ' : ''} Priest`
            case MasterType.Rainmaker:
                return `${withArticle ? 'a ' : ''} Rainmaker`
            case MasterType.YetiWhisperer:
                return `${withArticle ? 'a ' : ''} Yeti Whisperer`
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
            if (this.chosenVillage !== undefined) {
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

    highlightVillages(villages: number[]) {
        this.highlightedVillages = villages
    }

    clearHighlightedVillages() {
        this.highlightedVillages = []
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
}
