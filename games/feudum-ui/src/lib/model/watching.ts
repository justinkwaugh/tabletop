import { MachineState, type HydratedFeudumGameState } from '@tabletop/feudum'
import { combatTargetName } from './answerAttack.js'
import { spaceLabel } from './cardFlows.js'

export interface WatchingRowEntry {
    readonly playerId: string
    /** Not asked, or already answered. */
    readonly done: boolean
    readonly next: boolean
    /** R-4.10, D11 It had no choice, so the game fed it. */
    readonly fedByGame?: boolean
}

/** What a seat that isn't deciding reads about the seat that is (R-X.1). */
export interface WatchingPanel {
    readonly line?: string
    /** R-4.4.1 How many face-down writs the drawer is holding. */
    readonly backs?: number
    readonly row?: readonly WatchingRowEntry[]
}

export interface WatchingInput {
    readonly state: HydratedFeudumGameState
    readonly viewerId: string | undefined
    readonly nameOf: (playerId: string) => string
    /** D11 The seats the round's nourishing fed itself. */
    readonly fedByGame: readonly string[]
}

function rowOf(
    state: HydratedFeudumGameState,
    pending: readonly string[],
    fedByGame: readonly string[] = []
): readonly WatchingRowEntry[] {
    return state.turnManager.turnOrder.map((playerId) => ({
        playerId,
        done: !pending.includes(playerId),
        next: pending[0] === playerId,
        ...(fedByGame.includes(playerId) ? { fedByGame: true } : {})
    }))
}

/**
 * R-X.1 The line others read while an asked seat decides. It's built from public facts alone, so it
 * can't differ with what the asked seat holds (S34).
 */
export function watchingPanelOf({
    state,
    viewerId,
    nameOf,
    fedByGame
}: WatchingInput): WatchingPanel | undefined {
    const { combat, starve, writDraw, nourish, landscapes } = state.flow
    switch (state.machineState) {
        case MachineState.KeepingWrits:
            return writDraw && writDraw.playerId !== viewerId
                ? {
                      line: `${nameOf(writDraw.playerId)} keeps ${writDraw.keep}`,
                      backs: writDraw.drawnCount
                  }
                : undefined
        case MachineState.AwaitingDefence: {
            if (!combat || combat.defenderId === undefined || combat.defenderId === viewerId) {
                return undefined
            }
            const defender = nameOf(combat.defenderId)
            const target = combatTargetName(state, combat.target)
            return {
                line: `${nameOf(combat.attackerId)} conquers ${defender}'s ${target} at ${spaceLabel(combat.spaceId)}. ${defender} answers.`
            }
        }
        case MachineState.AwaitingImmunity: {
            if (!starve || starve.targetPlayerId === viewerId) {
                return undefined
            }
            const owner = nameOf(starve.targetPlayerId)
            return {
                line: `${nameOf(starve.actorId)} starves ${owner}'s ${starve.role} at ${spaceLabel(starve.spaceId)}. ${owner} answers.`
            }
        }
        case MachineState.Nourishing:
            return nourish && nourish.pending[0] !== viewerId
                ? { row: rowOf(state, nourish.pending, fedByGame) }
                : undefined
        case MachineState.CollectingLandscapes:
            return landscapes && landscapes.pending[0] !== viewerId
                ? { row: rowOf(state, landscapes.pending) }
                : undefined
        default:
            return undefined
    }
}

/** R-4.4.1 What this seat alone remembers about the deck's bottom. */
export function deckNoteOf(state: HydratedFeudumGameState, viewerId: string): string | undefined {
    const known = state.getPlayerState(viewerId).deckKnowledge?.length ?? 0
    return known > 0 ? `you know ${known} under the deck` : undefined
}
