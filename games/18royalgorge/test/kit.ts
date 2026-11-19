import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { PrivateCardsRoyalGorge } from '../src/companies.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { homeLocationRoyalGorge, MapRoyalGorge } from '../src/map.js'
import { TrainRulesRoyalGorge } from '../src/operating.js'
import type { HydratedStateRoyalGorge, StateRoyalGorge } from '../src/state.js'
import { StationRulesRoyalGorge } from '../src/stations.js'
import { MarketRoyalGorge } from '../src/stockMarket.js'
import { TileSetRoyalGorge } from '../src/tiles.js'
import { TrackRulesRoyalGorge } from '../src/track.js'
import { TrainDepotRoyalGorge } from '../src/trains.js'

export type Table = TitleTable<StateRoyalGorge, HydratedStateRoyalGorge>

export const kit = titleTestKit<StateRoyalGorge, HydratedStateRoyalGorge>({
    definition: Definition,
    map: MapRoyalGorge,
    tileSet: TileSetRoyalGorge,
    market: MarketRoyalGorge,
    trackRules: TrackRulesRoyalGorge,
    stationRules: StationRulesRoyalGorge,
    trainRules: TrainRulesRoyalGorge,
    depot: TrainDepotRoyalGorge,
    privates: PrivateCardsRoyalGorge,
    parColor: 'yellow',
    home: (companyId) => homeLocationRoyalGorge(companyId)
})

/** Edits the table's state in place, as a prepared position. */
export function edit(game: Table, change: (state: StateRoyalGorge) => void): void {
    const state = structuredClone(game.state)
    change(state)
    game.state = state
}

/** Sets an owner's cash. */
export function setCash(
    state: StateRoyalGorge,
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

/** Each private goes to the player opening its auction, at its minimum bid. */
export function sellPrivates(game: Table): void {
    while (game.state.machineState === 'SelectionAuction') {
        const lotId = game.state.selectionAuction?.remainingLotIds[0]
        if (!lotId) break
        const card = PrivateCardsRoyalGorge.find((entry) => entry.id === lotId)
        if (!card) throw new Error(`Unknown private ${lotId}`)
        game.act('NominateLot', { lotId, amount: card.faceValue })
        while (game.state.selectionAuction?.bidding) game.act('PassSelectionAuction')
    }
}

/** A table past the private auction, its first stock round under way. */
export function opened(count = 4, seed = 7): Table {
    const game = kit.table(count, seed)
    sellPrivates(game)
    return game
}

/** Gives a private to an owner, dealing it into the game, or reopening it, if need be. */
export function givePrivate(
    state: StateRoyalGorge,
    privateId: string,
    owner: { kind: 'player'; playerId: string } | { kind: 'company'; companyId: string }
): void {
    const company = state.companies.find((entry) => entry.id === privateId)
    if (company) delete company.closed
    else state.companies.push({ id: privateId, kind: 'private' })
    const certificate = state.certificates.find((entry) => entry.companyId === privateId)
    if (certificate) {
        certificate.owner = owner
        delete certificate.poolId
    } else
        state.certificates.push({
            id: `${privateId}:charter`,
            companyId: privateId,
            kind: 'private',
            owner
        })
}
