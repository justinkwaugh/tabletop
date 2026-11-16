import { MachineState, type HydratedFeudumGameState } from '@tabletop/feudum'

/**
 * R-X.1 What a seat that isn't deciding reads about the seats that are: "Waiting on" and their
 * chips. What they are deciding is the History's to say once they send.
 */
export interface WatchingPanel {
    /** The seats being waited on, in the order they decide. */
    readonly waitingOn?: readonly string[]
    /** R-4.4.1 How many face-down writs the drawer is holding. */
    readonly backs?: number
}

export interface WatchingInput {
    readonly state: HydratedFeudumGameState
    readonly viewerId: string | undefined
}

/** "Ana", "Ana and Ben", "Ana, Ben and Cy". */
export function namesInWords(names: readonly string[]): string {
    return names.length > 1
        ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
        : names.join('')
}

/** "Waiting on Ana.", "Waiting on Ana and Ben.": the waiting line's words, which its chips draw. */
export function waitingWords(names: readonly string[]): string {
    return `Waiting on ${namesInWords(names)}.`
}

/** R-X.1 The states in which one seat decides and every other waits on it. */
const OneDecides: ReadonlySet<MachineState> = new Set([
    MachineState.PlayingCards,
    MachineState.CommittingAttack,
    MachineState.PlacingDisc,
    MachineState.InspectingHarvest,
    MachineState.DiscardingWrits,
    MachineState.CollectingLandscapes
])

/**
 * R-X.1 Whom the viewer waits on while another seat decides. It's built from public facts alone,
 * so it can't differ with what the asked seat holds (S34). The live rows of a step are
 * `sharedRows`' own.
 */
export function watchingPanelOf({ state, viewerId }: WatchingInput): WatchingPanel | undefined {
    const { combat, starve, writDraw } = state.flow
    const on = (playerIds: readonly string[], extra: Omit<WatchingPanel, 'waitingOn'> = {}) => {
        const others = playerIds.filter((playerId) => playerId !== viewerId)
        return others.length > 0 ? { waitingOn: others, ...extra } : undefined
    }
    switch (state.machineState) {
        case MachineState.KeepingWrits:
            return writDraw ? on([writDraw.playerId], { backs: writDraw.drawnCount }) : undefined
        case MachineState.AwaitingDefence:
            return combat?.defenderId !== undefined ? on([combat.defenderId]) : undefined
        case MachineState.AwaitingImmunity:
            return starve ? on([starve.targetPlayerId]) : undefined
        // R-4.10-H4 Every seat still deciding but the viewer.
        case MachineState.Nourishing:
            return on(state.activePlayerIds)
        default: {
            const [deciderId] = state.activePlayerIds
            return OneDecides.has(state.machineState) && deciderId !== undefined
                ? on([deciderId])
                : undefined
        }
    }
}

/** R-4.4.1 What this seat alone remembers about the deck's bottom. */
export function deckNoteOf(state: HydratedFeudumGameState, viewerId: string): string | undefined {
    const known = state.getPlayerState(viewerId).deckKnowledge?.length ?? 0
    return known > 0 ? `you know ${known} under the deck` : undefined
}
