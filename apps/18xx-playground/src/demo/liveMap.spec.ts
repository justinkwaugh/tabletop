import { expect, it } from 'vitest'
import { Definition as Top, TheOldPrinceMap, TheOldPrinceTileSet } from '@tabletop/the-old-prince'
import { Definition as Shikoku, Shikoku1889Map, Shikoku1889TileSet } from '@tabletop/shikoku-1889'
import { RailwayMapState, TrackNetwork, cashOwnedBy, type EighteenXXState } from '@tabletop/18xx'
import {
    createMapDrawing,
    stationMapTokens,
    isMapSelectionValid,
    printedMapReservations
} from '@tabletop/18xx-ui'
import { example, purchase } from './stockTestUtils.js'

it.each([Top, Shikoku])(
    'resolves $info.id live placements and rejects invalid station and tile references',
    (definition) => {
        const { state } = example(definition, 'flotation')
        const map = definition === Top ? TheOldPrinceMap : Shikoku1889Map
        const tileSet = definition === Top ? TheOldPrinceTileSet : Shikoku1889TileSet
        const locationId = definition === Top ? 'K19' : 'I2'
        const scene = createMapDrawing(map, { tileSet, inventory: state.tileInventory })
        expect(
            scene.locations.filter((entry) => entry.placed).map((entry) => entry.location.id)
        ).toEqual([locationId])
        expect(
            tileSet.counts(state.tileInventory).find((count) => count.definitionId === '18xx:5')
        ).toMatchObject({
            available:
                definition === Top
                    ? 'unlimited'
                    : tileSet.availablePieces(tileSet.createInventory(), '18xx:5').length - 1
        })
        expect(
            isMapSelectionValid(scene, { kind: 'slot', locationId, nodeId: 'city', slot: 0 })
        ).toBe(true)
        expect(
            isMapSelectionValid(scene, { kind: 'slot', locationId, nodeId: 'city', slot: 3 })
        ).toBe(false)
        expect(isMapSelectionValid(scene, { kind: 'path', locationId, pathId: 'missing' })).toBe(
            false
        )
        expect(isMapSelectionValid(scene, { kind: 'hex', locationId: 'missing' })).toBe(false)
        expect(printedMapReservations(scene).length).toBeGreaterThan(
            state.stationReservations.length
        )
        const wrong = structuredClone(state)
        wrong.tileInventory.placements.missing = wrong.tileInventory.placements[locationId]
        delete wrong.tileInventory.placements[locationId]
        expect(() => definition.runtime.hydrator.hydrateState(wrong)).toThrow(
            'Unknown map location'
        )
        const station = state.stations.find((station) => station.status === 'placed')
        if (!station || station.status !== 'placed') throw new Error('Missing placed station')
        station.position.slot = 99
        expect(() => definition.runtime.hydrator.hydrateState(state)).toThrow('existing city slot')
    }
)
it('projects TOP flotation, replay and Undo onto live stations and reservations', () => {
    const { state, game, engine } = example(Top, 'flotation')
    const result = engine.executeCanonicalAction({ game, state, action: purchase('A:share:4', 80) })
    const appearances = Object.fromEntries(
        state.companies.map((company) => [company.id, { label: company.id, color: '#234567' }])
    )
    const reachesHome = (current: EighteenXXState, companyId: string) =>
        new TrackNetwork(
            new RailwayMapState(TheOldPrinceMap, TheOldPrinceTileSet, current.tileInventory),
            current,
            companyId
        ).reaches('D6', { kind: 'node', nodeId: 'city' })
    expect(reachesHome(state, 'PEIR')).toBe(true)
    expect(reachesHome(state, 'A')).toBe(false)
    expect(reachesHome(result.updatedState, 'A')).toBe(true)
    expect(reachesHome(result.updatedState, 'PEIR')).toBe(false)
    expect(cashOwnedBy(result.updatedState, { kind: 'company', companyId: 'A' })).toBe(800)
    const before = stationMapTokens(state, appearances)
    const after = stationMapTokens(result.updatedState, appearances)
    expect(before.find((token) => token.id === 'PEIR:A')).toMatchObject({ locationId: 'D6' })
    expect(after.find((token) => token.id === 'PEIR:A')).toBeUndefined()
    expect(after.find((token) => token.id === 'A:home')).toMatchObject({
        locationId: 'D6',
        nodeId: 'city',
        slot: 0
    })
    expect(
        result.updatedState.stationReservations.some((reservation) => reservation.companyId === 'A')
    ).toBe(false)
    new RailwayMapState(
        TheOldPrinceMap,
        TheOldPrinceTileSet,
        result.updatedState.tileInventory
    ).validateStations(result.updatedState)
    expect(result.updatedState.tileInventory).toEqual(state.tileInventory)
    let replay = state
    for (const action of result.processedActions)
        replay = engine.applyProcessedAction({ game, state: replay, action })
    expect(stationMapTokens(replay, appearances)).toEqual(after)
    expect(reachesHome(replay, 'A')).toBe(true)
    for (const action of [...result.processedActions].reverse())
        replay = engine.undoProcessedAction({ state: replay, action })
    expect(replay).toEqual(state)
    expect(stationMapTokens(replay, appearances)).toEqual(before)
    expect(reachesHome(replay, 'PEIR')).toBe(true)
    expect(reachesHome(replay, 'A')).toBe(false)
})
