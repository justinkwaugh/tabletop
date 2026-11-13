import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { major1822, minor1822 } from '../src/companies.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { Map1822 } from '../src/map.js'
import { TrainRules1822 } from '../src/operating.js'
import type { HydratedState1822, State1822 } from '../src/state.js'
import { StationRules1822 } from '../src/stations.js'
import { Market1822 } from '../src/stockMarket.js'
import { TileSet1822 } from '../src/tiles.js'
import { TrackRules1822 } from '../src/track.js'
import { TrainDepot1822 } from '../src/trains.js'

export type Table = TitleTable<State1822, HydratedState1822>

export const kit = titleTestKit<State1822, HydratedState1822>({
    definition: Definition,
    map: Map1822,
    tileSet: TileSet1822,
    market: Market1822,
    trackRules: TrackRules1822,
    stationRules: StationRules1822,
    trainRules: TrainRules1822,
    depot: TrainDepot1822,
    privates: [],
    home: (companyId) => (major1822(companyId)?.home ?? minor1822(companyId)?.home)?.locationId
})
