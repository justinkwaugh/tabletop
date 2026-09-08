import { assertExists, type MachineContext } from '@tabletop/common'
import { Activate } from '../actions/activate.js'
import { Pass, type PassContext } from '../actions/pass.js'
import type { HydratedSolGameState } from '../model/gameState.js'

export function queueCardChoicePass(
    context: MachineContext<HydratedSolGameState>,
    playerId: string,
    passContext?: PassContext
) {
    if (!context.gameState.getPlayerState(playerId).hasCardChoice()) {
        context.addSystemAction(Pass, {
            playerId,
            ...(passContext === undefined ? {} : { context: passContext })
        })
    }
}

export function queueMotivatedActivation(
    context: MachineContext<HydratedSolGameState>,
    playerId: string
) {
    const station = context.gameState.effectTracking?.convertedStation
    assertExists(station, 'No converted station found for Motivate effect')
    assertExists(station.coords, 'No coords found for Motivate effect station')
    context.addSystemAction(Activate, { playerId, coords: station.coords, stationId: station.id })
}
