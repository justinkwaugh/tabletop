import { ActionSource, assert, type GameAction } from '@tabletop/common'
import {
    controllingOwner,
    isRunTrains,
    standingRunInstructionFor,
    type FinancialState,
    type InstructedRun,
    type InstructedRunAttachment,
    type RunInstructionState
} from '@tabletop/18xx'

export type InstructedRunState = Pick<FinancialState, 'companies' | 'certificates'> &
    RunInstructionState
export type SimulatedCascade<State> = {
    before: State
    transitions: readonly { action: GameAction; after: State }[]
}
export type RunRefreshContext<State> = {
    simulate(action: GameAction): SimulatedCascade<State>
    read(state: State): InstructedRunState
    key(state: State, companyId: string): string
    solve(state: State, companyId: string, key: string): Promise<InstructedRun>
}
/** `ordinal` counts the company's positions, since the runtime spends its runs in order. */
type RunPosition<State> = {
    companyId: string
    ordinal: number
    state: State
    used: InstructedRun | undefined
}

/**
 * Each round solves the earliest stale position. A run attached for a position cannot change an
 * earlier one, since each company spends its runs in order, so no position is solved twice.
 */
export async function withInstructedRuns<State>(
    action: GameAction,
    context: RunRefreshContext<State>
): Promise<GameAction> {
    let cascade: SimulatedCascade<State>
    try {
        cascade = context.simulate(action)
    } catch {
        // An Action that cannot execute here fails again when applied, which reports it.
        return action
    }
    const attachments = new Map<string, InstructedRun[]>()
    const solved = new Set<string>()
    for (;;) {
        const positions = runPositions(cascade, context.read)
        const stale = firstStale(positions, context)
        if (!stale) return attachedTo(action, attachments)
        const { companyId, ordinal, state } = stale.position
        const position = JSON.stringify([companyId, ordinal, stale.key])
        assert(!solved.has(position), 'A run attached for a later position changed an earlier one')
        solved.add(position)
        const earlier = positions.flatMap((candidate) =>
            candidate.companyId === companyId && candidate.ordinal < ordinal && candidate.used
                ? [candidate.used]
                : []
        )
        assert(earlier.length === ordinal, 'Every earlier position used a run')
        const run = await context.solve(state, companyId, stale.key)
        attachments.set(companyId, [...earlier, run])
        cascade = context.simulate(attachedTo(action, attachments))
    }
}

function firstStale<State>(
    positions: readonly RunPosition<State>[],
    context: Pick<RunRefreshContext<State>, 'key'>
): { position: RunPosition<State>; key: string } | undefined {
    for (const position of positions) {
        const key = context.key(position.state, position.companyId)
        if (position.used?.key !== key) return { position, key }
    }
    return undefined
}

function attachedTo(
    action: GameAction,
    attachments: ReadonlyMap<string, InstructedRun[]>
): GameAction {
    const copy = structuredClone(action)
    Reflect.deleteProperty(copy, 'instructedRuns')
    if (!attachments.size) return copy
    const attachedAction: GameAction & { instructedRuns: InstructedRunAttachment[] } = {
        ...copy,
        instructedRuns: [...attachments].map(([companyId, runs]) => ({ companyId, runs }))
    }
    return attachedAction
}

function runPositions<State>(
    cascade: SimulatedCascade<State>,
    read: (state: State) => InstructedRunState
): RunPosition<State>[] {
    const positions: RunPosition<State>[] = []
    const ordinals = new Map<string, number>()
    const add = (companyId: string, state: State, used: InstructedRun | undefined) => {
        const ordinal = ordinals.get(companyId) ?? 0
        ordinals.set(companyId, ordinal + 1)
        positions.push({ companyId, ordinal, state, used })
    }
    let before = cascade.before
    for (const { action, after } of cascade.transitions) {
        if (action.source === ActionSource.System && isRunTrains(action)) {
            const standing = standingRunInstructionFor(read(before), action.companyId)
            if (standing?.playerId === action.playerId)
                add(action.companyId, before, standing.runs[0])
        }
        before = after
    }
    const final = read(before)
    for (const declared of final.runInstructions ?? []) {
        if (controllingOwner(final, declared.companyId)?.playerId !== declared.playerId) continue
        // More runs left than one means they were attached for a cascade that went otherwise.
        add(declared.companyId, before, declared.runs.length === 1 ? declared.runs[0] : undefined)
    }
    return positions
}
