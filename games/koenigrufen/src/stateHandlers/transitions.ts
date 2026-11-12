import { Partnership } from '../components/contracts.js'
import { hasAnnouncementRound } from '../model/announcements.js'
import { MachineState } from '../definition/states.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export function afterContract(state: HydratedKoenigrufenGameState): MachineState {
    return state.contractDefinition().partnership === Partnership.CallKing
        ? MachineState.CallingKing
        : afterKingCall(state)
}

export function afterKingCall(state: HydratedKoenigrufenGameState): MachineState {
    switch (state.contractDefinition().talonCards) {
        case 3:
            return MachineState.RevealingTalon
        case 6:
            return MachineState.PickingUpTalon
        default:
            return toAnnouncements(state)
    }
}

// Every contract but Trischaken has a round of announcements before play.
export function toAnnouncements(state: HydratedKoenigrufenGameState): MachineState {
    if (!hasAnnouncementRound(state.contractDefinition())) {
        return toPlay(state)
    }
    state.startAnnouncements()
    return MachineState.Announcing
}

export function toPlay(state: HydratedKoenigrufenGameState): MachineState {
    state.startPlay()
    return MachineState.Playing
}
