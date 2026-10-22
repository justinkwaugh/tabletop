import { type EighteenXXState, type LayTile, type PlaceStation } from '@tabletop/18xx'
import { minimalRailwayMap, minimalTileSet, TestNames } from '@tabletop/18xx/testing'
import { ActionSource, type GameAction } from '@tabletop/common'
import { expect, it } from 'vitest'
import { historyStateFixture } from '../table/history.fixture.js'
import { HistoricalMaps } from './historicalMap.js'
import type { MapViewDefinition } from './stationPresentation.js'

it('shows the selected historical company and reservations, with cache invalidation for state and artwork', () => {
    const state = historyStateFixture()
    state.tileInventory = minimalTileSet.createInventory()
    const original = structuredClone(state)
    const lay: LayTile = {
        id: 'lay',
        gameId: 'history',
        type: 'LayTile',
        source: ActionSource.User,
        playerId: 'alex',
        companyId: 'R',
        locationId: '0',
        definitionId: 'tile',
        rotation: 0,
        nodeMapping: {},
        expectedCost: 0
    }
    const then = structuredClone(state)
    then.stationReservations.push({ companyId: 'R', locationId: '0', nodeId: 'city' })
    const actions: GameAction[] = [
        lay,
        {
            id: 'later',
            gameId: 'history',
            type: 'Other',
            source: ActionSource.System,
            undoPatch: [{ op: 'replace', path: '', value: then }]
        }
    ]
    const records = structuredClone(actions)
    let view: MapViewDefinition = { map: minimalRailwayMap, tileSet: minimalTileSet, stations: {} }
    const maps = new HistoricalMaps(
        () => view,
        (companyId) => TestNames.company(companyId),
        (state: EighteenXXState) => state
    )
    const preview = maps.preview(state, actions, lay)
    expect(preview.label).toBe('Railway')
    expect(preview.reservations).toEqual(then.stationReservations)
    expect(preview.outlinedLocationIds).toEqual(['0'])
    expect(maps.preview(state, actions, lay)).toBe(preview)
    view = { ...view, stations: { R: { label: 'R', color: 'red' } } }
    expect(maps.preview(state, actions, lay)).not.toBe(preview)
    expect(maps.preview(state, [lay], lay).label).toBe('Railway')
    expect(state).toEqual(original)
    expect(actions).toEqual(records)
})

it('previews where a station or a title’s own placements went, outlining every hex', () => {
    const state = historyStateFixture()
    state.tileInventory = minimalTileSet.createInventory()
    const station: PlaceStation = {
        id: 'station',
        gameId: 'history',
        type: 'PlaceStation',
        source: ActionSource.User,
        playerId: 'alex',
        companyId: 'R',
        stationId: 'R-2',
        position: { locationId: '0', nodeId: 'city', slot: 0 },
        expectedCost: 40
    }
    const token: GameAction = {
        id: 'token',
        gameId: 'history',
        type: 'PlaceToken',
        source: ActionSource.User,
        playerId: 'alex'
    }
    const other: GameAction = { ...token, id: 'other', type: 'Other' }
    const maps = new HistoricalMaps(
        () => ({ map: minimalRailwayMap, tileSet: minimalTileSet, stations: {} }),
        (companyId) => TestNames.company(companyId),
        (state: EighteenXXState) => state,
        undefined,
        (action) =>
            action.type === 'PlaceToken'
                ? { kind: 'Port token', companyId: 'R', locationIds: ['0', '1'] }
                : undefined
    )
    expect([station, token, other].map((action) => maps.previews(action))).toEqual([
        true,
        true,
        false
    ])
    const stationPreview = maps.preview(state, [station], station)
    expect(stationPreview.kind).toBe('station')
    expect(stationPreview.outlinedLocationIds).toEqual(['0'])
    expect(stationPreview.locations).toEqual(['0'])
    const tokenPreview = maps.preview(state, [token], token)
    expect(tokenPreview.kind).toBe('Port token')
    expect(tokenPreview.outlinedLocationIds).toEqual(['0', '1'])
})
