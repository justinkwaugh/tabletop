import type { TileRotation } from '@tabletop/18xx'
import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { Privates1880 } from '../src/companies.js'
import { unchosenInvestors } from '../src/investors.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { MajorHomes1880, Map1880 } from '../src/map.js'
import type { HydratedState1880, State1880 } from '../src/state.js'
import { StationRules1880 } from '../src/stations.js'
import { Market1880 } from '../src/stockMarket.js'
import { freeParSlots } from '../src/stock.js'
import { TileSet1880 } from '../src/tiles.js'
import { TrackRules1880 } from '../src/track.js'
import { TrainRules1880 } from '../src/trainRules.js'
import { TrainDepot1880 } from '../src/trains.js'

export type Table = TitleTable<State1880, HydratedState1880>

export const kit = titleTestKit<State1880, HydratedState1880>({
    definition: Definition,
    map: Map1880,
    tileSet: TileSet1880,
    market: Market1880,
    trackRules: TrackRules1880,
    stationRules: StationRules1880,
    trainRules: TrainRules1880,
    depot: TrainDepot1880,
    privates: Privates1880,
    home: (companyId) => MajorHomes1880[companyId]
})

/** Edits the table's state in place, as a prepared position. */
export function edit(game: Table, change: (state: State1880) => void): void {
    const state = structuredClone(game.state)
    change(state)
    game.state = state
}

export function placeTile(
    game: Table,
    locationId: string,
    definitionId: string,
    rotation: TileRotation
): void {
    edit(game, (state) => {
        const [piece] = TileSet1880.availablePieces(state.tileInventory, definitionId)
        state.tileInventory.placements[locationId] = {
            pieceId: piece.id,
            definitionId,
            rotation
        }
    })
}

/** The certificate's current holder: a player id, a company id, or the bank's pool. */
export function holderOf(game: Table, certificateId: string): string | undefined {
    const certificate = game.state.certificates.find((entry) => entry.id === certificateId)
    if (!certificate) return undefined
    const owner = certificate.owner
    return owner.kind === 'player'
        ? owner.playerId
        : owner.kind === 'company'
          ? owner.companyId
          : (certificate.poolId ?? 'bank')
}

export function cashOf(game: Table, owner: string): number {
    const entry = game.state.cash.find((cash) =>
        cash.owner.kind === 'player'
            ? cash.owner.playerId === owner
            : cash.owner.kind === 'company' && cash.owner.companyId === owner
    )
    return typeof entry?.amount === 'number' ? entry.amount : 0
}

/**
 * Sells every private at its face value, each to the player starting its auction; the BCR's par
 * goes to the top free slot with ABC permits.
 */
export function auctionAtFaceValue(game: Table): void {
    while (game.state.machineState === 'SelectionAuction') {
        const state = game.state
        if (state.pendingPar) {
            game.act(
                'ParCompany',
                {
                    companyId: state.pendingPar.companyId,
                    marketSpaceId: '1:3',
                    choices: { slot: '0', permits: 'ABC' }
                },
                state.pendingPar.playerId
            )
            continue
        }
        const auction = state.selectionAuction
        if (!auction) throw new Error('The auction is under way')
        if (auction.bidding) game.act('PassSelectionAuction')
        else {
            const lotId = auction.remainingLotIds[0]
            const price = Privates1880.find((item) => item.id === lotId)?.faceValue ?? 0
            game.act('NominateLot', { lotId, amount: price })
        }
    }
}

/** Each player in turn takes the lowest-numbered investor left. */
export function chooseInvestors(game: Table): void {
    while (game.state.machineState === 'ChoosingInvestors')
        game.act('ChooseInvestor', { investorId: unchosenInvestors(game.hydrated)[0] })
}

/**
 * The auction sold at face value and the investors chosen: the first share round under way, every
 * player given ¥1000 to start companies with.
 */
export function opened(count = 4, seed = 7): Table {
    const game = kit.table(count, seed)
    auctionAtFaceValue(game)
    chooseInvestors(game)
    edit(game, (state) => {
        for (const cash of state.cash) if (cash.owner.kind === 'player') cash.amount = 1000
    })
    return game
}

/** Starts a major as the player on turn, with the start's choices. */
export function startMajor(
    game: Table,
    companyId: string,
    options: {
        marketSpaceId?: string
        presidentShares?: number
        slot?: number
        permits?: string
    } = {}
): void {
    const { marketSpaceId = '1:3', presidentShares = 2, permits = 'ABC' } = options
    const slot = options.slot ?? freeParSlots(game.hydrated, marketSpaceId)[0]
    const price = Market1880.space(marketSpaceId).price * presidentShares
    game.act('StartCompany', {
        buyer: { kind: 'player', playerId: game.player },
        companyId,
        marketSpaceId,
        expectedPrice: price,
        presidentShares,
        choices: { slot: String(slot), permits }
    })
}
