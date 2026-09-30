import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { afterTitleTakenPersistent } from './persistent.js'
import { MachineState } from '../definition/states.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { playersMeetingOathkeeperGoal } from './oathkeeper.js'

/** R-2.11-H1 — after every action's `apply()`, so the title moves mid-Campaign. */

export type TitleEvaluation =
    | { kind: 'unchanged' }
    | { kind: 'moves'; toPlayerId: string }
    /** R-2.11 read literally per R-9.1: nobody qualifies, so nobody holds it. */
    | { kind: 'vacated' }
    /** R-2.11.b */
    | { kind: 'choice'; holderPlayerId: string; candidates: string[] }

/** R-2.11.b — the incumbent keeps a tie; nobody qualifying vacates the title (R-9.1). */
export function evaluateTitle(state: HydratedOathGameState): TitleEvaluation {
    const qualifying = playersMeetingOathkeeperGoal(state)
    const holderId = state.oathkeeperPlayerId

    if (holderId && qualifying.includes(holderId)) return { kind: 'unchanged' }
    if (qualifying.length === 0) {
        return holderId === undefined ? { kind: 'unchanged' } : { kind: 'vacated' }
    }
    if (qualifying.length === 1) {
        return qualifying[0] === holderId
            ? { kind: 'unchanged' }
            : { kind: 'moves', toPlayerId: qualifying[0] }
    }

    if (holderId === undefined) {
        // Nobody holds it to make R-2.11.b's choice, and no rule lets tied players claim it.
        return { kind: 'unchanged' }
    }
    return { kind: 'choice', holderPlayerId: holderId, candidates: qualifying }
}

/** R-2.11.c — taking the title flips it to its Oathkeeper side. */
export function grantTitle(state: HydratedOathGameState, playerId: string) {
    state.oathkeeperPlayerId = playerId
    state.oathkeeperIsUsurper = false
    // R-7.1.4 — Chaos Cult takes favor from the new holder.
    afterTitleTakenPersistent(state, playerId)
}

export function vacateTitle(state: HydratedOathGameState) {
    state.oathkeeperPlayerId = undefined
    state.oathkeeperIsUsurper = false
}

/** R-2.11-H1, R-X.1 — R-2.11.b's choice is its own action. */
export function applyForcedTitleChanges(
    state: HydratedOathGameState,
    resumeMachineState: MachineState
): TitleEvaluation {
    const evaluation = evaluateTitle(state)
    switch (evaluation.kind) {
        case 'moves':
            grantTitle(state, evaluation.toPlayerId)
            break
        case 'vacated':
            vacateTitle(state)
            break
        case 'choice':
            if (!state.pendingOathkeeperChoice) {
                state.pendingOathkeeperChoice = {
                    holderPlayerId: evaluation.holderPlayerId,
                    candidates: [...evaluation.candidates],
                    resumeMachineState
                }
            }
            break
        case 'unchanged':
            break
    }
    return evaluation
}

export function reasonCannotResolveOathkeeperChoice(
    state: HydratedOathGameState,
    playerId: string,
    chosenPlayerId: string
): string | undefined {
    const pending = state.pendingOathkeeperChoice
    if (!pending) return 'no Oathkeeper choice is pending (R-2.11.b)'
    if (pending.holderPlayerId !== playerId) {
        return `the choice belongs to ${pending.holderPlayerId} (R-2.11.b)`
    }
    if (!pending.candidates.includes(chosenPlayerId)) {
        return `${chosenPlayerId} is not one of the tied players (R-2.11.b)`
    }
    return undefined
}

/** R-2.11.b — the pending candidates, which nothing can change while the choice is open. */
export function resolveOathkeeperChoice(
    state: HydratedOathGameState,
    playerId: string,
    chosenPlayerId: string
): MachineState {
    const reason = reasonCannotResolveOathkeeperChoice(state, playerId, chosenPlayerId)
    if (reason) {
        throw Error(`Cannot choose the Oathkeeper: ${reason}`)
    }

    const pending = state.pendingOathkeeperChoice
    assertExists(pending, 'an Oathkeeper choice was validated with none pending')
    const resume = pending.resumeMachineState
    grantTitle(state, chosenPlayerId)
    state.pendingOathkeeperChoice = undefined
    return resume
}

/** R-4.1.3 — after R-4.1.2's win checks. */
export function flipToUsurperIfExileHolds(state: HydratedOathGameState, playerId: string): boolean {
    if (state.oathkeeperPlayerId !== playerId) return false
    if (state.getPlayerState(playerId).status !== PlayerStatus.Exile) return false
    if (state.oathkeeperIsUsurper) return false

    state.oathkeeperIsUsurper = true
    return true
}
