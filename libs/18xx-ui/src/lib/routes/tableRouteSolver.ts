import { getContext, onDestroy, setContext } from 'svelte'
import { assertExists } from '@tabletop/common'
import { RouteSolveQueue, type QueuedRouteWorker } from './routeSolveQueue.js'

const TableRouteSolver = Symbol('table route solver')

/**
 * Gives a game table the one solver worker its panels share: the run projected while building
 * and the run step's own routes are answered by it in turn, so neither waits on a worker starting.
 */
export function provideTableRouteSolver(createWorker: () => QueuedRouteWorker): RouteSolveQueue {
    const solver = new RouteSolveQueue(createWorker)
    setContext(TableRouteSolver, solver)
    onDestroy(() => solver.destroy())
    return solver
}

export function tableRouteSolver(): RouteSolveQueue {
    const solver = getContext<RouteSolveQueue | undefined>(TableRouteSolver)
    assertExists(solver, 'Routes are solved inside a game table')
    return solver
}
