import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { Privates1882 } from '../src/companies.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { Homes1882, Map1882, QLHome } from '../src/map.js'
import type { HydratedState1882, State1882 } from '../src/state.js'
import { StationRules1882 } from '../src/stations.js'
import { Market1882 } from '../src/stockMarket.js'
import { TileSet1882 } from '../src/tiles.js'
import { TrackRules1882 } from '../src/track.js'
import { TrainDepot1882, TrainRules1882 } from '../src/trains.js'

export type Table = TitleTable<State1882, HydratedState1882>

export const kit = titleTestKit<State1882, HydratedState1882>({
    definition: Definition,
    map: Map1882,
    tileSet: TileSet1882,
    market: Market1882,
    trackRules: TrackRules1882,
    stationRules: StationRules1882,
    trainRules: TrainRules1882,
    depot: TrainDepot1882,
    privates: Privates1882,
    home: (companyId) =>
        companyId === 'QL'
            ? QLHome
            : Object.entries(Homes1882).find(([, id]) => id === companyId)?.[0],
    afterPrivateBought(game) {
        const pending = game.state.pendingPar
        if (pending)
            game.act(
                'ParCompany',
                { companyId: pending.companyId, marketSpaceId: '2:3' },
                pending.playerId
            )
    }
})

/** Edits the table's state in place, as a prepared position. */
export function edit(game: Table, change: (state: State1882) => void): void {
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

/** Starts the company at the par and has players buy IPO shares, a turn each, until it floats. */
export function floatCompany(game: Table, companyId: string, par = 67): void {
    kit.launch(game, companyId, par)
    game.act('FinishStockTurn')
    while (!game.state.companies.find((company) => company.id === companyId)?.floated) {
        kit.buyIpo(game, companyId, par)
        game.act('FinishStockTurn')
    }
}

/** Sets a company's treasury. */
export function setCash(state: State1882, companyId: string, amount: number): void {
    const account = state.cash.find(
        (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
    )
    if (!account) throw new Error(`${companyId} has no treasury`)
    account.amount = amount
}

/** The Canadian Northern with a second station in Spiritwood, whose only track runs to the fishing exit. */
export function fishingOnly(): Table {
    const game = opened(4)
    floatCompany(game, 'CNoR')
    kit.passStockRound(game)
    edit(game, (state) => {
        const [piece] = TileSet1882.availablePieces(state.tileInventory, '18xx:57')
        // #57 joins the south and north sides; the north side meets the fishing exit (B6).
        state.tileInventory.placements.D6 = {
            pieceId: piece.id,
            definitionId: '18xx:57',
            rotation: 0
        }
        state.stations = state.stations.map((station) =>
            station.id === 'CNoR:station:1'
                ? {
                      ...station,
                      status: 'placed',
                      position: { locationId: 'D6', nodeId: 'city', slot: 0 }
                  }
                : station
        )
        setCash(state, 'CNoR', 50)
    })
    return game
}
