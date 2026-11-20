import { ReserveBidAuction } from '@tabletop/18xx'
import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { AuctionRules1828 } from '../src/opening.js'
import { Privates1828 } from '../src/companies.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { Homes1828, Map1828 } from '../src/map.js'
import type { HydratedState1828, State1828 } from '../src/state.js'
import { StationRules1828 } from '../src/stations.js'
import { CompanyRules1828 } from '../src/stock.js'
import { Market1828 } from '../src/stockMarket.js'
import { TileSet1828 } from '../src/tiles.js'
import { TrackRules1828 } from '../src/track.js'
import { TrainRules1828 } from '../src/trainRules.js'
import { TrainDepot1828 } from '../src/trains.js'

export type Table = TitleTable<State1828, HydratedState1828>

export const kit = titleTestKit<State1828, HydratedState1828>({
    definition: Definition,
    map: Map1828,
    tileSet: TileSet1828,
    market: Market1828,
    trackRules: TrackRules1828,
    stationRules: StationRules1828,
    trainRules: TrainRules1828,
    depot: TrainDepot1828,
    privates: Privates1828,
    parColor: 'yellow',
    home: (companyId) =>
        Object.entries(Homes1828).find(([, home]) =>
            typeof home === 'string' ? home === companyId : home.companyId === companyId
        )?.[0]
})

/** Edits the table's state in place, as a prepared position. */
export function edit(game: Table, change: (state: State1828) => void): void {
    const state = structuredClone(game.state)
    change(state)
    game.state = state
}

/** Sets an owner's cash. */
export function setCash(
    state: State1828,
    owner: { kind: 'player'; playerId: string } | { kind: 'company'; companyId: string },
    amount: number
): void {
    const account = state.cash.find((entry) =>
        owner.kind === 'player'
            ? entry.owner.kind === 'player' && entry.owner.playerId === owner.playerId
            : entry.owner.kind === 'company' && entry.owner.companyId === owner.companyId
    )
    if (!account) throw new Error('No such account')
    account.amount = amount
}

/** Plays the opening auction out: each row bid on but its last lot, which is then bought. */
export function openAuction(game: Table): void {
    let guard = 0
    while (['WaterfallAuction', 'AuctionBidding'].includes(game.state.machineState)) {
        if (guard++ > 200) throw new Error('The auction did not end')
        const state = game.hydrated
        const pending = state.pendingPar
        if (pending) {
            const spaces = CompanyRules1828.awardParSpaces?.(state, pending.companyId) ?? []
            game.act(
                'ParCompany',
                { companyId: pending.companyId, marketSpaceId: spaces[0] },
                pending.playerId
            )
            continue
        }
        const auction = new ReserveBidAuction(state, AuctionRules1828)
        const playerId = game.player
        if (auction.auction.bidding) {
            game.act('PassAuction')
            continue
        }
        const buyable = auction
            .buyOnlyLotIds()
            .filter((lotId) => auction.canPurchase(playerId, lotId))
        if (buyable.length) {
            game.act('BuyAuctionLot', {
                lotId: buyable[0],
                expectedPrice: auction.price(buyable[0])
            })
            continue
        }
        const bidOn = auction.auction.remainingLotIds.find(
            (lotId) =>
                !auction.auction.reservations.some((bid) => bid.lotId === lotId) &&
                auction.canBid(playerId, lotId, auction.minimumBid(lotId))
        )
        if (bidOn) game.act('ReserveBid', { lotId: bidOn, amount: auction.minimumBid(bidOn) })
        else game.act('PassAuction')
    }
}

/** Starts the company at the par and has players buy IPO shares, a turn each, until it floats. */
export function floatCompany(game: Table, companyId: string, parPrice = 67): void {
    const space = Market1828.spaces.find(
        (entry) =>
            entry.price === parPrice &&
            CompanyRules1828.startMarketSpaces(game.hydrated, companyId).includes(entry.id)
    )
    if (!space) throw new Error(`No ${parPrice} par`)
    game.act('StartCompany', {
        buyer: { kind: 'player', playerId: game.player },
        companyId,
        marketSpaceId: space.id,
        expectedPrice: parPrice * 2
    })
    game.act('FinishStockTurn')
    while (!game.state.companies.find((company) => company.id === companyId)?.floated) {
        kit.buyIpo(game, companyId, parPrice)
        game.act('FinishStockTurn')
    }
}
