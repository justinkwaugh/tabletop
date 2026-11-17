import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { Map1867 } from '../src/map.js'
import { TrainRules1867 } from '../src/operating.js'
import { Privates1867, privateTerms1867 } from '../src/privates.js'
import type { HydratedState1867, State1867 } from '../src/state.js'
import { StationRules1867 } from '../src/stations.js'
import { Market1867 } from '../src/stockMarket.js'
import { TileSet1867 } from '../src/tiles.js'
import { TrackRules1867 } from '../src/track.js'
import { TrainDepot1867 } from '../src/trains.js'

export type Table = TitleTable<State1867, HydratedState1867>

export const kit = titleTestKit<State1867, HydratedState1867>({
    definition: Definition,
    map: Map1867,
    tileSet: TileSet1867,
    market: Market1867,
    trackRules: TrackRules1867,
    stationRules: StationRules1867,
    trainRules: TrainRules1867,
    depot: TrainDepot1867,
    privates: Privates1867,
    home: () => undefined
})

/** Each private goes to the player opening its auction at its lowest bid (GTG §5). */
export function sellPrivates(game: Table): void {
    for (const company of Privates1867) {
        game.act('NominateLot', {
            lotId: company.id,
            amount: privateTerms1867(company.id).minimumBid
        })
        while (game.state.selectionAuction?.bidding) game.act('PassSelectionAuction')
    }
}

/** The player auctions a minor with its station in this city and every other player passes (GTG §7.2). */
export function auctionMinor(
    game: Table,
    minorId: string,
    home: { locationId: string; nodeId: string },
    amount = 100
): void {
    game.act('AuctionCompany', { companyId: minorId, amount, home })
    while (game.state.companyAuction && game.valid().includes('PassCompanyAuction'))
        game.act('PassCompanyAuction', { companyId: minorId })
    if (game.valid().includes('FormCompany'))
        game.act('FormCompany', { companyId: minorId, shareCount: 2, privateIds: [] })
}

/** A table past the private auction, its first stock round about to begin. */
export function opened(count = 3, seed = 7): Table {
    const game = kit.table(count, seed)
    sellPrivates(game)
    return game
}

/** Passes every remaining stock turn, so the operating round begins. */
export function finishStockRound(game: Table): void {
    while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
}

/** Sets a company's treasury. */
export function setCash(state: State1867, companyId: string, amount: number): void {
    const account = state.cash.find(
        (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
    )
    if (!account) throw new Error(`${companyId} has no treasury`)
    account.amount = amount
}

/** Edits the table's state in place, as a prepared position. */
export function edit(game: Table, change: (state: State1867) => void): void {
    const state = structuredClone(game.state)
    change(state)
    game.state = state
}
