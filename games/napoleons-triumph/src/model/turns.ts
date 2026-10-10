import { shuffle } from '@tabletop/common'
import { Side, type Face } from '../components/pieces.js'
import { isLastRound } from '../components/timeTrack.js'
import { emptyTurnLimits, type HydratedNapoleonsTriumphGameState } from './gameState.js'
import type { ProjectedUnit } from './pieces.js'

const NIGHT_RECOVERY_LIMIT = 4

function groupKey(unit: ProjectedUnit): string {
    const position = unit.position
    const where = position ? `${position.locale}:${position.approach ?? 'r'}` : 'off'
    return `${unit.playerId}|${where}|${unit.commanderId ?? ''}`
}

/**
 * Both players re-arrange their blocks out of sight at the end of every turn (rule 7): units
 * standing together in the same corps, or together and detached, become indistinguishable again.
 * A block standing alone stays whatever the opponent has seen it to be.
 */
export function shuffleBlocks(state: HydratedNapoleonsTriumphGameState) {
    const groups = new Map<string, ProjectedUnit[]>()
    for (const unit of state.units) {
        if (unit.fixed) {
            continue
        }
        const key = groupKey(unit)
        groups.set(key, [...(groups.get(key) ?? []), unit])
    }
    const random = state.getProtectedPrng().random
    for (const units of groups.values()) {
        if (units.length < 2) {
            continue
        }
        const faces: (Face | undefined)[] = units.map((unit) => unit.face)
        shuffle(faces, random)
        units.forEach((unit, index) => {
            unit.face = faces[index]
            unit.shown = undefined
        })
    }
}

function clearTurnState(state: HydratedNapoleonsTriumphGameState) {
    for (const unit of state.units) {
        unit.movesThisTurn = undefined
        unit.enteredThisTurn = undefined
        unit.enteredReserveThisTurn = undefined
        unit.defendedApproach = undefined
        unit.retreatedAfterCombat = undefined
    }
    for (const commander of state.commanders) {
        commander.commandsThisTurn = undefined
        commander.enteredThisTurn = undefined
    }
    for (const player of state.players) {
        player.corpsCommandsUsed = 0
        player.independentCommandsUsed = 0
    }
    state.limits = emptyTurnLimits()
}

/** Each army recovers half the morale it has lost, to a limit of four, when night falls (rule 14). */
function recoverAtNight(state: HydratedNapoleonsTriumphGameState) {
    for (const player of state.players) {
        const regained = Math.min(NIGHT_RECOVERY_LIMIT, Math.floor(player.moraleLost / 2))
        player.morale += regained
        player.moraleLost -= regained
    }
}

export function beginTurn(state: HydratedNapoleonsTriumphGameState, playerId: string) {
    state.turnManager.startTurn(playerId, state.actionCount)
    state.activePlayerIds = [playerId]
}

export function beginRound(state: HydratedNapoleonsTriumphGameState) {
    state.rounds.startRound(state.actionCount)
    if (state.currentRound.night) {
        recoverAtNight(state)
    }
    beginTurn(state, state.playerOf(Side.Allied).playerId)
}

/** Ends the current player turn. Returns false when that was the last turn of the game. */
export function finishTurn(state: HydratedNapoleonsTriumphGameState): boolean {
    const playerId = state.turnPlayerId
    shuffleBlocks(state)
    clearTurnState(state)
    state.turnManager.endTurn(state.actionCount)
    if (state.sideOf(playerId) === Side.Allied) {
        beginTurn(state, state.playerOf(Side.French).playerId)
        return true
    }
    state.rounds.endRound(state.actionCount)
    if (isLastRound(state.scenario, state.round)) {
        state.activePlayerIds = []
        return false
    }
    state.round += 1
    beginRound(state)
    return true
}
