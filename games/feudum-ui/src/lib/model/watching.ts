import { MachineState, type HydratedFeudumGameState } from '@tabletop/feudum'
import { combatTargetName } from './answerAttack.js'
import { spaceLabel } from './cardFlows.js'

/** What a seat that isn't deciding reads about the seat that is (R-X.1). */
export interface WatchingPanel {
    readonly line?: string
    /** R-4.4.1 How many face-down writs the drawer is holding. */
    readonly backs?: number
}

export interface WatchingInput {
    readonly state: HydratedFeudumGameState
    readonly viewerId: string | undefined
    readonly nameOf: (playerId: string) => string
}

/** "Ana", "Ana and Ben", "Ana, Ben and Cy". */
export function namesInWords(names: readonly string[]): string {
    return names.length > 1
        ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
        : names.join('')
}

/**
 * R-4.10-H4 Every seat still deciding but the viewer, by name: "Ana feeds pawns", "Ana and Ben feed
 * pawns".
 */
function feedingLine(
    state: HydratedFeudumGameState,
    viewerId: string | undefined,
    nameOf: (playerId: string) => string
): WatchingPanel | undefined {
    const deciding = state.activePlayerIds.filter((playerId) => playerId !== viewerId)
    if (deciding.length === 0) {
        return undefined
    }
    const verb = deciding.length === 1 ? 'feeds' : 'feed'
    return { line: `${namesInWords(deciding.map(nameOf))} ${verb} pawns` }
}

/** R-X.1 Words for what the one active seat is deciding: public facts, and no more. */
const Deciding: Partial<Record<MachineState, string>> = {
    [MachineState.PlayingCards]: 'plays a card',
    [MachineState.CommittingAttack]: 'adds to the attack',
    [MachineState.PlacingDisc]: 'decides on a disc',
    [MachineState.InspectingHarvest]: 'takes favours',
    [MachineState.DiscardingWrits]: 'discards a writ',
    [MachineState.CollectingLandscapes]: 'collects landscapes'
}

/**
 * R-X.1 The line others read while another seat decides. It's built from public facts alone, so it
 * can't differ with what the asked seat holds (S34). The live rows of a step are `sharedRows`' own.
 */
export function watchingPanelOf({
    state,
    viewerId,
    nameOf
}: WatchingInput): WatchingPanel | undefined {
    const { combat, starve, writDraw } = state.flow
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
            return feedingLine(state, viewerId, nameOf)
        default: {
            const words = Deciding[state.machineState]
            const [deciderId] = state.activePlayerIds
            return words && deciderId !== undefined && deciderId !== viewerId
                ? { line: `${nameOf(deciderId)} ${words}` }
                : undefined
        }
    }
}

/** R-4.4.1 What this seat alone remembers about the deck's bottom. */
export function deckNoteOf(state: HydratedFeudumGameState, viewerId: string): string | undefined {
    const known = state.getPlayerState(viewerId).deckKnowledge?.length ?? 0
    return known > 0 ? `you know ${known} under the deck` : undefined
}
