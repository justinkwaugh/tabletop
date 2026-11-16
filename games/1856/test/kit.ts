import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { Privates1856 } from '../src/companies.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { Homes1856, Map1856 } from '../src/map.js'
import type { HydratedState1856, State1856 } from '../src/state.js'
import { StationRules1856 } from '../src/stations.js'
import { Market1856 } from '../src/stockMarket.js'
import { TileSet1856 } from '../src/tiles.js'
import { TrackRules1856 } from '../src/track.js'
import { TrainDepot1856 } from '../src/trains.js'
import { TrainRules1856 } from '../src/operating.js'

export type Table = TitleTable<State1856, HydratedState1856>

export const kit = titleTestKit<State1856, HydratedState1856>({
    definition: Definition,
    map: Map1856,
    tileSet: TileSet1856,
    market: Market1856,
    trackRules: TrackRules1856,
    stationRules: StationRules1856,
    trainRules: TrainRules1856,
    depot: TrainDepot1856,
    privates: Privates1856,
    home: (companyId) => Homes1856[companyId]
})

/** Edits the table's state in place, as a prepared position. */
export function edit(game: Table, change: (state: State1856) => void): void {
    const state = structuredClone(game.state)
    change(state)
    game.state = state
}

/** The opening auction sold, each private at its price; the first stock round under way. */
export function opened(count = 4, seed = 7, config: Record<string, boolean> = {}): Table {
    const game = kit.table(count, seed, config)
    kit.buyAllPrivates(game)
    return game
}

/** Sets an owner's cash. */
export function setCash(
    state: State1856,
    owner: { kind: 'company'; companyId: string } | { kind: 'player'; playerId: string },
    amount: number
): void {
    const account = state.cash.find((entry) =>
        entry.owner.kind === 'company' && owner.kind === 'company'
            ? entry.owner.companyId === owner.companyId
            : entry.owner.kind === 'player' &&
              owner.kind === 'player' &&
              entry.owner.playerId === owner.playerId
    )
    if (!account) throw new Error('No such account')
    account.amount = amount
}

/** Hands a private to a company, as if it had bought it. */
export function givePrivate(state: State1856, privateId: string, companyId: string): void {
    const charter = state.certificates.find((entry) => entry.id === `${privateId}:charter`)
    if (!charter) throw new Error(`No ${privateId} charter`)
    charter.owner = { kind: 'company', companyId }
    delete charter.poolId
}

/** The player whose stock turn it is starts the company at the par. */
export function start(game: Table, companyId: string, par: number): void {
    const playerId = game.player
    kit.launch(game, companyId, par)
    finishTurn(game, playerId)
}

/** Players buy the company's initial offering shares, a turn each, at its par. */
export function buy(game: Table, companyId: string, par: number, count: number): void {
    for (let index = 0; index < count; index++) {
        const playerId = game.player
        kit.buyIpo(game, companyId, par)
        finishTurn(game, playerId)
    }
}

/** Ends the player's stock turn, unless it ended on its own with nothing left to do. */
function finishTurn(game: Table, playerId: string): void {
    if (
        game.state.machineState === 'StockRound' &&
        game.valid(playerId).includes('FinishStockTurn')
    )
        game.act('FinishStockTurn', {}, playerId)
}

/** Everyone passes the stock round under way. */
export function finishStockRound(game: Table): void {
    const round = game.state.stockRound.number
    while (game.state.machineState === 'StockRound' && game.state.stockRound.number === round)
        game.act('FinishStockTurn')
}

/** Takes the train kinds out of the bank, as if they had all been sold. */
export function sellOut(state: State1856, definitionIds: readonly string[]): void {
    state.trainInventory.trains = state.trainInventory.trains.filter(
        (train) => train.status !== 'depot' || !definitionIds.includes(train.definitionId)
    )
}

/**
 * The operating company passes its track, station and run, withholding what it earned; it stops
 * at the train purchase, at the stock round if the turns end on their own, or at a state given.
 */
export function toBuyingTrains(game: Table, stopAt: readonly string[] = []): void {
    const stops = ['BuyingTrains', 'StockRound', ...stopAt]
    for (let guard = 0; guard < 20 && !stops.includes(game.state.machineState); guard++) {
        const valid = game.valid()
        const companyId =
            game.state.trackStep?.companyId ??
            game.state.stationStep?.companyId ??
            game.state.routeStep?.companyId ??
            ''
        if (valid.includes('FinishTrack')) game.act('FinishTrack', { companyId })
        else if (valid.includes('FinishStations')) game.act('FinishStations', { companyId })
        else if (valid.includes('RunTrains')) game.act('RunTrains', { companyId, routes: [] })
        else if (valid.includes('DistributeEarnings'))
            game.act('DistributeEarnings', { companyId, choice: 'withhold' })
        else throw new Error(`Stuck in ${game.state.machineState}: ${valid.join()}`)
    }
}
