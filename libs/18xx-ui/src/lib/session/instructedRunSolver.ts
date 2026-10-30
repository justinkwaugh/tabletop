import {
    GameEngine,
    type GameAction,
    type GameRuntime,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import type { ActionTarget } from '@tabletop/frontend-components'
import {
    atRunningStep,
    isSetRunInstruction,
    trainRoutesOf,
    type EighteenXXState,
    type HydratedEighteenXXState,
    type InstructedRun,
    type RouteRules
} from '@tabletop/18xx'
import { routeProblemKey } from '@tabletop/18xx-autorouter'
import { RouteSolveQueue, type QueuedRouteWorker } from '../routes/routeSolveQueue.js'
import { withInstructedRuns } from './instructedRunRefresh.js'

// Long enough for every recorded position, the slowest of which solves in about 0.3 s.
const InstructedRunTimeLimitMs = 1000

export class InstructedRunSolver<
    Raw extends GameState,
    Hydrated extends HydratedGameState<Raw> & Raw
> {
    readonly #queue: RouteSolveQueue
    readonly #engine: GameEngine<Raw, Hydrated>
    constructor(
        createWorker: () => QueuedRouteWorker,
        runtime: GameRuntime<Raw, Hydrated>,
        private readonly routeRules: RouteRules,
        private readonly hydrateRailway: (state: Raw) => HydratedEighteenXXState
    ) {
        this.#queue = new RouteSolveQueue(createWorker)
        this.#engine = new GameEngine(runtime)
    }

    destroy() {
        this.#queue.destroy()
    }

    solveNow(state: HydratedEighteenXXState, companyId: string): Promise<InstructedRun> {
        return this.solve(
            state.dehydrate(),
            companyId,
            routeProblemKey(state, this.routeRules, companyId)
        )
    }

    withRuns(
        action: GameAction,
        { game, state, perspective }: ActionTarget<Raw>
    ): Promise<GameAction> | GameAction {
        const declaring = isSetRunInstruction(action) && action.instruction !== undefined
        if (!declaring && !this.hydrateRailway(state).runInstructions?.length) return action
        const engine = this.#engine
        return withInstructedRuns(action, {
            simulate: (candidate) =>
                engine.execute({ action: candidate, state, game, perspective }).actionCascade,
            read: this.hydrateRailway,
            key: (position, companyId) =>
                routeProblemKey(this.hydrateRailway(position), this.routeRules, companyId),
            solve: (position, companyId, key) =>
                this.solve(this.hydrateRailway(position).dehydrate(), companyId, key)
        })
    }

    private async solve(
        state: EighteenXXState,
        companyId: string,
        key: string
    ): Promise<InstructedRun> {
        const { result } = await this.#queue.solve({
            state: atRunningStep(state, companyId),
            companyId,
            timeLimitMs: InstructedRunTimeLimitMs
        })
        return result?.exhaustive
            ? { routes: trainRoutesOf(result.result), key }
            : { unsolved: true, key }
    }
}
