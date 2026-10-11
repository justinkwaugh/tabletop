import { MAX_CORPS_UNITS } from '../components/pieces.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { endRoadMarch } from './movement.js'
import { commanderCanCommand } from './orders.js'
import { samePosition } from './pieces.js'
import { isLegal, legal } from './legality.js'

/** Rule 9, Attach: a commander takes one unit standing with it into its corps, from another corps if need be. */
export function validateAttach(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    commanderId: string,
    unitId: string
) {
    const commander = state.commander(commanderId)
    const unit = state.unit(unitId)
    legal(
        commander.playerId === playerId && unit.playerId === playerId,
        'Both pieces must belong to the commanding army'
    )
    legal(commanderCanCommand(state, commander), `${commander.id} cannot give another command`)
    legal(
        commander.position !== undefined && samePosition(commander.position, unit.position),
        'The commander and the unit must stand in the same position'
    )
    legal(unit.commanderId !== commander.id, 'That unit is already in the corps')
    legal(
        state.corpsUnits(commander.id).length < MAX_CORPS_UNITS,
        'A corps holds at most eight units'
    )
    legal(
        unit.commanderId === undefined || state.corpsUnits(unit.commanderId).length > 1,
        'A commander cannot give up its last unit'
    )
}

export function canAttachAUnit(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string
): boolean {
    return state
        .commandersOf(playerId)
        .some((commander) =>
            state
                .unitsOf(playerId)
                .some((unit) =>
                    isLegal(() => validateAttach(state, playerId, commander.id, unit.id))
                )
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
