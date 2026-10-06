import { expect, it } from 'vitest'
import { HexOrientation, assertExists } from '@tabletop/common'
import { RailwayMap, type TrainRoute } from '@tabletop/18xx'
import {
    minimalPlayState,
    minimalRouteRules,
    minimalTileSet,
    TestCompanyId
} from '@tabletop/18xx/testing'
import { RouteEditor } from './routeEditor.svelte.js'

it('reallocates a single train bonus consistently while drafting, saving, editing and removing routes', () => {
    const locations = minimalRouteRules.map.definition.locations
    const map = new RailwayMap({
        id: 'two-routes',
        name: 'Two routes',
        orientation: HexOrientation.Flat,
        locations: [
            ...locations,
            ...locations.map((location) => ({
                ...location,
                id: `other-${location.id}`,
                coordinates: { q: 3, r: location.coordinates.r }
            }))
        ]
    })
    const state = {
        ...minimalPlayState(),
        trainInventory: minimalRouteRules.depot.createInventory(),
        tileInventory: minimalTileSet.createInventory(),
        routeStep: { companyId: TestCompanyId }
    }
    const routes = ['', 'other-'].map((prefix): TrainRoute => {
        const train = minimalRouteRules.depot.nextTrain(state.trainInventory, '2')
        assertExists(train)
        minimalRouteRules.depot.purchase(state.trainInventory, train.id, '2', {
            kind: 'company',
            companyId: TestCompanyId
        })
        state.stations.push({
            id: `station-${prefix}`,
            companyId: TestCompanyId,
            status: 'placed',
            position: { locationId: `${prefix}0`, nodeId: 'city', slot: 0 }
        })
        return {
            trainId: train.id,
            start: { locationId: `${prefix}0`, nodeId: 'city' },
            paths: [
                { locationId: `${prefix}0`, pathId: 'edge-0' },
                { locationId: `${prefix}1`, pathId: 'edge-3' }
            ]
        }
    })
    const editor = new RouteEditor(state, {
        ...minimalRouteRules,
        map,
        longestRouteBonusPerStop: () => 10
    })
    editor.routes = [routes[0]]
    expect(editor.savedResults[0].revenue).toBe(80)
    editor.selectTrain(routes[1].trainId)
    editor.selectStart(routes[1].start)
    for (const path of routes[1].paths) editor.append(path)
    expect(editor.savedResults.map((route) => route.revenue)).toEqual([60])
    expect(editor.combinedPreview?.result?.revenue).toBe(140)
    editor.save()
    expect(editor.savedResults.map((route) => route.revenue)).toEqual([60, 80])
    editor.edit(routes[1].trainId)
    expect(editor.savedResults[0].revenue).toBe(60)
    editor.clear()
    editor.routes = routes
    editor.remove(routes[1].trainId)
    expect(editor.savedResults[0].revenue).toBe(80)
    editor.selectTrain(routes[1].trainId)
    editor.selectStart(routes[0].start)
    for (const path of routes[0].paths) editor.append(path)
    expect(editor.combinedPreview?.reason).toBeDefined()
    expect(editor.savedResults[0].revenue).toBe(80)
})
