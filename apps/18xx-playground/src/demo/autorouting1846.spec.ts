import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { assert, assertExists } from '@tabletop/common'
import { isRunTrains } from '@tabletop/18xx'
import { RouteRules1846 } from '@tabletop/1846'
import { Autorouter } from '../../../../libs/18xx-autorouter/src/autorouter.js'
import { finishedGame } from './finishedGame.js'

it('solves Erie in the finished 1846 game OR 6.2 without exhausting the time budget', async () => {
    const replay = await finishedGame('local-user', 'Finished game', '1846')
    let state = replay.state
    let recordedRevenue: number | undefined
    for (const action of [...replay.actions].reverse()) {
        state = replay.engine.undoProcessedAction({ state, action })
        if (
            isRunTrains(action) &&
            action.companyId === 'ERIE' &&
            state.operatingSet?.number === 6 &&
            state.operatingSet.roundNumber === 2
        ) {
            recordedRevenue = action.metadata?.revenue
            break
        }
    }
    assertExists(recordedRevenue, 'The recording includes Erie in OR 6.2')
    assert(state.routeStep?.companyId === 'ERIE', 'Erie is ready to run')
    const bytes = await readFile(
        new URL('../../../../libs/18xx-autorouter/esm/solver.wasm', import.meta.url)
    )
    const router = await Autorouter.create(new Uint8Array(bytes).buffer)
    const started = performance.now()
    const solution = router.solve(state, RouteRules1846, 'ERIE')
    const elapsed = performance.now() - started
    expect(solution.result.revenue).toBeGreaterThanOrEqual(recordedRevenue)
    expect(elapsed).toBeLessThan(500)
    expect(solution.exhaustive).toBe(true)
}, 120000)
