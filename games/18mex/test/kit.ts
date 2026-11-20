import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { PrivateCatalogMex } from '../src/companies.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { MapMex, homeLocationMex } from '../src/map.js'
import { TrainRulesMex } from '../src/operating.js'
import type { HydratedStateMex, StateMex } from '../src/state.js'
import { StationRulesMex } from '../src/stations.js'
import { MarketMex } from '../src/stockMarket.js'
import { TileSetMex } from '../src/tiles.js'
import { TrackRulesMex } from '../src/track.js'
import { TrainDepotMex } from '../src/trains.js'

export type Table = TitleTable<StateMex, HydratedStateMex>

export const kit = titleTestKit<StateMex, HydratedStateMex>({
    definition: Definition,
    map: MapMex,
    tileSet: TileSetMex,
    market: MarketMex,
    trackRules: TrackRulesMex,
    stationRules: StationRulesMex,
    trainRules: TrainRulesMex,
    depot: TrainDepotMex,
    privates: PrivateCatalogMex.privates,
    home: (companyId) => homeLocationMex(companyId),
    parColor: 'pink'
})

/** Edits the table's state in place, as a prepared position. */
export function edit(game: Table, change: (state: StateMex) => void): void {
    const state = structuredClone(game.state)
    change(state)
    game.state = state
}
