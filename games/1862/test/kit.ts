import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { company1862 } from '../src/companies.js'
import { Map1862 } from '../src/map.js'
import { StationRules1862, TrainRules1862 } from '../src/operating.js'
import type { HydratedState1862, State1862 } from '../src/state.js'
import { Market1862 } from '../src/stockMarket.js'
import { TileSet1862 } from '../src/tiles.js'
import { TrackRules1862 } from '../src/trackRules.js'
import { TrainDepot1862 } from '../src/trains.js'

export type Table = TitleTable<State1862, HydratedState1862>

export const kit = titleTestKit<State1862, HydratedState1862>({
    definition: Definition,
    map: Map1862,
    tileSet: TileSet1862,
    market: Market1862,
    trackRules: TrackRules1862,
    stationRules: StationRules1862,
    trainRules: TrainRules1862,
    depot: TrainDepot1862,
    privates: [],
    home: (companyId) => company1862(companyId)?.home
})
export const { table, lay, buyTrain, giveTrain, turnFor, prepared } = kit

/** Every player declines in turn until the Parliament Round ends. */
export function declineAll(game: Table): void {
    const number = game.state.parliament?.number
    while (
        game.state.machineState === 'ParliamentRound' &&
        game.state.parliament?.number === number
    )
        game.act('DeclineCharter')
}

/** The opener auctions a company's charter and everyone else passes. */
export function charter(
    game: Table,
    companyId: string,
    parPrice: number,
    extraShares = 0,
    bid = 0
) {
    const winner = game.player
    game.act('OpenCharterAuction', { companyId, bid })
    while (game.state.parliament?.auction) game.act('PassCharterBid')
    game.act('ObtainCharter', { companyId, parPrice, extraShares }, winner)
}

export function available(game: Table): string[] {
    return Object.entries(game.state.availability)
        .filter(([, phase]) => phase === 'A')
        .map(([id]) => id)
}
