import {
    ALLIED_CORPS_COMMAND_LIMIT,
    INDEPENDENT_COMMANDS,
    Side,
    corpsCommandsLeft,
    independentCommandsLeft,
    type HydratedNapoleonsTriumphGameState
} from '@tabletop/napoleons-triumph'

// Rule 9: one corps command for each commander, five in all for the Allies and no limit for the French.
export function commandsLeft(state: HydratedNapoleonsTriumphGameState, playerId: string): string {
    const independent = `Independent commands: ${independentCommandsLeft(state, playerId)} left`
    if (state.sideOf(playerId) === Side.Allied) {
        return `Corps commands: ${corpsCommandsLeft(state, playerId)} left, one per corps · ${independent}`
    }
    return `Corps commands: no limit, one per corps · ${independent}`
}

export function commandsUsed(state: HydratedNapoleonsTriumphGameState, playerId: string): string {
    const player = state.getPlayerState(playerId)
    const side = state.sideOf(playerId)
    const corps =
        side === Side.Allied
            ? `${player.corpsCommandsUsed} of ${ALLIED_CORPS_COMMAND_LIMIT} corps`
            : `${player.corpsCommandsUsed} corps (no limit)`
    return `Commands used this turn: ${corps}, ${player.independentCommandsUsed} of ${INDEPENDENT_COMMANDS[side]} independent`
}
