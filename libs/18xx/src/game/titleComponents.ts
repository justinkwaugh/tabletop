import { assert } from '@tabletop/common'
import type { RailwayMap } from '../map/map.js'
import type { TileSet } from '../tiles/inventory.js'
import type { TrainDepot } from '../trains/trainDepot.js'
import type { EighteenXXTitleRules } from './eighteenXXTitleRules.js'

export type TitleComponents = { map: RailwayMap; tileSet: TileSet; depot: TrainDepot }
export type TitleComponentRules = Pick<
    EighteenXXTitleRules,
    'trackRules' | 'stationRules' | 'routeRules' | 'trainRules'
>

export function titleComponents(rules: TitleComponentRules): TitleComponents {
    const { map, tileSet } = rules.trackRules
    const { depot } = rules.trainRules
    assert(
        rules.stationRules.map === map && rules.routeRules.map === map,
        'Track, station and route rules must share one map'
    )
    assert(
        rules.stationRules.tileSet === tileSet && rules.routeRules.tileSet === tileSet,
        'Track, station and route rules must share one tile set'
    )
    assert(rules.routeRules.depot === depot, 'Route and train rules must share one depot')
    return { map, tileSet, depot }
}
