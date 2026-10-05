import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { TrackConstruction, RailwayMapState, finiteCashOwnedBy } from '@tabletop/18xx'
import { constructionGame, layTrack, installTile, relocateStation } from './testSupport.js'
import { EighteenFortySixTileSet } from './tiles.js'
import { EighteenFortySixMap } from './map.js'
import { TrackRules1846 } from './track.js'

function choices(table: ReturnType<typeof constructionGame>, locationId: string) {
    return new TrackConstruction(table.hydrated, TrackRules1846).choices(locationId)
}

describe('1846 brown construction', () => {
    it('supplies the complete brown inventory', () => {
        const inventory = EighteenFortySixTileSet.createInventory()
        const brown = EighteenFortySixTileSet.definitions.filter(
            (tile) => tile.face.color === 'brown'
        )
        expect(
            Object.fromEntries(
                brown.map((tile) => [
                    tile.printedNumber,
                    EighteenFortySixTileSet.availablePieces(inventory, tile.id).length
                ])
            )
        ).toEqual({
            '39': 1,
            '40': 1,
            '41': 2,
            '42': 2,
            '43': 2,
            '44': 1,
            '45': 2,
            '46': 2,
            '47': 2,
            '70': 1,
            '611': 4,
            '297': 2,
            '299': 1
        })
    })
    it('unlocks brown only in Phase III and rejects skipping green', () => {
        const table = constructionGame()
        installTile(table, 'E11', '18xx:14')
        relocateStation(table, 'IC', 'E11')
        for (const phaseId of ['I', 'II']) {
            table.state.phaseId = phaseId
            expect(choices(table, 'E11')).toEqual([])
        }
        table.state.phaseId = 'III'
        expect(choices(table, 'E11').some((choice) => choice.definitionId === '18xx:611')).toBe(
            true
        )
        installTile(table, 'E11', '18xx:5')
        expect(choices(table, 'E11').some((choice) => choice.definitionId === '18xx:611')).toBe(
            false
        )
    })
    it.each([true, false])(
        'permits one brown upgrade and one yellow lay, upgrade first: %s',
        (upgradeFirst) => {
            const table = constructionGame()
            installTile(table, 'C15', '1846:294')
            relocateStation(table, 'IC', 'C15')
            const upgrade = () => {
                const choice = choices(table, 'C15').find(
                    (choice) => choice.definitionId === '1846:297'
                )
                assertExists(choice)
                expect(choice.cost).toBe(20)
                layTrack(table, choice)
            }
            if (upgradeFirst) upgrade()
            const yellow = choices(table, 'C13')[0]
            assertExists(yellow)
            layTrack(table, yellow)
            if (!upgradeFirst) upgrade()
            expect(table.state.trackStep?.lays.map((lay) => lay.color).sort()).toEqual([
                'brown',
                'yellow'
            ])
            expect(choices(table, 'D14')).toEqual([])
        }
    )
    it('preserves Chicago’s four separate cities and tokens while increasing revenue without adding track', () => {
        const table = constructionGame()
        const previousId = installTile(table, 'D6', '1846:298')
        relocateStation(table, 'IC', 'D6', 'city-0')
        const rival = table.state.stations.find(
            (station) => station.companyId === 'NYC' && station.status === 'available'
        )
        assertExists(rival)
        table.state.stations[table.state.stations.indexOf(rival)] = {
            ...rival,
            status: 'placed',
            position: { locationId: 'D6', nodeId: 'city-2', slot: 0 }
        }
        const before = structuredClone(table.state)
        const options = choices(table, 'D6')
        expect(options).toHaveLength(1)
        expect(options[0]).toMatchObject({
            definitionId: '1846:299',
            rotation: 0,
            cost: 20,
            nodeMapping: {
                'city-0': 'city-0',
                'city-1': 'city-1',
                'city-2': 'city-2',
                'city-3': 'city-3'
            }
        })
        const result = layTrack(table, options[0])
        const face = new RailwayMapState(
            EighteenFortySixMap,
            EighteenFortySixTileSet,
            table.state.tileInventory
        ).tile('D6').face
        expect(face.nodes).toHaveLength(4)
        expect(
            face.nodes.every(
                (node) =>
                    node.kind === 'city' &&
                    node.stationSlots === 1 &&
                    node.revenue.kind === 'fixed' &&
                    node.revenue.amount === 70
            )
        ).toBe(true)
        expect(face.paths).toEqual(
            EighteenFortySixTileSet.definitions.find((tile) => tile.id === '1846:298')?.face.paths
        )
        expect(table.state.stations).toEqual(before.stations)
        expect(table.state.stationReservations).toEqual(before.stationReservations)
        expect(
            EighteenFortySixTileSet.availablePieces(table.state.tileInventory, '1846:298').map(
                (piece) => piece.id
            )
        ).toContain(previousId)
        expect(
            EighteenFortySixTileSet.availablePieces(table.state.tileInventory, '1846:299')
        ).toEqual([])
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toBe(
            finiteCashOwnedBy(before, { kind: 'company', companyId: 'IC' }) - 20
        )
        let replay = before
        for (const action of result.processedActions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of result.processedActions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)
    })
    it('keeps Z and ordinary cities distinct and refuses a second ordinary upgrade', () => {
        const table = constructionGame()
        installTile(table, 'C15', '1846:294')
        relocateStation(table, 'IC', 'C15')
        expect(choices(table, 'C15').every((choice) => choice.definitionId === '1846:297')).toBe(
            true
        )
        const choice = choices(table, 'C15')[0]
        assertExists(choice)
        layTrack(table, choice)
        const face = new RailwayMapState(
            EighteenFortySixMap,
            EighteenFortySixTileSet,
            table.state.tileInventory
        ).tile('C15').face
        expect(face.nodes[0]).toMatchObject({
            kind: 'city',
            stationSlots: 3,
            revenue: { kind: 'fixed', amount: 60 }
        })
        expect(TrackRules1846.allowance(table.hydrated, 'brown')).toHaveProperty('reason')
        expect(TrackRules1846.allowance(table.hydrated, 'green')).toHaveProperty('reason')
        expect(TrackRules1846.allowance(table.hydrated, 'yellow')).toEqual({ cost: 0 })
    })
    it('upgrades an ordinary city to a $40 two-slot brown city', () => {
        const table = constructionGame()
        installTile(table, 'E11', '18xx:14')
        relocateStation(table, 'IC', 'E11')
        const choice = choices(table, 'E11').find((choice) => choice.definitionId === '18xx:611')
        assertExists(choice)
        expect(choice.cost).toBe(20)
        layTrack(table, choice)
        const face = new RailwayMapState(
            EighteenFortySixMap,
            EighteenFortySixTileSet,
            table.state.tileInventory
        ).tile('E11').face
        expect(face.nodes[0]).toMatchObject({
            kind: 'city',
            stationSlots: 2,
            revenue: { kind: 'fixed', amount: 40 }
        })
    })
    it('upgrades connected plain track and returns the green piece', () => {
        const table = constructionGame()
        installTile(table, 'C15', '1846:294')
        relocateStation(table, 'IC', 'C15')
        const previousId = installTile(table, 'C13', '18xx:23')
        const choice = choices(table, 'C13')[0]
        assertExists(choice)
        expect(choice.cost).toBe(20)
        layTrack(table, choice)
        const face = new RailwayMapState(
            EighteenFortySixMap,
            EighteenFortySixTileSet,
            table.state.tileInventory
        ).tile('C13').face
        expect(face.color).toBe('brown')
        expect(face.nodes).toEqual([])
        expect(
            EighteenFortySixTileSet.availablePieces(table.state.tileInventory, '18xx:23').map(
                (piece) => piece.id
            )
        ).toContain(previousId)
    })
    it.each(['B16', 'C9', 'G3', 'G19'])(
        'does not offer a brown city at restricted %s',
        (locationId) => {
            const table = constructionGame()
            for (const definitionId of ['18xx:14', '18xx:15', '18xx:619'])
                for (const rotation of [0, 1, 2, 3, 4, 5] as const) {
                    installTile(table, locationId, definitionId, rotation)
                    relocateStation(table, 'IC', locationId)
                    expect(choices(table, locationId)).toEqual([])
                }
        }
    )
    it('exhausts finite Z tiles and returns replaced green tiles', () => {
        const table = constructionGame()
        installTile(table, 'C15', '1846:294')
        relocateStation(table, 'IC', 'C15')
        installTile(table, 'E17', '1846:297')
        installTile(table, 'H12', '1846:297')
        expect(choices(table, 'C15')).toEqual([])
        installTile(table, 'E17', '1846:295')
        expect(choices(table, 'C15').length).toBeGreaterThan(0)
    })
})
