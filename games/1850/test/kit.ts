import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { company1850 } from '../src/companies.js'
import { Map1850 } from '../src/map.js'
import { Privates1850 } from '../src/privates.js'
import type { HydratedState1850, State1850 } from '../src/state.js'
import { StationRules1850 } from '../src/stations.js'
import { Market1850 } from '../src/stockMarket.js'
import { TileSet1850 } from '../src/tiles.js'
import { TrackRules1850 } from '../src/track.js'
import { TrainDepot1850, TrainRules1850 } from '../src/trains.js'

export type Table = TitleTable<State1850, HydratedState1850>

export const {
    table,
    buyAllPrivates,
    spaceAt,
    launch,
    buyTrain,
    exits,
    route,
    trackAlong,
    giveTrain,
    operated,
    turnFor,
    prepared
} = titleTestKit<State1850, HydratedState1850>({
    definition: Definition,
    map: Map1850,
    tileSet: TileSet1850,
    market: Market1850,
    trackRules: TrackRules1850,
    stationRules: StationRules1850,
    trainRules: TrainRules1850,
    depot: TrainDepot1850,
    privates: Privates1850,
    home: (companyId) => company1850(companyId)?.home
})
