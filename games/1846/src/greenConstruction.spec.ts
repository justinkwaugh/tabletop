import { describe, expect, it } from 'vitest'
import { assert, assertExists } from '@tabletop/common'
import {
    TrackConstruction,
    payingRouteStops,
    routeConnectionBonuses,
    type RouteRevenueStop
} from '@tabletop/18xx'
import { stockGame, layTrack } from './testSupport.js'
import { TrackRules1846 } from './track.js'
import { EighteenFortySixTileSet } from './tiles.js'
import { RouteRules1846 } from './routes.js'
import { TrainDepot1846 } from './trains.js'

function greenGame() {
    const table = stockGame()
    table.launch('NYC', 100)
    table.finishStockRound()
    table.state.phaseId = 'II'
    const treasury = table.state.cash.find(
        (c) => c.owner.kind === 'company' && c.owner.companyId === 'MS'
    )
    assertExists(treasury)
    treasury.amount = 200
    return table
}

function upgrade(table: ReturnType<typeof stockGame>) {
    const choice = new TrackConstruction(table.hydrated, TrackRules1846)
        .choices('C15')
        .find((c) => c.definitionId === '1846:294' && c.rotation === 0)
    assertExists(choice)
    return choice
}
describe('1846 green construction and routes', () => {
    it.each([true, false])(
        'permits a yellow lay and green upgrade in either order (upgrade first: %s)',
        (first) => {
            const table = greenGame()
            if (first) layTrack(table, upgrade(table))
            const yellow = new TrackConstruction(table.hydrated, TrackRules1846).choices('C13')[0]
            assertExists(yellow)
            layTrack(table, yellow)
            if (!first) layTrack(table, upgrade(table))
            expect(table.state.trackStep?.lays).toHaveLength(2)
            expect(new TrackConstruction(table.hydrated, TrackRules1846).choices('D14')).toEqual([])
            expect(table.state.stations.find((s) => s.companyId === 'MS')).toMatchObject({
                status: 'placed',
                position: { locationId: 'C15', nodeId: 'city', slot: 0 }
            })
        }
    )
    it('charges Detroit terrain and completed tunnel, records migration, and reverses the upgrade', () => {
        const table = greenGame(),
            before = structuredClone(table.state)
        const choice = upgrade(table)
        expect(choice.cost).toBe(100)
        const result = layTrack(table, choice)
        expect(
            EighteenFortySixTileSet.availablePieces(table.state.tileInventory, '1846:294')
        ).toHaveLength(1)
        let undone = table.state
        for (const action of result.processedActions.toReversed())
            undone = table.engine.undoProcessedAction({ state: undone, action })
        expect(undone).toEqual(before)
    })
    it('rejects green before phase II and a second ordinary upgrade', () => {
        const table = greenGame()
        table.state.phaseId = 'I'
        expect(new TrackConstruction(table.hydrated, TrackRules1846).choices('C15')).toEqual([])
        table.state.phaseId = 'II'
        layTrack(table, upgrade(table))
        expect(TrackRules1846.allowance(table.hydrated, 'green')).toHaveProperty('reason')
        expect(TrackRules1846.allowance(table.hydrated, 'yellow')).toEqual({ cost: 0 })
    })
    it('upgrades Chicago preserving four separate cities, tokens and the C&WI reservation', () => {
        const table = greenGame()
        const home = table.state.stations.find((s) => s.companyId === 'MS')
        assert(home?.status === 'placed')
        home.position = { locationId: 'D6', nodeId: 'city-0', slot: 0 }
        const choices = new TrackConstruction(table.hydrated, TrackRules1846).choices('D6')
        expect(choices).toHaveLength(1)
        expect(choices[0]).toMatchObject({ definitionId: '1846:298', rotation: 0, cost: 20 })
        layTrack(table, choices[0])
        expect(table.state.stations.find((s) => s.companyId === 'MS')).toMatchObject({
            position: home.position
        })
        expect(table.state.stationReservations.find((r) => r.companyId === 'C&WI')).toMatchObject({
            locationId: 'D6',
            nodeId: 'city-3'
        })
    })
    it('charges $20 when upgrading a paid terrain hex or an IC land grant', () => {
        const table = greenGame()
        for (const locationId of ['H16', 'E5']) {
            const previous = EighteenFortySixTileSet.availablePieces(
                table.state.tileInventory,
                '18xx:9'
            )[0]
            assertExists(previous)
            table.state.tileInventory = EighteenFortySixTileSet.replace(table.state.tileInventory, {
                locationId,
                placement: { pieceId: previous.id, definitionId: '18xx:9', rotation: 0 },
                returnPrevious: true
            })
            expect(
                TrackRules1846.terrainCost?.(
                    table.hydrated,
                    {
                        companyId: 'IC',
                        locationId,
                        definitionId: '18xx:23',
                        rotation: 0,
                        nodeMapping: {}
                    },
                    0
                )
            ).toBe(20)
        }
    })
    it('optimizes 3/5 counted stops including the East–West bonus and station', () => {
        const stops: RouteRevenueStop[] = [
            { locationId: 'C5', nodeId: 'offboard', amount: 20, bonus: 0, companyStation: false },
            { locationId: 'D6', nodeId: 'city', amount: 40, bonus: 0, companyStation: true },
            { locationId: 'C15', nodeId: 'city', amount: 50, bonus: 0, companyStation: false },
            { locationId: 'D14', nodeId: 'city', amount: 30, bonus: 0, companyStation: false },
            { locationId: 'C17', nodeId: 'offboard', amount: 40, bonus: 0, companyStation: false }
        ]
        const policy = RouteRules1846.revenuePolicy?.(TrainDepot1846.trainDefinition('3/5')) ?? {}
        const paying = payingRouteStops(stops, policy)
        assertExists(paying)
        expect(paying.map((s) => s.locationId)).toEqual(['C5', 'D6', 'C17'])
        expect(routeConnectionBonuses(paying, policy)).toEqual([
            { locationId: 'C17', amount: 30 },
            { locationId: 'C5', amount: 50 }
        ])
        expect(routeConnectionBonuses(stops.slice(1), policy)).toEqual([])
        expect(
            routeConnectionBonuses([stops[0], { ...stops[4], locationId: 'I1' }], policy)
        ).toEqual([])
    })
})
