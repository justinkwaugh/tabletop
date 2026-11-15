import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Definition, EighteenNinetyFourRouteRules } from '@tabletop/1894'
import { InstructedRunSolver } from '@tabletop/18xx-ui'

describe('instructed runs', () => {
    it('answers for a company with no trains without starting the solver', async () => {
        const { state } = JSON.parse(
            readFileSync(new URL('../scenarios/private-two-powers.json', import.meta.url), 'utf8')
        )
        const hydrate = (raw: typeof state) =>
            Definition.runtime.hydrator.hydrateState(structuredClone(raw))
        let workers = 0
        const solver = new InstructedRunSolver(
            () => {
                workers++
                throw new Error('The solver should not start')
            },
            Definition.runtime,
            EighteenNinetyFourRouteRules,
            hydrate
        )
        const trainless = hydrate({
            ...state,
            trainInventory: {
                ...state.trainInventory,
                trains: state.trainInventory.trains.filter(
                    (train: { owner?: { companyId?: string } }) =>
                        train.owner?.companyId !== 'Belge'
                )
            }
        })
        await expect(solver.solveNow(trainless, 'Belge')).resolves.toMatchObject({ routes: [] })
        expect(workers).toBe(0)
    })
})
