import { describe, expect, it } from 'vitest'
import { RouteEvaluation, type TrainRoute } from '@tabletop/18xx'
import { position, type Placement } from '../test/position.js'
import { rotationFor, route } from '../test/flow.js'
import { RouteRules1833NE } from './routes.js'

const tile = (locationId: string, definitionId: string, edges: number[]): Placement => ({
    locationId,
    definitionId,
    rotation: rotationFor(definitionId, edges)
})

function trainIds(state: ReturnType<typeof position>, companyId: string): string[] {
    return state.trainInventory.trains.flatMap((train) =>
        train.status === 'owned' &&
        train.owner.kind === 'company' &&
        train.owner.companyId === companyId
            ? [train.id]
            : []
    )
}

function run(state: ReturnType<typeof position>, companyId: string, routes: TrainRoute[]) {
    state.routeStep = { companyId }
    return new RouteEvaluation(state, RouteRules1833NE).evaluate(companyId, routes)
}

describe('interconnections (§6.66)', () => {
    // The Fitchburg with two 2+1s, Troy to Fitchburg and Fitchburg to a green Boston.
    const fitchburg = () =>
        position(
            [
                tile('C18', '18xx:9', [2, 5]),
                tile('D19', '18xx:4', [2, 5]),
                tile('E20', '18xx:14', [1, 2, 4, 5]),
                tile('F21', '18xx:4', [2, 5]),
                tile('F19', '18xx:57', [1, 4]),
                { locationId: 'G22', definitionId: '1833ne:N23', rotation: 4 }
            ],
            [{ companyId: 'FRR', locationId: 'E20' }],
            { FRR: ['2+1', '2+1'] }
        )

    it('pays two plain routes $160', () => {
        const state = fitchburg()
        const [first, second] = trainIds(state, 'FRR')
        const result = run(state, 'FRR', [
            route(state, first, { locationId: 'E20', nodeId: 'city' }, ['D19', 'C18', 'B17']),
            route(state, second, { locationId: 'E20', nodeId: 'city' }, ['F21', 'G22'])
        ])
        expect(result.reason).toBeUndefined()
        expect(result.result?.routes.map((entry) => entry.revenue)).toEqual([70, 90])
    })

    it('pays $170 with Troy to Fitchburg interconnecting to Boston on its own track', () => {
        const state = fitchburg()
        const [first, second] = trainIds(state, 'FRR')
        const result = run(state, 'FRR', [
            route(
                state,
                first,
                { locationId: 'B17', nodeId: 'offboard' },
                ['C18', 'D19', 'E20'],
                ['F21', 'G22']
            ),
            route(state, second, { locationId: 'E20', nodeId: 'city' }, ['F19'])
        ])
        expect(result.reason).toBeUndefined()
        expect(result.result?.routes.map((entry) => entry.revenue)).toEqual([120, 50])
        expect(result.result?.routes[0].bonuses).toEqual([
            { locationId: 'G22', amount: 50, sourceIds: ['interconnection'] }
        ])
    })

    it('refuses an extension sharing the other route’s track', () => {
        const state = fitchburg()
        const [first, second] = trainIds(state, 'FRR')
        const result = run(state, 'FRR', [
            route(
                state,
                first,
                { locationId: 'B17', nodeId: 'offboard' },
                ['C18', 'D19', 'E20'],
                ['F21', 'G22']
            ),
            route(state, second, { locationId: 'E20', nodeId: 'city' }, ['F21', 'G22'])
        ])
        expect(result.reason).toContain('share track')
    })
})

describe('direct connections (§6.66)', () => {
    const troyToBoston = (phaseId: string) =>
        position(
            [
                tile('C18', '18xx:9', [2, 5]),
                tile('D19', '18xx:4', [2, 5]),
                tile('E20', '18xx:14', [1, 2, 4, 5]),
                tile('F21', '18xx:4', [2, 5]),
                { locationId: 'G22', definitionId: '1833ne:N23', rotation: 4 }
            ],
            [{ companyId: 'FRR', locationId: 'E20' }],
            { FRR: ['3/5'] },
            phaseId
        )

    it('adds the chart’s Albany/Troy–Boston total in phases I–II and nothing from III', () => {
        for (const [phaseId, revenue] of [
            // A 3/5 counts Troy, Fitchburg and Boston of the five it visits.
            ['II', 30 + 30 + 50 + 100],
            ['III', 50 + 30 + 50]
        ] as const) {
            const state = troyToBoston(phaseId)
            const [train] = trainIds(state, 'FRR')
            const result = run(state, 'FRR', [
                route(state, train, { locationId: 'B17', nodeId: 'offboard' }, [
                    'C18',
                    'D19',
                    'E20',
                    'F21',
                    'G22'
                ])
            ])
            expect(result.reason).toBeUndefined()
            expect(result.result?.revenue).toBe(revenue)
        }
    })
})
