import { readFile } from 'node:fs/promises'
import { beforeAll, expect, it } from 'vitest'
import { assertExists, Color } from '@tabletop/common'
import { Autorouter } from '@tabletop/18xx-autorouter'
import { RouteEvaluation, type TrainRunningState } from '@tabletop/18xx'
import { exhaustiveRevenue } from '../../../libs/18xx-autorouter/test/exhaustiveRevenue.js'
import { createTheOldPrinceCompanyExample } from './companyExamples.js'
import { TheOldPrinceRouteRules } from './routeRules.js'
import { TheOldPrinceTrainDepot } from './trains.js'

let router: Autorouter
beforeAll(async () => {
    const bytes = await readFile(
        new URL('../../../libs/18xx-autorouter/esm/solver.wasm', import.meta.url)
    )
    router = await Autorouter.create(new Uint8Array(bytes).buffer)
})
const players = [
    { playerId: 'alex', color: Color.Blue },
    { playerId: 'blair', color: Color.Red },
    { playerId: 'casey', color: Color.Green }
]
it('solves the title map with its own rules for every train type', () => {
    for (const definition of TheOldPrinceTrainDepot.definition.trains) {
        const state: TrainRunningState = {
            ...createTheOldPrinceCompanyExample(players, 'routes'),
            routeStep: { companyId: 'ML' }
        }
        state.phaseId = definition.id
        state.trainInventory = TheOldPrinceTrainDepot.createInventory()
        const train = TheOldPrinceTrainDepot.nextTrain(state.trainInventory, definition.id)
        assertExists(train, 'Expected a train in the depot')
        TheOldPrinceTrainDepot.purchase(state.trainInventory, train.id, definition.id, {
            kind: 'company',
            companyId: 'ML'
        })
        const before = structuredClone(state)
        const result = router.solve(state, TheOldPrinceRouteRules, 'ML')
        expect(result.exhaustive, definition.id).toBe(true)
        expect(result.result.revenue, definition.id).toBeGreaterThan(0)
        expect(result.result.revenue, definition.id).toBe(
            exhaustiveRevenue(state, TheOldPrinceRouteRules, 'ML')
        )
        expect(
            new RouteEvaluation(state, TheOldPrinceRouteRules).evaluate('ML', result.result.routes)
                .result
        ).toEqual(result.result)
        expect(state).toEqual(before)
    }
})
it('solves the prepared fleet without sharing track', () => {
    const state: TrainRunningState = {
        ...createTheOldPrinceCompanyExample(players, 'routes'),
        routeStep: { companyId: 'ML' }
    }
    const result = router.solve(state, TheOldPrinceRouteRules, 'ML')
    expect(result.exhaustive).toBe(true)
    expect(result.result.revenue).toBe(exhaustiveRevenue(state, TheOldPrinceRouteRules, 'ML'))
    expect(result.result.routes).toHaveLength(2)
})
