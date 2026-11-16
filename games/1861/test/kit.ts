import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { minor1861 } from '../src/companies.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { Map1861 } from '../src/map.js'
import { TrainRules1861 } from '../src/operating.js'
import { Privates1861, privateTerms1861 } from '../src/privates.js'
import type { HydratedState1861, State1861 } from '../src/state.js'
import { StationRules1861 } from '../src/stations.js'
import { Market1861 } from '../src/stockMarket.js'
import { TileSet1861 } from '../src/tiles.js'
import { TrackRules1861 } from '../src/track.js'
import { TrainDepot1861 } from '../src/trains.js'

export type Table = TitleTable<State1861, HydratedState1861>

export const kit = titleTestKit<State1861, HydratedState1861>({
    definition: Definition,
    map: Map1861,
    tileSet: TileSet1861,
    market: Market1861,
    trackRules: TrackRules1861,
    stationRules: StationRules1861,
    trainRules: TrainRules1861,
    depot: TrainDepot1861,
    privates: Privates1861,
    home: (companyId) => minor1861(companyId)?.home.locationId
})

/** Each private goes to the player opening its auction at its lowest bid (§9.4). */
export function sellPrivates(game: Table): void {
    for (const company of Privates1861) {
        game.act('NominateLot', {
            lotId: company.id,
            amount: privateTerms1861(company.id).minimumBid
        })
        while (game.state.selectionAuction?.bidding) game.act('PassSelectionAuction')
    }
}

/** The player auctions a minor at its home and every other player passes (§9.2). */
export function auctionMinor(game: Table, minorId: string, amount = 100): void {
    const minor = minor1861(minorId)
    if (!minor) throw new Error(`Unknown minor ${minorId}`)
    game.act('AuctionCompany', {
        companyId: minorId,
        amount,
        home: { locationId: minor.home.locationId, nodeId: minor.home.nodeId }
    })
    while (game.state.companyAuction && game.valid().includes('PassCompanyAuction'))
        game.act('PassCompanyAuction', { companyId: minorId })
    if (game.valid().includes('FormCompany'))
        game.act('FormCompany', { companyId: minorId, shareCount: 2, privateIds: [] })
}

/** A table past the private auction, its first stock round about to auction the Nikolaev. */
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
export function setCash(state: State1861, companyId: string, amount: number): void {
    const account = state.cash.find(
        (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
    )
    if (!account) throw new Error(`${companyId} has no treasury`)
    account.amount = amount
}

/** Edits the table's state in place, as a prepared position. */
export function edit(game: Table, change: (state: State1861) => void): void {
    const state = structuredClone(game.state)
    change(state)
    game.state = state
}
