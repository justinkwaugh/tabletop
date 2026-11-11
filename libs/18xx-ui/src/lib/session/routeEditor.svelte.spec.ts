import { describe, expect, it } from 'vitest'
import { HexOrientation, assertExists } from '@tabletop/common'
import {
    RailwayMap,
    TileEdges,
    TrainDepot,
    createCityTileFace,
    type TileEdge,
    type TileFace,
    type RevenueCenter,
    type RoutePath
} from '@tabletop/18xx'
import {
    minimalPlayState,
    minimalRouteRules,
    minimalTileSet,
    TestCompanyId
} from '@tabletop/18xx/testing'
import type { MapSelection } from '../maps/mapDrawing.js'
import { RouteEditor } from './routeEditor.svelte.js'

const map = new RailwayMap({
    id: 'line',
    name: 'Line',
    orientation: HexOrientation.Flat,
    locations: [0, 1, 2, 3, 4].map((r) => ({
        id: `a${r}`,
        coordinates: { q: 0, r },
        buildable: true,
        preprintedTile: createCityTileFace('green', [0, 3], 30, 1)
    }))
})
const depot = new TrainDepot({
    id: 'line-trains',
    trains: [
        { id: '2', name: '2', price: 100, distance: { measure: 'revenue-centers', maximum: 2 } },
        { id: '4', name: '4', price: 300, distance: { measure: 'revenue-centers', maximum: 4 } }
    ],
    supply: [
        { definitionId: '2', count: 1 },
        { definitionId: '4', count: 1 }
    ]
})

function drawing() {
    const state = {
        ...minimalPlayState(),
        trainInventory: depot.createInventory(),
        tileInventory: minimalTileSet.createInventory(),
        routeStep: { companyId: TestCompanyId }
    }
    state.stations.push({
        id: 'station',
        companyId: TestCompanyId,
        status: 'placed',
        position: { locationId: 'a1', nodeId: 'city', slot: 0 }
    })
    const [two, four] = ['2', '4'].map((definitionId) => {
        const train = depot.nextTrain(state.trainInventory, definitionId)
        assertExists(train)
        depot.purchase(state.trainInventory, train.id, definitionId, {
            kind: 'company',
            companyId: TestCompanyId
        })
        return train.id
    })
    return { editor: new RouteEditor(state, { ...minimalRouteRules, map, depot }), two, four }
}

const center = (row: number): RevenueCenter => ({ locationId: `a${row}`, nodeId: 'city' })
const stop = (row: number): MapSelection => ({ kind: 'node', ...center(row) })
function line(from: number, to: number): RoutePath[] {
    const step = to > from ? 1 : -1
    const paths: RoutePath[] = []
    for (let row = from; row !== to; row += step)
        paths.push(
            { locationId: `a${row}`, pathId: step > 0 ? 'edge-0' : 'edge-3' },
            { locationId: `a${row + step}`, pathId: step > 0 ? 'edge-3' : 'edge-0' }
        )
    return paths
}

describe('RouteEditor', () => {
    it('starts a route at a tapped stop and joins the next one along the track between', () => {
        const { editor, four } = drawing()
        editor.selectTrain(four, [])
        expect(editor.trainId).toBe(four)
        expect(editor.tap(stop(1))).toBe(true)
        expect(editor.routes).toEqual([])
        expect(editor.tap(stop(3))).toBe(true)
        expect(editor.routes).toEqual([{ trainId: four, start: center(1), paths: line(1, 3) }])
        expect(editor.evaluated?.result?.revenue).toBe(90)
    })

    it('extends a route from its start when the tapped stop lies behind it', () => {
        const { editor, four } = drawing()
        editor.selectTrain(four, [{ trainId: four, start: center(1), paths: line(1, 3) }])
        expect(editor.tap(stop(0))).toBe(true)
        expect(editor.routes).toEqual([{ trainId: four, start: center(3), paths: line(3, 0) }])
    })

    it('cuts a route back at a tapped stop on it, and drops it from its lone start', () => {
        const { editor, four } = drawing()
        editor.selectTrain(four, [{ trainId: four, start: center(1), paths: line(1, 4) }])
        editor.tap(stop(3))
        expect(editor.routes[0].paths).toEqual(line(1, 3))
        editor.tap(stop(3))
        expect(editor.routes[0].paths).toEqual(line(1, 2))
        editor.tap(stop(1))
        expect(editor.routes).toEqual([])
        expect(editor.draft?.routes).toEqual([{ trainId: four, start: center(1), paths: [] }])
        editor.tap(stop(1))
        expect(editor.draft?.routes).toEqual([])
    })

    it('leaves a route alone where no legal track reaches the tapped stop', () => {
        const { editor, two } = drawing()
        editor.selectTrain(two, [])
        editor.tap(stop(1))
        expect(editor.tap(stop(3))).toBe(false)
        expect(editor.draft?.routes).toEqual([{ trainId: two, start: center(1), paths: [] }])
    })

    it('takes a route along a tapped piece of track to the stop beyond it', () => {
        const { editor, four } = drawing()
        editor.selectTrain(four, [])
        editor.tap({ kind: 'hex', locationId: 'a1' })
        expect(editor.tap({ kind: 'path', locationId: 'a3', pathId: 'edge-3' })).toBe(true)
        expect(editor.routes[0].paths).toEqual(line(1, 3))
    })

    it('joins along the fewest hexes, and takes another line through a tapped piece of its track', () => {
        const cells = { from: [0, 0], short: [0, 1], to: [0, 2], round: [1, 0], back: [1, 1] }
        const grid = new RailwayMap({
            id: 'grid',
            name: 'Grid',
            orientation: HexOrientation.Flat,
            locations: Object.entries(cells).map(([id, [q, r]]) => ({
                id,
                coordinates: { q, r },
                buildable: true,
                preprintedTile: createCityTileFace('green', [], 30, 1)
            }))
        })
        const edge = (from: string, to: string) => {
            const found = TileEdges.find((candidate) => grid.neighbor(from, candidate)?.id === to)
            assertExists(found)
            return found
        }
        const plain = (a: TileEdge, b: TileEdge): TileFace => ({
            color: 'yellow',
            labels: [],
            nodes: [],
            paths: [
                {
                    id: 'track',
                    endpoints: [
                        { kind: 'edge', edge: a },
                        { kind: 'edge', edge: b }
                    ]
                }
            ]
        })
        const lines = new RailwayMap({
            ...grid.definition,
            locations: grid.definition.locations.map((location) => ({
                ...location,
                preprintedTile:
                    location.id === 'from'
                        ? createCityTileFace(
                              'green',
                              [edge('from', 'short'), edge('from', 'round')],
                              30,
                              1
                          )
                        : location.id === 'to'
                          ? createCityTileFace(
                                'green',
                                [edge('to', 'short'), edge('to', 'back')],
                                30,
                                1
                            )
                          : location.id === 'short'
                            ? plain(edge('short', 'from'), edge('short', 'to'))
                            : location.id === 'round'
                              ? plain(edge('round', 'from'), edge('round', 'back'))
                              : plain(edge('back', 'round'), edge('back', 'to'))
            }))
        })
        const state = {
            ...minimalPlayState(),
            trainInventory: depot.createInventory(),
            tileInventory: minimalTileSet.createInventory(),
            routeStep: { companyId: TestCompanyId }
        }
        state.stations.push({
            id: 'station',
            companyId: TestCompanyId,
            status: 'placed',
            position: { locationId: 'from', nodeId: 'city', slot: 0 }
        })
        const train = depot.nextTrain(state.trainInventory, '2')
        assertExists(train)
        depot.purchase(state.trainInventory, train.id, '2', {
            kind: 'company',
            companyId: TestCompanyId
        })
        const fresh = () => {
            const editor = new RouteEditor(state, { ...minimalRouteRules, map: lines, depot })
            editor.selectTrain(train.id, [])
            editor.tap({ kind: 'hex', locationId: 'from' })
            return editor
        }
        const short = fresh()
        short.tap({ kind: 'hex', locationId: 'to' })
        expect(short.routes[0].paths.map((path) => path.locationId)).toEqual([
            'from',
            'short',
            'to'
        ])
        const round = fresh()
        expect(round.tap({ kind: 'path', locationId: 'back', pathId: 'track' })).toBe(true)
        expect(round.routes[0].paths.map((path) => path.locationId)).toEqual([
            'from',
            'round',
            'back',
            'to'
        ])
    })

    it('keeps every other train’s route and says why a drawn run cannot run', () => {
        const { editor, two, four } = drawing()
        editor.selectTrain(four, [{ trainId: two, start: center(1), paths: line(1, 2) }])
        editor.tap(stop(1))
        editor.tap(stop(3))
        expect(editor.routes.map((route) => route.trainId)).toEqual([two, four])
        expect(editor.evaluated?.reason).toBe('The submitted routes share track or a hex border.')
        expect(editor.result?.routes.map((route) => route.revenue)).toEqual([60, 90])
    })

    it('drops the whole drawing with one Undo, however many taps made it', () => {
        const { editor, four } = drawing()
        editor.selectTrain(four, [])
        editor.tap(stop(1))
        editor.tap(stop(3))
        editor.tap(stop(2))
        expect(editor.hasManual()).toBe(true)
        expect(editor.undo()).toBe(true)
        expect(editor.draft).toBeUndefined()
        expect(editor.hasManual()).toBe(false)
        expect(editor.undo()).toBe(false)
    })

    it('clears the chosen train’s route alone, keeping it chosen to start again', () => {
        const { editor, two, four } = drawing()
        editor.selectTrain(four, [
            { trainId: two, start: center(1), paths: line(1, 2) },
            { trainId: four, start: center(1), paths: line(1, 3) }
        ])
        editor.clearTrain()
        expect(editor.routes.map((route) => route.trainId)).toEqual([two])
        expect(editor.trainId).toBe(four)
        editor.tap(stop(3))
        editor.tap(stop(4))
        expect(editor.routes[1]).toEqual({ trainId: four, start: center(3), paths: line(3, 4) })
    })

    it('lets a chosen train go when it is chosen again', () => {
        const { editor, four } = drawing()
        editor.selectTrain(four, [])
        editor.selectTrain(four, [])
        expect(editor.trainId).toBeUndefined()
        expect(editor.tap(stop(1))).toBe(false)
    })
})
