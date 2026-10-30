import { shuffle } from '@tabletop/common'
import { Side, sameFace, type Face } from '../components/pieces.js'
import { isLastRound } from '../components/timeTrack.js'
import { emptyTurnLimits, type HydratedNapoleonsTriumphGameState } from './gameState.js'
import { endRoadMarch } from './movement.js'
import { standingGroupKey, type ProjectedUnit } from './pieces.js'

const NIGHT_RECOVERY_LIMIT = 4

/** The enemy has seen every one of these units, all with the same face, so shuffling them hides nothing. */
function seenAllAlike(units: readonly ProjectedUnit[]): boolean {
    const firstShown = units[0].shown
    return (
        firstShown !== undefined &&
        units.every((unit) => unit.shown !== undefined && sameFace(unit.shown, firstShown))
    )
}

function standingGroups(units: readonly ProjectedUnit[]): Map<string, ProjectedUnit[]> {
    const groups = new Map<string, ProjectedUnit[]>()
    for (const unit of units) {
        if (unit.fixed) {
            continue
        }
        const key = standingGroupKey(unit)
        groups.set(key, [...(groups.get(key) ?? []), unit])
    }
    return groups
}

function shuffleGroup(units: readonly ProjectedUnit[], random: () => number) {
    if (units.length < 2) {
        return
    }
    const seenAlike = seenAllAlike(units)
    const faces: (Face | undefined)[] = units.map((unit) => unit.face)
    shuffle(faces, random)
    units.forEach((unit, index) => {
        unit.face = faces[index]
        if (!seenAlike) {
            unit.shown = undefined
        }
    })
}

/**
 * Both players re-arrange their blocks out of sight at the end of every turn (rule 7): units
 * standing together in the same corps, or together and detached, become indistinguishable again.
 * A block standing alone stays whatever the opponent has seen it to be, and so do blocks the
 * opponent has seen all alike, since swapping them hides nothing.
 */
function shuffleBlocks(state: HydratedNapoleonsTriumphGameState, keptOnShow: readonly string[]) {
    const random = state.getProtectedPrng().random
    for (const [key, units] of standingGroups(state.units)) {
        if (!keptOnShow.includes(key)) {
            shuffleGroup(units, random)
        }
    }
}

/**
 * Rule 11: cavalry still riding when its turn ends is shown then. Where the shuffle would hide it
 * at once, its stack is kept as it is until the opponent has seen it.
 */
function stacksHidingRiders(
    state: HydratedNapoleonsTriumphGameState,
    riderIds: readonly string[]
): string[] {
    return [...standingGroups(state.units)]
        .filter(
            ([, units]) =>
                units.length > 1 &&
                units.some((unit) => riderIds.includes(unit.id)) &&
                !seenAllAlike(units)
        )
        .map(([key]) => key)
}

/** The opponent has seen the cavalry that was still riding when the last turn ended: its stack is shuffled now. */
export function hideRevealedRide(state: HydratedNapoleonsTriumphGameState) {
    const ride = state.revealedRide
    if (!ride) {
        return
    }
    const riders = ride.unitIds.flatMap((id) => state.findUnit(id) ?? [])
    const keys = new Set(riders.map(standingGroupKey))
    const random = state.getProtectedPrng().random
    for (const [key, units] of standingGroups(state.units)) {
        if (keys.has(key)) {
            shuffleGroup(units, random)
        }
    }
    state.revealedRide = undefined
}

function clearTurnState(state: HydratedNapoleonsTriumphGameState) {
    for (const unit of state.units) {
        unit.movesThisTurn = undefined
        unit.enteredThisTurn = undefined
        unit.enteredReserveThisTurn = undefined
        unit.marchedReserves = undefined
        unit.arrivedByRoad = undefined
        unit.defendedApproach = undefined
        unit.retreatedAfterCombat = undefined
    }
    for (const commander of state.commanders) {
        commander.commandsThisTurn = undefined
        commander.enteredThisTurn = undefined
        commander.defendedApproach = undefined
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

function beginTurn(state: HydratedNapoleonsTriumphGameState, playerId: string) {
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

export function finishTurn(state: HydratedNapoleonsTriumphGameState): boolean {
    const playerId = state.turnPlayerId
    const riderIds = state.roadMarch?.unitIds ?? []
    endRoadMarch(state)
    const continues =
        state.sideOf(playerId) === Side.Allied || !isLastRound(state.scenario, state.round)
    const keptOnShow = continues ? stacksHidingRiders(state, riderIds) : []
    shuffleBlocks(state, keptOnShow)
    if (keptOnShow.length > 0) {
        state.revealedRide = { unitIds: riderIds.filter((id) => state.findUnit(id)) }
    }
    clearTurnState(state)
    state.turnManager.endTurn(state.actionCount)
    if (state.sideOf(playerId) === Side.Allied) {
        beginTurn(state, state.playerOf(Side.French).playerId)
        return true
    }
    const lastRound = isLastRound(state.scenario, state.round)
    state.rounds.endRound(state.actionCount)
    if (lastRound) {
        state.activePlayerIds = []
        return false
    }
    beginRound(state)
    return true
}
