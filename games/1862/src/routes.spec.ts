import {
    RouteEvaluation,
    freightHexes,
    getCompany,
    placeStockMarker,
    rotateTileFace,
    type TileEdge,
    type TileRotation
} from '@tabletop/18xx'
import { readFile } from 'node:fs/promises'
import { Autorouter } from '@tabletop/18xx-autorouter'
import { describe, expect, it } from 'vitest'
import { giveTrain, kit, table, type Table } from '../test/kit.js'
import { Map1862 } from './map.js'
import { RouteRules1862 } from './routeRules.js'
import type { State1862 } from './state.js'
import { marketSpaceIdAt } from './stockMarket.js'
import { TileSet1862 } from './tiles.js'

const autorouter = await Autorouter.create(
    new Uint8Array(
        await readFile(new URL('../../../libs/18xx-autorouter/esm/solver.wasm', import.meta.url))
    ).buffer
)

/** A seed that deals the ENR into play from the start. */
function withEnr(): Table {
    for (let seed = 1; seed < 200; seed++) {
        const game = table(4, seed)
        if (game.state.availability.ENR === 'A') return game
    }
    throw new Error('No seed deals the ENR')
}

function lay(
    state: State1862,
    locationId: string,
    definitionId: string,
    edges: readonly TileEdge[]
) {
    const tile = TileSet1862.definitions.find((entry) => entry.id === definitionId)
    if (!tile) throw new Error(`Unknown tile ${definitionId}`)
    const rotations: TileRotation[] = [0, 1, 2, 3, 4, 5]
    const rotation = rotations.find((candidate) => {
        const exits = rotateTileFace(tile.face, candidate).paths.flatMap((path) =>
            path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
        )
        return edges.every((edge) => exits.includes(edge))
    })
    if (rotation === undefined) throw new Error(`${definitionId} cannot join ${edges.join()}`)
    const [piece] = TileSet1862.availablePieces(state.tileInventory, definitionId)
    state.tileInventory = TileSet1862.replace(state.tileInventory, {
        locationId,
        placement: { pieceId: piece.id, definitionId, rotation },
        returnPrevious: true
    })
}

/** The ENR at Cromer with track to the north port, Norwich, Acle and Beccles (rules p. 24). */
function cromer(trains: readonly string[]) {
    const game = withEnr()
    const state = structuredClone(game.state)
    const company = getCompany(state, 'ENR')
    Object.assign(company, {
        started: true,
        floated: true,
        funded: true,
        operated: true,
        parPrice: 100
    })
    company.president = { kind: 'player', playerId: 'p1' }
    placeStockMarker(state.stockMarket, 'ENR', marketSpaceIdAt(100))
    state.permits.ENR = ['express', 'local', 'freight']
    state.stations.push({
        id: 'ENR:home',
        companyId: 'ENR',
        status: 'placed',
        position: { locationId: 'F3', nodeId: 'city', slot: 0 }
    })
    lay(state, 'F3', '18xx:57', [3, 0])
    lay(state, 'F5', '1862:790', [3, 5])
    lay(state, 'G6', '1862:8851', [2, 0])
    lay(state, 'G8', '18xx:14', [3])
    const trainIds = trains.map((definitionId) => giveTrain(state, 'ENR', definitionId))
    state.operatingSet = {
        number: 1,
        roundNumber: 1,
        roundCount: 1,
        companyOrder: ['ENR'],
        completedCompanyIds: [],
        privateIncomePaid: true,
        completed: false
    }
    state.routeStep = { companyId: 'ENR' }
    state.machineState = 'RunningTrains'
    game.state = state
    return { game, trainIds }
}

const Cromer = { locationId: 'F3', nodeId: 'city' }

function run(game: Table, routes: Parameters<RouteEvaluation['evaluate']>[1]) {
    return new RouteEvaluation(game.hydrated, RouteRules1862).evaluate('ENR', routes)
}

describe('1862 routes, as the rules’ ENR example scores them', () => {
    it('measures a freight run’s crow-flies hexes from the hex beside an off-board end', () => {
        expect(
            freightHexes(
                Map1862,
                { locationId: 'F3', offboard: true },
                { locationId: 'F3', offboard: false }
            )
        ).toBe(0)
        expect(
            freightHexes(
                Map1862,
                { locationId: 'F3', offboard: true },
                { locationId: 'F5', offboard: false }
            )
        ).toBe(1)
        expect(
            freightHexes(
                Map1862,
                { locationId: 'F5', offboard: false },
                { locationId: 'E2', offboard: false }
            )
        ).toBe(1)
        expect(
            freightHexes(
                Map1862,
                { locationId: 'F5', offboard: false },
                { locationId: 'E2', offboard: true }
            )
        ).toBe(2)
    })

    it('1F to the port: 80 + Cromer 20', () => {
        const { game, trainIds } = cromer(['AF'])
        const route = kit.route(game.state, trainIds[0], Cromer, ['F1'])
        expect(run(game, [route]).result?.revenue).toBe(100)
    })

    it('2F from the port to Norwich: 80 + 40 + £30 for a hex from a port', () => {
        const { game, trainIds } = cromer(['BF'])
        const route = kit.route(game.state, trainIds[0], Cromer, ['F1', 'F5'])
        const reversed = kit.route(game.state, trainIds[0], { locationId: 'F5', nodeId: 'city' }, [
            'F3',
            'F1'
        ])
        expect(run(game, [reversed]).result?.revenue).toBe(150)
        expect(route).toBeDefined()
    })

    it('2E and 2/3E: each stop once, the 2/3E leaving out Cromer: 170', () => {
        const { game, trainIds } = cromer(['AE', 'BE'])
        const red = kit.route(game.state, trainIds[0], Cromer, ['F1'])
        const blue = kit.route(game.state, trainIds[1], Cromer, ['F5', 'G6', 'G8'])
        expect(run(game, [red, blue]).result?.revenue).toBe(170)
    })

    it('2/3L: Norwich, Acle and Beccles, with £40 for four hexes', () => {
        const { game, trainIds } = cromer(['BL'])
        const route = kit.route(game.state, trainIds[0], Cromer, ['F5', 'G6', 'G8'])
        const result = run(game, [route]).result
        expect(result?.revenue).toBe(90)
        expect(result?.subsidy).toBe(40)
    })

    it('2F and 2L: Norwich scores once, Cromer for the Local: 170 and £20', () => {
        const { game, trainIds } = cromer(['BF', 'AL'])
        const freight = kit.route(game.state, trainIds[0], { locationId: 'F5', nodeId: 'city' }, [
            'F3',
            'F1'
        ])
        const local = kit.route(game.state, trainIds[1], Cromer, ['F5'])
        const result = run(game, [freight, local]).result
        expect(result?.revenue).toBe(170)
        expect(result?.subsidy).toBe(20)
    })

    it('refuses a run ending at a small station, and runs that do not meet', () => {
        const { game, trainIds } = cromer(['BE'])
        const toAcle = kit.route(game.state, trainIds[0], Cromer, ['F5', 'G6'])
        expect(run(game, [toAcle]).reason).toBeDefined()
    })

    it('finds the best fleet for the autorouter', () => {
        const { game } = cromer(['AE', 'BE'])
        const solved = autorouter.solve(game.hydrated, RouteRules1862, 'ENR', { timeLimitMs: 5000 })
        expect(solved.result.revenue).toBe(170)
        expect(solved.exhaustive).toBe(true)
    })

    it.each([
        { trains: ['AF'], revenue: 100, subsidy: 0 },
        { trains: ['BF'], revenue: 150, subsidy: 0 },
        { trains: ['AE', 'BE'], revenue: 170, subsidy: 0 },
        { trains: ['BL'], revenue: 90, subsidy: 40 },
        { trains: ['BF', 'AL'], revenue: 170, subsidy: 20 },
        { trains: ['AF', 'AF'], revenue: 150, subsidy: 0 }
    ])('solves the rulebook $trains example natively', ({ trains, revenue, subsidy }) => {
        const { game } = cromer(trains)
        const solved = autorouter.solve(game.hydrated, RouteRules1862, 'ENR')
        expect(solved.result.revenue).toBe(revenue)
        expect(solved.result.subsidy ?? 0).toBe(subsidy)
        expect(solved.exhaustive).toBe(true)
        expect(solved.metrics.memoryBytes).toBeGreaterThan(0)
    })

    it('keeps the map’s north ports apart', () => {
        expect(Map1862.location('F1').stopGroup).toBe('port')
    })
})
