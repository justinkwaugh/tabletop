import { describe, expect, it } from 'vitest'
import { RouteEvaluation, type TrainRoute } from '@tabletop/18xx'
import { position, type Placement } from '../test/position.js'
import { rotationFor, route } from '../test/flow.js'
import { ferryValue } from './ferries.js'
import { RouteRules1833NE, routeBonusPolicy } from './routes.js'

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
            {
                locationId: 'G22',
                amount: 50,
                sourceIds: ['interconnection'],
                arrowIds: ['albany-troy-to-boston']
            }
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

    it('names the direct arrow and the interconnection it adds as paying the bonus', () => {
        const state = troyToBoston('II')
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
        expect(result.result?.routes[0].bonuses).toEqual([
            {
                locationId: 'B17',
                amount: 100,
                sourceIds: ['direct'],
                arrowIds: ['boston-and-albany-troy', 'albany-troy-to-boston']
            }
        ])
    })
})

describe('bonus arrows paying each bonus', () => {
    const policy = (phaseId: string, owned: Record<string, string> = {}) => {
        const state = position([], [], {}, phaseId)
        for (const [privateId, companyId] of Object.entries(owned)) {
            const certificate = state.certificates.find(
                (entry) => entry.companyId === privateId && entry.kind === 'private'
            )!
            certificate.owner = { kind: 'company', companyId }
        }
        return routeBonusPolicy(state, 'FRR')
    }

    it('names only the arrows with a value in the phase', () => {
        const { connectionBonuses, interconnections } = policy('III')
        expect(connectionBonuses?.map((bonus) => bonus.arrowIds)).toEqual([
            ['boston-and-new-york'],
            ['boston-and-north', 'boston-to-montreal', 'montreal-to-boston'],
            ['boston-and-north', 'boston-to-ogdensburg', 'ogdensburg-to-boston'],
            ['montreal-port-city'],
            ['montreal-to-portland', 'portland-to-montreal'],
            []
        ])
        expect(interconnections?.map((bonus) => bonus.arrowIds)).toEqual([
            ['boston-to-montreal'],
            ['montreal-to-boston'],
            ['boston-to-ogdensburg'],
            ['ogdensburg-to-boston'],
            ['montreal-to-portland'],
            ['portland-to-montreal']
        ])
    })

    it('keeps the arrows when the Ogdensburg private doubles them', () => {
        const { connectionBonuses, interconnections } = policy('II', { P4: 'FRR' })
        expect(connectionBonuses?.find((bonus) => bonus.sourceId === 'P4')).toMatchObject({
            arrowIds: ['boston-and-north', 'boston-to-ogdensburg', 'ogdensburg-to-boston'],
            from: { A6: (50 + 30 + 40) * 2 }
        })
        expect(interconnections?.find((bonus) => bonus.sourceId === 'P4')).toMatchObject({
            amount: 40 * 2,
            arrowIds: ['ogdensburg-to-boston']
        })
    })
})

describe('ferry bonus (§6.56–6.57)', () => {
    it('adds +20 on its New side and +10 on its Last, doubled by the Luxury Ferry Service', () => {
        const state = {
            phaseId: 'II',
            ferries: [{ locationId: 'F27', companyId: 'B&P' }],
            ferryBonus: { locationId: 'F27', side: 'new' as const }
        }
        expect(ferryValue(state, 'B&P', 'F27')).toBe(40)
        expect(
            ferryValue(
                { ...state, ferryBonus: { ...state.ferryBonus, side: 'last' } },
                'B&P',
                'F27'
            )
        ).toBe(30)
        expect(
            ferryValue(
                {
                    ...state,
                    ferries: [{ locationId: 'F27', companyId: 'B&P', luxury: true as const }],
                    ferryBonus: { locationId: 'F27', side: 'last' }
                },
                'B&P',
                'F27'
            )
        ).toBe(60)
        expect(ferryValue({ ...state, phaseId: 'IV' }, 'B&P', 'F27')).toBe(0)
    })
})
