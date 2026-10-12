import {
    assert,
    belongsToSpan,
    branchView,
    branchViewDuringMerge,
    calculateActionChecksum,
    createPatch,
    unmergedPlayerIds,
    unopenedBranchView,
    type Branch,
    type Game,
    type GameAction,
    type GameEngine,
    type GameState,
    type HydratedGameState,
    type UnmergedBranch
} from '@tabletop/common'
import { GameActionResults } from './gameActionResults.svelte.js'
import { GameContext } from './gameContext.svelte.js'

export interface VisibleStep<T extends GameState> {
    readonly action: GameAction
    readonly state: T
}

interface StepReplay<T extends GameState, U extends HydratedGameState<T>> {
    engine: GameEngine<T, U>
    game: Game
    playerId: string
}

export function createBranchContext<T extends GameState, U extends HydratedGameState<T> & T>(
    mainLine: GameContext<T, U>,
    { branch, actions }: UnmergedBranch
): GameContext<T, U> {
    assert(
        actions.length === 0 || actions.length === branch.actionCount,
        'A Branch arrives with all of its Actions or with none'
    )
    return new GameContext({
        runtime: mainLine.runtime,
        game: structuredClone(mainLine.game),
        state: branchView(mainLine.state, branch),
        actions: actions.map((action) => structuredClone(action)),
        historyComplete: actions.length === branch.actionCount
    })
}

function isPlayingOwnBranch(state: GameState, playerId: string): boolean {
    return state.parallelSpan?.branchPlayerId === playerId
}

function stillHolds(state: GameState, held: Branch): boolean {
    const span = state.parallelSpan
    return (
        span !== undefined &&
        belongsToSpan(held, span) &&
        unmergedPlayerIds(span).includes(held.playerId)
    )
}

export function mergedActionSteps<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    playerId,
    from,
    actions,
    held
}: StepReplay<T, U> & {
    from: T
    actions: readonly GameAction[]
    held?: Branch
}): VisibleStep<T>[] {
    const steps: VisibleStep<T>[] = []
    let mainLine = from
    for (const action of actions) {
        const before = mainLine
        mainLine = engine.applyProcessedAction({ action, state: before, game })
        if (isPlayingOwnBranch(before, playerId) || isPlayingOwnBranch(mainLine, playerId)) continue
        steps.push({
            action,
            state:
                held !== undefined && stillHolds(mainLine, held)
                    ? branchViewDuringMerge(mainLine, held)
                    : mainLine
        })
    }
    return steps
}

export function branchActionSteps<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    playerId,
    mainLine,
    actions
}: StepReplay<T, U> & {
    mainLine: T
    actions: readonly GameAction[]
}): VisibleStep<T>[] {
    let view = unopenedBranchView(mainLine, playerId)
    return actions.map((action) => {
        view = engine.applyProcessedAction({ action, state: view, game })
        return { action, state: view }
    })
}

interface Joined<T extends GameState, U extends HydratedGameState<T> & T> {
    context: GameContext<T, U>
    mainLineState: T
    mainLineStart: number
    branchState: T
    actionIds: string[]
}

export class JoinedBranchHistory<T extends GameState, U extends HydratedGameState<T> & T> {
    readonly context: GameContext<T, U>
    private joined: Joined<T, U>

    constructor(
        private readonly mainLine: GameContext<T, U>,
        readonly branch: GameContext<T, U>,
        private readonly playerId: string
    ) {
        this.joined = this.join()
        this.context = this.joined.context
    }

    refresh(): void {
        const actions = this.branch.actions
        const count = this.joined.actionIds.length
        const continues =
            this.mainLine.state === this.joined.mainLineState &&
            this.mainLine.historyStartIndex === this.joined.mainLineStart &&
            actions.length >= count &&
            (count === 0 || actions[count - 1].id === this.joined.actionIds[count - 1])
        if (continues && actions.length > count) {
            this.append(this.joined, actions.slice(count))
        } else if (!continues || this.branch.state !== this.joined.branchState) {
            const rejoined = this.join()
            this.context.restoreFrom(rejoined.context)
            this.joined = { ...rejoined, context: this.context }
        }
    }

    private join(): Joined<T, U> {
        const joined = {
            context: this.mainLine.clone(),
            mainLineState: this.mainLine.state,
            mainLineStart: this.mainLine.historyStartIndex,
            branchState: unopenedBranchView(this.mainLine.state, this.playerId),
            actionIds: []
        }
        this.append(joined, this.branch.actions)
        return joined
    }

    private append(joined: Joined<T, U>, branchActions: readonly GameAction[]): void {
        const { context } = joined
        let view = joined.branchState
        for (const branchAction of branchActions) {
            const before = context.state
            view = context.engine.applyProcessedAction({
                action: branchAction,
                state: view,
                game: context.game
            })
            const action = { ...structuredClone(branchAction), index: context.nextActionIndex }
            const state = {
                ...view,
                actionCount: action.index + 1,
                actionChecksum: calculateActionChecksum(before.actionChecksum, [action])
            }
            action.undoPatch = createPatch(state, before)
            action.forwardPatch = createPatch(before, state)
            context.applyActionResults(new GameActionResults([action], state))
            joined.actionIds.push(branchAction.id)
        }
        joined.branchState = this.branch.state
    }
}
