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
    Pass,
    isPass
} from '@tabletop/bridges-of-shangri-la'
import healer from '$lib/images/healer.png'
import rainmaker from '$lib/images/rainmaker.png'
import dragonbreeder from '$lib/images/dragonbreeder.png'
import firekeeper from '$lib/images/firekeeper.png'
import priest from '$lib/images/priest.png'
import yetiwhisperer from '$lib/images/yetiwhisperer.png'
import astrologer from '$lib/images/astrologer.png'
import { GameSession } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'

export class BridgesGameSession extends GameSession<BridgesGameState, HydratedBridgesGameState> {
    chosenAction: string | undefined = $state(undefined)
    chosenMasterType: MasterType | undefined = $state(undefined)
    chosenVillage: number | undefined = $state(undefined)
    highlightedVillages: number[] = $state([])
    highlightedMasterType: MasterType | undefined = $state(undefined)

    myPlayerState = $derived.by(() =>
        this.gameState.players.find((p) => p.playerId === this.myPlayer?.id)
    )
    myTurnCount = $derived.by(() => {
        if (!this.myPlayer?.id) {
            return 0
        }
        return this.gameState.turnManager.turnCount(this.myPlayer.id)
    })

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

    override shouldAutoStepAction(action: GameAction) {
        return isPass(action)
    }

    highlightVillages(villages: number[], masterType?: MasterType) {
        this.highlightedVillages = villages
        this.highlightedMasterType = masterType
    }

    clearHighlightedVillages() {
        this.highlightedVillages = []
        this.highlightedMasterType = undefined
    }

    createPlaceMasterAction(village: number, masterType: MasterType): PlaceMaster {
        const placement: Placement = { village, masterType }
        return this.createPlayerAction(PlaceMaster, { placement })
    }

    createRecruitStudentsAction(village: number, masterType: MasterType): RecruitStudents {
        const placement: Placement = { village, masterType }
        return this.createPlayerAction(RecruitStudents, { placement })
    }

    createPassAction(): Pass {
        return this.createPlayerAction(Pass)
    }

    createBeginJourneyAction(from: number, to: number): BeginJourney {
        return this.createPlayerAction(BeginJourney, { from, to })
    }
}
