import { readFile } from 'node:fs/promises'
import { Autorouter } from '@tabletop/18xx-autorouter'
import { expect, it } from 'vitest'
import { Definition } from './definition/gameDefinition.js'
import { RouteRules1862 } from './routeRules.js'
import type { State1862 } from './state.js'

it('keeps a positive partial WSTI fleet within a 150 ms search', async () => {
    const bytes = await readFile(
        new URL('../../../libs/18xx-autorouter/esm/solver.wasm', import.meta.url)
    )
    const router = await Autorouter.create(new Uint8Array(bytes).buffer)
    const raw: State1862 = JSON.parse(
        await readFile(new URL('../test/fixtures/wsti-10-trains.json', import.meta.url), 'utf8')
    )
    const state = Definition.runtime.hydrator.hydrateState(raw)
    const solved = router.solve(state, RouteRules1862, 'WSTI', { timeLimitMs: 150 })
    expect(solved.result.revenue).toBeGreaterThanOrEqual(140)
})
