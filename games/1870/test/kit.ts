import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { company1870 } from '../src/companies.js'
import { Map1870 } from '../src/map.js'
import { Privates1870 } from '../src/privates.js'
import type { HydratedState1870, State1870 } from '../src/state.js'
import { StationRules1870 } from '../src/stations.js'
import { Market1870 } from '../src/stockMarket.js'
import { TileSet1870 } from '../src/tiles.js'
import { TrackRules1870 } from '../src/track.js'
import { TrainDepot1870, TrainRules1870 } from '../src/trains.js'

export type Table = TitleTable<State1870, HydratedState1870>

export const {
    table,
    buyAllPrivates,
    spaceAt,
    launch,
    buyIpo,
    passStockRound,
    exits,
    lay,
    placeStation,
    buyTrain,
    route,
    ownedTrainId,
    rotationFor,
    trackAlong,
    giveTrain,
    operated,
    turnFor,
    prepared
} = titleTestKit<State1870, HydratedState1870>({
    definition: Definition,
    map: Map1870,
    tileSet: TileSet1870,
    market: Market1870,
    trackRules: TrackRules1870,
    stationRules: StationRules1870,
    trainRules: TrainRules1870,
    depot: TrainDepot1870,
    privates: Privates1870,
    home: (companyId) => company1870(companyId)?.home,
    // The Frisco private's buyer sets its railway's par at once (p. 9).
    afterPrivateBought(game) {
        const pending = game.state.pendingPar
        if (pending)
            game.act('ParCompany', { companyId: pending.companyId, marketSpaceId: spaceAt(68) })
    }
})
