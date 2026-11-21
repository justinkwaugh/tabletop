import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { EighteenUSAMap } from '../src/map.js'
import { EighteenUSAPrivates } from '../src/privates.js'
import type { EighteenUSAState, HydratedEighteenUSAState } from '../src/state.js'
import { EighteenUSAStationRules } from '../src/stationRules.js'
import { EighteenUSAMarket } from '../src/stockMarket.js'
import { EighteenUSATileSet } from '../src/tiles.js'
import { EighteenUSATrackRules } from '../src/trackRules.js'
import { EighteenUSATrainRules } from '../src/trainRules.js'
import { EighteenUSATrainDepot } from '../src/trains.js'

export type Table = TitleTable<EighteenUSAState, HydratedEighteenUSAState>

export const kit = titleTestKit<EighteenUSAState, HydratedEighteenUSAState>({
    definition: Definition,
    map: EighteenUSAMap,
    tileSet: EighteenUSATileSet,
    market: EighteenUSAMarket,
    trackRules: EighteenUSATrackRules,
    stationRules: EighteenUSAStationRules,
    trainRules: EighteenUSATrainRules,
    depot: EighteenUSATrainDepot,
    privates: EighteenUSAPrivates,
    home: () => undefined
})

/** Edits the table's state in place, as a prepared position. */
export function edit(game: Table, change: (state: EighteenUSAState) => void): void {
    const state = structuredClone(game.state)
    change(state)
    game.state = state
}
