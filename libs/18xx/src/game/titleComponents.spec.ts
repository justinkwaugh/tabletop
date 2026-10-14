import { expect, it } from 'vitest'
import {
    minimalRailwayMap,
    minimalRouteRules,
    minimalStationRules,
    minimalStockRules,
    minimalTileSet,
    minimalTrackRules,
    minimalTrackTileSet,
    minimalTrainRules,
    TestMarket
} from '../testing/index.js'
import { titleComponents } from './titleComponents.js'

const track = { ...minimalTrackRules(minimalTileSet), map: minimalRailwayMap }
const rules = {
    trackRules: track,
    stationRules: minimalStationRules,
    routeRules: minimalRouteRules,
    trainRules: minimalTrainRules,
    stockRules: minimalStockRules
}

it('takes a title’s map, tile set, depot and market from its mechanism rules', () => {
    expect(titleComponents(rules)).toEqual({
        map: minimalRailwayMap,
        tileSet: minimalTileSet,
        depot: minimalTrainRules.depot,
        market: TestMarket
    })
})

it('refuses mechanism rules that disagree about the board or the trains', () => {
    expect(() =>
        titleComponents({ ...rules, trackRules: { ...track, tileSet: minimalTrackTileSet } })
    ).toThrow('must share one tile set')
    expect(() =>
        titleComponents({ ...rules, trackRules: minimalTrackRules(minimalTileSet) })
    ).toThrow('must share one map')
    expect(() =>
        titleComponents({
            ...rules,
            routeRules: { ...minimalRouteRules, depot: Object.create(minimalTrainRules.depot) }
        })
    ).toThrow('must share one depot')
})
