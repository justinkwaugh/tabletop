import { describe, expect, it } from 'vitest'
import {
    RouteEvaluation,
    atRunningStep,
    homeStationId,
    type TileRotation,
    type TrainRoute
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { RouteRules1860 } from './routes.js'
import type { State1860 } from './state.js'
import { TileSet1860 } from './tiles.js'
import { kit } from '../test/kit.js'
import { openedWith, running, seated } from '../test/positions.js'

/** Lays a tile straight onto the board, as a prepared position. */
function place(state: State1860, locationId: string, number: string, rotation: TileRotation): void {
    const definitionId = TileSet1860.definitions.find(
        (tile) => tile.printedNumber === number && tile.id.endsWith(`:${number}`)
    )?.id
    assertExists(definitionId, `No tile ${number}`)
    const [piece] = TileSet1860.availablePieces(state.tileInventory, definitionId)
    assertExists(piece, `No ${number} left`)
    state.tileInventory = TileSet1860.replace(state.tileInventory, {
        locationId,
        placement: { pieceId: piece.id, definitionId, rotation },
        returnPrevious: true
    })
}

function station(state: State1860, companyId: string, locationId: string, slot = 0): void {
    const id = state.stations.find(
        (entry) => entry.companyId === companyId && entry.status === 'available'
    )?.id
    assertExists(id, `${companyId} has a station left`)
    state.stations = state.stations.map((entry) =>
        entry.id === id
            ? {
                  id,
                  companyId,
                  status: 'placed',
                  position: { locationId, nodeId: 'city', slot }
              }
            : entry
    )
}

/**
 * The IOW at home in Ryde Esplanade, with track on to Ryde, the St. Helens halt and Bembridge,
 * and from Bembridge on to Sandown.
 */
function ryde(prepare: (state: State1860) => void = () => {}) {
    const game = openedWith(seated(3))
    const state = structuredClone(game.state)
    running(state, 'IOW', 'p3')
    place(state, 'J4', '57', 2)
    place(state, 'K5', '743', 2)
    place(state, 'L6', '5', 1)
    place(state, 'K7', '9', 1)
    place(state, 'J8', '115', 4)
    prepare(state)
    game.state = state
    return game
}

function evaluate(state: State1860, routes: readonly TrainRoute[]) {
    return new RouteEvaluation(atRunningStep(state, 'IOW'), RouteRules1860).evaluate('IOW', routes)
}

const home = { locationId: 'I3', nodeId: 'city' }

describe('runs', () => {
    it('calls at a halt for a £10 subsidy beside the revenue (RT-1, RT-3)', () => {
        let trainId = ''
        const game = ryde((state) => {
            trainId = kit.giveTrain(state, 'IOW', '3+2')
        })
        const result = evaluate(game.state, [
            kit.route(game.state, trainId, home, ['J4', 'K5', 'L6'])
        ])
        expect(result.reason).toBeUndefined()
        expect(result.result?.revenue).toBe(30 + 20 + 20)
        expect(result.result?.subsidy).toBe(10)
    })

    it('never ends a run at a halt (RT-1)', () => {
        let trainId = ''
        const game = ryde((state) => {
            trainId = kit.giveTrain(state, 'IOW', '3+2')
        })
        expect(
            evaluate(game.state, [kit.route(game.state, trainId, home, ['J4', 'K5'])]).reason
        ).toMatch(/halt/)
    })

    it('counts no more large stations than the train’s first number (RT-1)', () => {
        let trainId = ''
        const game = ryde((state) => {
            running(state, 'BHIR', 'p1')
            trainId = kit.giveTrain(state, 'BHIR', '2+1')
        })
        const bembridge = { locationId: 'L6', nodeId: 'city' }
        const evaluation = (routes: readonly TrainRoute[]) =>
            new RouteEvaluation(atRunningStep(game.state, 'BHIR'), RouteRules1860).evaluate(
                'BHIR',
                routes
            )
        const short = evaluation([kit.route(game.state, trainId, bembridge, ['K5', 'J4'])])
        expect(short.result?.revenue).toBe(40)
        expect(short.result?.subsidy).toBe(10)
        expect(
            evaluation([kit.route(game.state, trainId, bembridge, ['K5', 'J4', 'I3'])]).reason
        ).toMatch(/distance/)
    })

    it('lets one train pass one tokened-out station, but not two (RT-6)', () => {
        let trainId = ''
        const game = ryde((state) => {
            trainId = kit.giveTrain(state, 'IOW', '4+2')
            running(state, 'CN', 'p2')
            station(state, 'CN', 'J4')
        })
        const through = kit.route(game.state, trainId, home, ['J4', 'K5', 'L6'])
        expect(evaluate(game.state, [through]).result?.revenue).toBe(70)
    })

    it('lets runs pass a bankrupt company’s flipped base freely (TK-5)', () => {
        let trainId = ''
        let second = ''
        const game = ryde((state) => {
            trainId = kit.giveTrain(state, 'IOW', '4+2')
            second = kit.giveTrain(state, 'IOW', '3+2')
            running(state, 'CN', 'p2')
            station(state, 'CN', 'J4')
            station(state, 'IOW', 'L6')
            state.bankruptIds = ['CN']
        })
        const bembridge = { locationId: 'L6', nodeId: 'city' }
        const result = evaluate(game.state, [
            kit.route(game.state, trainId, home, ['J4', 'K5', 'L6']),
            kit.route(game.state, second, bembridge, ['K7', 'J8'])
        ])
        expect(result.reason).toBeUndefined()
    })

    it('needs each run to meet another at a station, one through the home (RT-5)', () => {
        let first = ''
        let second = ''
        const game = ryde((state) => {
            first = kit.giveTrain(state, 'IOW', '2+1')
            second = kit.giveTrain(state, 'IOW', '2+1')
            station(state, 'IOW', 'L6')
        })
        const bembridge = { locationId: 'L6', nodeId: 'city' }
        const toRyde = kit.route(game.state, first, home, ['J4'])
        const apart = kit.route(game.state, second, bembridge, ['K7', 'J8'])
        expect(evaluate(game.state, [toRyde, apart]).reason).toMatch(/meet/)
        const meeting = kit.route(game.state, second, bembridge, ['K5', 'J4'])
        expect(evaluate(game.state, [toRyde, meeting]).reason).toBeUndefined()
        expect(evaluate(game.state, [apart]).reason).toMatch(/home/)
    })

    it('earns a leased train £40 and £20 a stop, its first number only (IN-6)', () => {
        const game = ryde((state) => {
            state.insolventIds = ['IOW']
            const account = state.cash.find(
                (entry) => entry.owner.kind === 'company' && entry.owner.companyId === 'IOW'
            )
            assertExists(account, 'The IOW has a treasury')
            account.amount = 0
        })
        const leased = RouteRules1860.leasedTrain?.(game.state, 'IOW')
        assertExists(leased, 'The insolvent IOW leases a train')
        expect(leased.definitionId).toBe('2+1')
        const result = evaluate(game.state, [kit.route(game.state, leased.id, home, ['J4'])])
        expect(result.result?.revenue).toBe(40 + 2 * 20)
        expect(result.result?.subsidy).toBeUndefined()
        // Two large stations fill the 2+1's first number; the halt cannot be called at.
        expect(
            evaluate(game.state, [kit.route(game.state, leased.id, home, ['J4', 'K5', 'L6'])])
                .reason
        ).toMatch(/distance/)
    })

    it('stops counting halts in a leased run once the Southern’s stock round has passed (IN-8)', () => {
        const insolvent = (southernStockRound: boolean) =>
            ryde((state) => {
                state.insolventIds = ['IOW']
                const account = state.cash.find(
                    (entry) => entry.owner.kind === 'company' && entry.owner.companyId === 'IOW'
                )
                assertExists(account, 'The IOW has a treasury')
                account.amount = 0
                // The bank's smallest train is a 4+2, whose allowance takes the halt as well.
                state.trainInventory.trains = state.trainInventory.trains.filter(
                    (train) => train.definitionId !== '2+1' && train.definitionId !== '3+2'
                )
                if (southernStockRound) state.southernStockRound = true
            })
        const revenue = (southernStockRound: boolean) => {
            const game = insolvent(southernStockRound)
            const leased = RouteRules1860.leasedTrain?.(game.state, 'IOW')
            assertExists(leased, 'The insolvent IOW leases a train')
            expect(leased.definitionId).toBe('4+2')
            const result = evaluate(game.state, [
                kit.route(game.state, leased.id, home, ['J4', 'K5', 'L6'])
            ])
            expect(result.reason).toBeUndefined()
            return result.result?.revenue
        }
        // Ryde Esplanade, Ryde, the St. Helens halt and Bembridge: four stops, then three.
        expect(revenue(false)).toBe(40 + 4 * 20)
        expect(revenue(true)).toBe(40 + 3 * 20)
    })

    it('does not lease to a company that can pay for the bank’s smallest train (IN-5)', () => {
        const game = ryde((state) => {
            state.insolventIds = ['IOW']
        })
        expect(RouteRules1860.leasedTrain?.(game.state, 'IOW')).toBeUndefined()
        expect(game.state.stations.find((s) => s.id === homeStationId('IOW'))?.status).toBe(
            'placed'
        )
    })
})
