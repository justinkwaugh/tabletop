import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { Homes1849 } from '../src/companies.js'
import { Map1849 } from '../src/map.js'
import { TrainRules1849 } from '../src/operating.js'
import { Privates1849 } from '../src/privates.js'
import type { HydratedState1849, State1849 } from '../src/state.js'
import { StationRules1849 } from '../src/stations.js'
import { Market1849 } from '../src/stockMarket.js'
import { TileSet1849 } from '../src/tiles.js'
import { TrackRules1849 } from '../src/track.js'
import { TrainDepot1849 } from '../src/trains.js'

export type Table = TitleTable<State1849, HydratedState1849>

export const kit = titleTestKit<State1849, HydratedState1849>({
    definition: Definition,
    map: Map1849,
    tileSet: TileSet1849,
    market: Market1849,
    trackRules: TrackRules1849,
    stationRules: StationRules1849,
    trainRules: TrainRules1849,
    depot: TrainDepot1849,
    privates: Privates1849,
    home: (companyId) => Homes1849[companyId]?.[0],
    afterPrivateBought(game) {
        const pending = game.state.pendingPar
        if (pending)
            game.act(
                'ParCompany',
                { companyId: pending.companyId, marketSpaceId: '3:5' },
                pending.playerId
            )
    }
})
