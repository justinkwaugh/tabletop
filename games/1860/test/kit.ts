import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { PrivateCatalog1860, company1860 } from '../src/companies.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { Map1860 } from '../src/map.js'
import { TrainRules1860 } from '../src/operating.js'
import type { HydratedState1860, State1860 } from '../src/state.js'
import { StationRules1860 } from '../src/stations.js'
import { Market1860 } from '../src/stockMarket.js'
import { TileSet1860 } from '../src/tiles.js'
import { TrackRules1860 } from '../src/track.js'
import { TrainDepot1860 } from '../src/trains.js'

export type Table = TitleTable<State1860, HydratedState1860>

export const kit = titleTestKit<State1860, HydratedState1860>({
    definition: Definition,
    map: Map1860,
    tileSet: TileSet1860,
    market: Market1860,
    trackRules: TrackRules1860,
    stationRules: StationRules1860,
    trainRules: TrainRules1860,
    depot: TrainDepot1860,
    privates: PrivateCatalog1860.privates,
    home: (companyId) => company1860(companyId).home,
    parColor: 'yellow'
})

/** Edits the table's state in place, as a prepared position. */
export function edit(game: Table, change: (state: State1860) => void): void {
    const state = structuredClone(game.state)
    change(state)
    game.state = state
}
