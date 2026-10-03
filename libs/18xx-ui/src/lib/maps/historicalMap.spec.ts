import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { type LayTile } from '@tabletop/18xx'
import { minimalRailwayMap, minimalTileSet } from '@tabletop/18xx/testing'
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
    then.companies[0].name = 'Earlier railway'
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
    const maps = new HistoricalMaps(() => view)
    const preview = maps.preview(state, actions, lay)
    expect(preview.label).toBe('Earlier railway')
    expect(preview.reservations).toEqual(then.stationReservations)
    expect(preview.selection).toEqual({ kind: 'hex', locationId: '0' })
    expect(maps.preview(state, actions, lay)).toBe(preview)
    view = { ...view, stations: { R: { label: 'R', color: 'red' } } }
    expect(maps.preview(state, actions, lay)).not.toBe(preview)
    expect(maps.preview(state, [lay], lay).label).toBe('Railway')
    expect(state).toEqual(original)
    expect(actions).toEqual(records)
})
