import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { PrivatesChesapeake } from '../src/companies.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { HomesChesapeake, MapChesapeake } from '../src/map.js'
import type { HydratedStateChesapeake, StateChesapeake } from '../src/state.js'
import { StationRulesChesapeake } from '../src/stations.js'
import { CompanyRulesChesapeake } from '../src/stock.js'
import { MarketChesapeake } from '../src/stockMarket.js'
import { TileSetChesapeake } from '../src/tiles.js'
import { TrackRulesChesapeake } from '../src/track.js'
import { TrainDepotChesapeake, TrainRulesChesapeake } from '../src/trains.js'

export type Table = TitleTable<StateChesapeake, HydratedStateChesapeake>

export const kit = titleTestKit<StateChesapeake, HydratedStateChesapeake>({
    definition: Definition,
    map: MapChesapeake,
    tileSet: TileSetChesapeake,
    market: MarketChesapeake,
    trackRules: TrackRulesChesapeake,
    stationRules: StationRulesChesapeake,
    trainRules: TrainRulesChesapeake,
    depot: TrainDepotChesapeake,
    privates: PrivatesChesapeake,
    home: (companyId) =>
        Object.entries(HomesChesapeake).find(([, home]) =>
            typeof home === 'string' ? home === companyId : home.companyId === companyId
        )?.[0],
    afterPrivateBought(game) {
        const pending = game.state.pendingPar
        if (pending)
            game.act(
                'ParCompany',
                {
                    companyId: pending.companyId,
                    marketSpaceId: CompanyRulesChesapeake.startMarketSpaces(
                        game.hydrated,
                        pending.companyId
                    )[0]
                },
                pending.playerId
            )
    }
})

/** Edits the table's state in place, as a prepared position. */
export function edit(game: Table, change: (state: StateChesapeake) => void): void {
    const state = structuredClone(game.state)
    change(state)
    game.state = state
}

/** The opening auction sold, each private at its price; the first stock round under way. */
export function opened(count = 4, seed = 7): Table {
    const game = kit.table(count, seed)
    kit.buyAllPrivates(game)
    return game
}

/** Sets a company's treasury. */
export function setCash(state: StateChesapeake, companyId: string, amount: number): void {
    const account = state.cash.find(
        (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
    )
    if (!account) throw new Error(`${companyId} has no treasury`)
    account.amount = amount
}

/** Starts the company at the par and has players buy IPO shares, a turn each, until it floats. */
export function floatCompany(game: Table, companyId: string, par = 80): void {
    const president = game.state.certificates.find(
        (entry) => entry.companyId === companyId && entry.kind === 'share' && entry.president
    )
    if (president?.kind !== 'share') throw new Error(`${companyId} has no president's certificate`)
    game.act('StartCompany', {
        buyer: { kind: 'player', playerId: game.player },
        companyId,
        marketSpaceId: kit.spaceAt(par),
        expectedPrice: par * president.shares
    })
    game.act('FinishStockTurn')
    while (!game.state.companies.find((company) => company.id === companyId)?.floated) {
        kit.buyIpo(game, companyId, par)
        game.act('FinishStockTurn')
    }
}

/** Hands a private to a company, as if it had bought it. */
export function givePrivate(state: StateChesapeake, privateId: string, companyId: string): void {
    const charter = state.certificates.find((entry) => entry.id === `${privateId}:charter`)
    if (!charter) throw new Error(`No ${privateId} charter`)
    charter.owner = { kind: 'company', companyId }
    delete charter.poolId
}
