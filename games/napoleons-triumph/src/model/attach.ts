import { assert } from '@tabletop/common'
import { MAX_CORPS_UNITS } from '../components/pieces.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { endRoadMarch } from './movement.js'
import { commanderCanCommand } from './orders.js'
import { samePosition } from './pieces.js'

/** Rule 9, Attach: a commander takes one unit standing with it into its corps, from another corps if need be. */
export function validateAttach(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    commanderId: string,
    unitId: string
) {
    const commander = state.commander(commanderId)
    const unit = state.unit(unitId)
    assert(
        commander.playerId === playerId && unit.playerId === playerId,
        'Both pieces must belong to the commanding army'
    )
    assert(commanderCanCommand(state, commander), `${commander.id} cannot give another command`)
    assert(
        commander.position !== undefined && samePosition(commander.position, unit.position),
        'The commander and the unit must stand in the same position'
    )
    assert(unit.commanderId !== commander.id, 'That unit is already in the corps')
    assert(
        state.corpsUnits(commander.id).length < MAX_CORPS_UNITS,
        'A corps holds at most eight units'
    )
    assert(
        unit.commanderId === undefined || state.corpsUnits(unit.commanderId).length > 1,
        'A commander cannot give up its last unit'
    )
}

export function attach(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    commanderId: string,
    unitId: string
) {
    endRoadMarch(state)
    validateAttach(state, playerId, commanderId, unitId)
    const commander = state.commander(commanderId)
    state.unit(unitId).commanderId = commander.id
    commander.commandsThisTurn = (commander.commandsThisTurn ?? 0) + 1
    state.getPlayerState(playerId).corpsCommandsUsed += 1
}
