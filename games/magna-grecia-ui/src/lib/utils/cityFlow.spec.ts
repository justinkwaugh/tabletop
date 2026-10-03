import { describe, expect, it } from 'vitest'
import { HydratedBoard, offsetToAxial } from '@tabletop/magna-grecia'
import { CityFlowMode, cityFlowDuration, cityFlowFrame, cityFlowPlan } from './cityFlow.js'

type CityData = { id: string; playerId: string; cols: number[] }

const at = (col: number) => offsetToAxial({ row: 3, col })

function board(cities: CityData[]) {
    return new HydratedBoard({
        roads: [],
        cities: cities.map(({ id, playerId, cols }) => ({ id, playerId, spaces: cols.map(at) })),
        oracles: [],
        markets: [],
        nextCityNumber: 9
    })
}

describe('city flow plan', () => {
    it('founds a city from its centre with a rising temple', () => {
        const plan = cityFlowPlan(board([]), board([{ id: 'C1', playerId: 'p0', cols: [3] }]))
        expect(plan).toMatchObject({ founding: true, merge: false, reversed: false })
        expect(plan?.hiddenCityIds).toEqual([])
        expect(plan?.temples.map((temple) => temple.kind)).toEqual(['add'])
    })

    it('pours an added tile out of the edge it shares with the city', () => {
        const plan = cityFlowPlan(
            board([{ id: 'C1', playerId: 'p0', cols: [3] }]),
            board([{ id: 'C1', playerId: 'p0', cols: [3, 4] }])
        )
        expect(plan).toMatchObject({ founding: false, merge: false, hiddenCityIds: ['C1'] })
        expect(plan?.regions).toHaveLength(1)
        expect(plan?.temples.map((temple) => temple.kind)).toEqual(['keep'])
        expect(plan?.houses.some((house) => house.kind === 'add')).toBe(true)
    })

    it('meets two lobes in the middle when a tile merges two cities', () => {
        const plan = cityFlowPlan(
            board([
                { id: 'C1', playerId: 'p0', cols: [3] },
                { id: 'C2', playerId: 'p0', cols: [5] }
            ]),
            board([{ id: 'C1', playerId: 'p0', cols: [3, 4, 5] }])
        )
        expect(plan).toMatchObject({ merge: true, hiddenCityIds: ['C1', 'C2'] })
        expect(plan?.regions).toHaveLength(2)
        expect(plan?.temples.map((temple) => temple.kind).sort()).toEqual(['keep', 'remove'])
    })

    it("treats an opponent's neighbouring city as open land", () => {
        const plan = cityFlowPlan(
            board([
                { id: 'C1', playerId: 'p0', cols: [3] },
                { id: 'C2', playerId: 'p1', cols: [5] }
            ]),
            board([
                { id: 'C1', playerId: 'p0', cols: [3, 4] },
                { id: 'C2', playerId: 'p1', cols: [5] }
            ])
        )
        expect(plan).toMatchObject({ merge: false, hiddenCityIds: ['C1'] })
        expect(plan?.regions).toHaveLength(1)
    })

    it('plays an undone tile backwards, hiding the larger city', () => {
        const plan = cityFlowPlan(
            board([{ id: 'C1', playerId: 'p0', cols: [3, 4] }]),
            board([{ id: 'C1', playerId: 'p0', cols: [3] }])
        )
        expect(plan).toMatchObject({ reversed: true, hiddenCityIds: ['C1'] })
    })

    it('leaves changes of more than one tile to the state swap', () => {
        expect(
            cityFlowPlan(
                board([{ id: 'C1', playerId: 'p0', cols: [3] }]),
                board([{ id: 'C1', playerId: 'p0', cols: [3, 4, 5] }])
            )
        ).toBeUndefined()
    })

    it('keeps undo and history steps within 200ms', () => {
        const plan = cityFlowPlan(
            board([
                { id: 'C1', playerId: 'p0', cols: [3] },
                { id: 'C2', playerId: 'p0', cols: [5] }
            ]),
            board([{ id: 'C1', playerId: 'p0', cols: [3, 4, 5] }])
        )!
        expect(cityFlowDuration(plan, CityFlowMode.Fast)).toBeLessThanOrEqual(200)
    })

    it('ends on the settled city: straight edges, every house up, absorbed temple gone', () => {
        const plan = cityFlowPlan(
            board([
                { id: 'C1', playerId: 'p0', cols: [3] },
                { id: 'C2', playerId: 'p0', cols: [5] }
            ]),
            board([{ id: 'C1', playerId: 'p0', cols: [3, 4, 5] }])
        )!
        for (const mode of [CityFlowMode.Action, CityFlowMode.Fast]) {
            const end = cityFlowFrame(plan, mode, cityFlowDuration(plan, mode))
            plan.houses.forEach((house, i) =>
                expect(end.houses[i].opacity).toBe(house.kind === 'remove' ? 0 : 1)
            )
            expect(end.temples.map((temple) => temple.opacity).sort()).toEqual([0, 1])
            expect(end.edges.filter((edge) => edge.opacity > 0).length).toBeGreaterThan(0)
            for (const edge of end.edges.filter((edge) => edge.opacity > 0)) {
                const [ax, ay, cx, cy, bx, by] = edge.d
                    .replace(/[MQ]/g, '')
                    .trim()
                    .split(/\s+/)
                    .map(Number)
                expect(cx).toBeCloseTo((ax + bx) / 2, 6)
                expect(cy).toBeCloseTo((ay + by) / 2, 6)
            }
        }
    })
})
