import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { TrackConstruction, RailwayMapState, finiteCashOwnedBy } from '@tabletop/18xx'
import { constructionGame, installTile, relocateStation, layTrack } from './testSupport.js'
import { EighteenFortySixTileSet } from './tiles.js'
import { EighteenFortySixMap } from './map.js'
import { TrackRules1846 } from './track.js'

describe('1846 gray construction', () => {
    it('supplies two ordinary, one Z and one Chicago gray tile', () => {
        const inventory = EighteenFortySixTileSet.createInventory()
        const gray = EighteenFortySixTileSet.definitions.filter(
            (tile) => tile.face.color === 'gray'
        )
        expect(
            Object.fromEntries(
                gray.map((tile) => [
                    tile.printedNumber,
                    EighteenFortySixTileSet.availablePieces(inventory, tile.id).length
                ])
            )
        ).toEqual({ '51': 2, '290': 1, '300': 1 })
    })
    it.each([
        ['E11', '18xx:611', '18xx:51', 'city', 50, 2, 1],
        ['C15', '1846:297', '1846:290', 'city', 70, 3, 1],
        ['D6', '1846:299', '1846:300', 'city-0', 90, 1, 4]
    ] as const)(
        'upgrades %s in Phase IV preserving track, cities and stations',
        (locationId, brownId, grayId, nodeId, revenue, slots, cityCount) => {
            const table = constructionGame('IV')
            const previousId = installTile(table, locationId, brownId)
            relocateStation(table, 'IC', locationId, nodeId)
            for (const phaseId of ['I', 'II', 'III']) {
                table.state.phaseId = phaseId
                expect(
                    new TrackConstruction(table.hydrated, TrackRules1846).choices(locationId)
                ).toEqual([])
            }
            table.state.phaseId = 'IV'
            const before = structuredClone(table.state)
            const choice = new TrackConstruction(table.hydrated, TrackRules1846)
                .choices(locationId)
                .find((choice) => choice.definitionId === grayId)
            assertExists(choice)
            expect(choice.cost).toBe(20)
            const result = layTrack(table, choice)
            const face = new RailwayMapState(
                EighteenFortySixMap,
                EighteenFortySixTileSet,
                table.state.tileInventory
            ).tile(locationId).face
            expect(face.color).toBe('gray')
            expect(face.nodes).toHaveLength(cityCount)
            for (const node of face.nodes)
                expect(node).toMatchObject({
                    kind: 'city',
                    stationSlots: slots,
                    revenue: { kind: 'fixed', amount: revenue }
                })
            expect(face.paths).toEqual(
                EighteenFortySixTileSet.definitions.find((tile) => tile.id === brownId)?.face.paths
            )
            expect(table.state.stations).toEqual(before.stations)
            expect(table.state.stationReservations).toEqual(before.stationReservations)
            expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toBe(
                finiteCashOwnedBy(before, { kind: 'company', companyId: 'IC' }) - 20
            )
            expect(
                EighteenFortySixTileSet.availablePieces(table.state.tileInventory, brownId).map(
                    (piece) => piece.id
                )
            ).toContain(previousId)
            expect(
                new TrackConstruction(table.hydrated, TrackRules1846).choices(locationId)
            ).toEqual([])
            let replay = before
            for (const action of result.processedActions)
                replay = table.engine.applyProcessedAction({
                    game: table.game,
                    state: replay,
                    action
                })
            expect(replay).toEqual(table.state)
            for (const action of result.processedActions.toReversed())
                replay = table.engine.undoProcessedAction({ state: replay, action })
            expect(replay).toEqual(before)
        }
    )
    it.each([true, false])(
        'permits gray and yellow in either order, upgrade first: %s',
        (first) => {
            const table = constructionGame('IV')
            installTile(table, 'C15', '1846:297')
            relocateStation(table, 'IC', 'C15')
            const upgrade = () => {
                const choice = new TrackConstruction(table.hydrated, TrackRules1846).choices(
                    'C15'
                )[0]
                assertExists(choice)
                layTrack(table, choice)
            }
            if (first) upgrade()
            const yellow = new TrackConstruction(table.hydrated, TrackRules1846).choices('C13')[0]
            assertExists(yellow)
            layTrack(table, yellow)
            if (!first) upgrade()
            expect(table.state.trackStep?.lays.map((lay) => lay.color).sort()).toEqual([
                'gray',
                'yellow'
            ])
            expect(new TrackConstruction(table.hydrated, TrackRules1846).choices('D14')).toEqual([])
        }
    )
    it('does not skip brown or offer exhausted gray Z stock', () => {
        const table = constructionGame('IV')
        installTile(table, 'C15', '1846:294')
        relocateStation(table, 'IC', 'C15')
        expect(
            new TrackConstruction(table.hydrated, TrackRules1846)
                .choices('C15')
                .every((choice) => choice.definitionId === '1846:297')
        ).toBe(true)
        installTile(table, 'C15', '1846:297')
        installTile(table, 'E17', '1846:290')
        expect(new TrackConstruction(table.hydrated, TrackRules1846).choices('C15')).toEqual([])
        expect(new TrackConstruction(table.hydrated, TrackRules1846).choices('C7')).toEqual([])
    })
})
