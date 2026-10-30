import { GameStatus, PlayerStatus, assert, type Game, type GameConfig } from '@tabletop/common'
import type { PositionSetUp } from '@tabletop/common/testing'
import { BoardNodeKind } from '../components/board.js'
import type { RailroadId } from '../components/railroads.js'
import { Definition } from '../definition/definition.js'
import {
    HydratedPromontoryPointGameState,
    type PromontoryPointGameState
} from '../model/gameState.js'
import {
    type Holding,
    reaching,
    withBagLeft,
    withBoxedIn,
    withHoldings,
    withPriceIndex,
    withTownsOpenTo
} from './fixtures.js'
import { placeOnOpenCountry } from './play.js'
import { TEST_MASTER_SEED, canonical, engine, variantConfig } from './startGame.js'
import { withTurnPieces } from './turnPieces.js'
import { edited } from './turns.js'

const CP: RailroadId = 'railroad.cp'
const UP: RailroadId = 'railroad.up'
const KP: RailroadId = 'railroad.kp'
const SP: RailroadId = 'railroad.sp'

// Invented seat names, in turn order: Mara opens every table.
export const SEAT_NAMES = ['Mara', 'Royce', 'Ines', 'Tobias'] as const

export type Table = { game: Game; state: PromontoryPointGameState }

export type TableFixture = {
    // What the table is set up to show, for the scenario list.
    about: string
    build: () => Table
}

// R-1.3: four seats dealt from a fixed seed, Mara's turn open with her pieces face up.
function dealt(config: GameConfig = {}): Table {
    const created = Definition.runtime.initializer.initializeGame(
        {
            id: 'promontory-point-table',
            typeId: Definition.info.id,
            ownerId: 'p1',
            config,
            players: SEAT_NAMES.map((_, index) => ({
                id: `p${index + 1}`,
                name: `p${index + 1}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { startedGame, initialState } = engine.startGame(created, {
        masterSeed: TEST_MASTER_SEED
    })
    const turnOrder = initialState.turnManager.turnOrder
    const game: Game = {
        ...startedGame,
        status: GameStatus.Started,
        // Fixed dates, so the files the tables are written to change only when a table does.
        createdAt: new Date(0),
        startedAt: new Date(0),
        players: startedGame.players.map((player) => ({
            ...player,
            name: SEAT_NAMES[turnOrder.indexOf(player.id)]
        }))
    }
    return { game, state: canonical(initialState) }
}

function editedTable(
    table: Table,
    edit: (state: PromontoryPointGameState) => PromontoryPointGameState
): Table {
    return { game: table.game, state: edit(table.state) }
}

// R-5: the bag down to one piece of the railroad, the rest scrapped by earlier turns.
function withLastPieceInBag(
    state: PromontoryPointGameState,
    railroadId: RailroadId
): PromontoryPointGameState {
    const ordered = edited(state, (draft) => {
        const index = draft.bag.items.indexOf(railroadId)
        assert(index >= 0, `The bag holds a ${railroadId} piece`)
        draft.bag.items.unshift(...draft.bag.items.splice(index, 1))
    })
    return withBagLeft(ordered, 1)
}

// R-4.3: Southern Pacific track runs to a Repairs town with SP at the price index given, Mara
// holds SP, CP and UP, and the seats hold the money and shares given in turn order.
function repairsTable(spPriceIndex: number, holdings: Holding[]): Table {
    return editedTable(dealt(), (state) =>
        withHoldings(
            withPriceIndex(
                withTownsOpenTo(withTurnPieces(state, [SP, CP, UP]), SP, ['tile.red.hammer']).state,
                SP,
                spPriceIndex
            ),
            holdings
        )
    )
}

// The tables the contract's verification scenarios open on, by file name.
export const TABLE_FIXTURES = {
    // Scenarios 2, 5, 8, 9.
    'opening-turn': {
        about: 'Mara opens her turn with CP, KP and KP; every railroad is at $5.',
        build: () => editedTable(dealt(), (state) => withTurnPieces(state, [CP, KP, KP]))
    },
    // Scenario 3.
    'buy-refused': {
        about: 'Mara has $3 and no SP share; the other seats hold all eleven SP shares.',
        build: () =>
            editedTable(dealt(), (state) =>
                withHoldings(withTurnPieces(state, [CP, UP, KP]), [
                    { money: 3, shares: { [CP]: 1, [UP]: 1, [KP]: 1 } },
                    { money: 20, shares: { [CP]: 1, [UP]: 1, [KP]: 1, [SP]: 4 } },
                    { money: 20, shares: { [CP]: 1, [UP]: 1, [KP]: 1, [SP]: 4 } },
                    { money: 20, shares: { [CP]: 1, [UP]: 1, [KP]: 1, [SP]: 3 } }
                ])
            )
    },
    // Scenario 4.
    'sell-at-zero': {
        about: 'Union Pacific is on a $0 space; Mara holds one UP share.',
        build: () =>
            editedTable(dealt(), (state) =>
                withPriceIndex(withTurnPieces(state, [CP, UP, KP]), UP, 2)
            )
    },
    // Scenarios 6, 7, 12.
    'towns-in-reach': {
        about: 'Central Pacific track runs to a Dividend town, a Repairs town and a +2 town; Mara holds two CP shares.',
        build: () =>
            editedTable(dealt(), (state) =>
                withHoldings(
                    withTownsOpenTo(withTurnPieces(state, [CP, UP, KP]), CP, [
                        'tile.red.dividend',
                        'tile.red.hammer',
                        'tile.price.plus-2'
                    ]).state,
                    [
                        { money: 20, shares: { [CP]: 2, [UP]: 1, [KP]: 1, [SP]: 1 } },
                        { money: 20, shares: { [CP]: 1, [UP]: 1, [KP]: 1, [SP]: 1 } },
                        { money: 20, shares: { [CP]: 1, [UP]: 1, [KP]: 1, [SP]: 1 } },
                        { money: 20, shares: { [CP]: 1, [UP]: 1, [KP]: 1, [SP]: 1 } }
                    ]
                )
            )
    },
    // Scenarios 10, 11.
    'price-limits': {
        about: 'KP at $24 reaches a +3 town, UP on the fourth $0 space reaches a −2 town, and SP reaches Promontory.',
        build: () =>
            editedTable(dealt(), (state) => {
                const toPromontory = reaching(
                    withTurnPieces(state, [KP, UP, SP]),
                    SP,
                    BoardNodeKind.Promontory
                ).state
                const plus = withTownsOpenTo(toPromontory, KP, ['tile.price.plus-3']).state
                const minus = withTownsOpenTo(plus, UP, ['tile.price.minus-2']).state
                return withPriceIndex(withPriceIndex(minus, KP, 28), UP, 1)
            })
    },
    // Scenario 13.
    'no-room': {
        about: 'Southern Pacific track boxes Kansas Pacific in; Mara holds KP, KP and CP, and one CP piece is left in the bag.',
        build: () =>
            editedTable(dealt(), (state) =>
                withLastPieceInBag(withBoxedIn(withTurnPieces(state, [KP, KP, CP]), KP, SP), CP)
            )
    },
    // Scenarios 1, 14.
    'pieces-placed': {
        about: 'Mara has placed her three pieces and can end her turn.',
        build: () => {
            const table = editedTable(dealt(), (state) => withTurnPieces(state, [CP, UP, KP]))
            let state = table.state
            for (const railroadId of [CP, UP, KP]) {
                state = placeOnOpenCountry(table.game, state, railroadId).state
            }
            return { game: table.game, state }
        }
    },
    // Scenario 15.
    'variant-opening-turn': {
        about: 'The four-piece variant: Mara opens her turn with CP, UP, KP and SP.',
        build: () =>
            editedTable(dealt(variantConfig(true)), (state) =>
                withTurnPieces(state, [CP, UP, KP, SP])
            )
    },
    // Scenario 15: no piece left over. The validator allows a three-piece variant hand,
    // though play reaches one only as the bag runs dry.
    'variant-nothing-left': {
        about: 'The four-piece variant: Mara opens her turn with three pieces, so none is left over.',
        build: () =>
            editedTable(dealt(variantConfig(true)), (state) => withTurnPieces(state, [CP, UP, KP]))
    },
    // Scenario 16: SP at $5; bills Mara $4, Royce $2, Ines $6, and every holder can pay.
    'repairs-all-pay': {
        about: 'Southern Pacific track runs to a Repairs town and every SP holder can pay the bill.',
        build: () =>
            repairsTable(9, [
                { money: 20, shares: { [SP]: 2, [CP]: 1 } },
                { money: 20, shares: { [SP]: 1, [UP]: 1 } },
                { money: 20, shares: { [SP]: 3 } },
                { money: 20, shares: { [CP]: 1 } }
            ])
    },
    // Scenarios 17, 18, 21, 22: SP at $6; Royce owes $10 (5 SP shares) and has $7.
    'repairs-one-short': {
        about: 'Southern Pacific track runs to a Repairs town; Royce holds five SP shares and has $7.',
        build: () =>
            repairsTable(10, [
                { money: 20, shares: { [SP]: 1, [CP]: 1 } },
                { money: 7, shares: { [SP]: 5, [CP]: 1, [UP]: 1 } },
                { money: 20, shares: { [SP]: 2, [KP]: 1 } },
                { money: 20, shares: { [CP]: 1 } }
            ])
    },
    // Scenario 19: SP at $5; Mara owes $6 with $3 and Ines $4 with $1.
    'repairs-two-short': {
        about: 'Southern Pacific track runs to a Repairs town; Mara and Ines will be short of their bills.',
        build: () =>
            repairsTable(9, [
                { money: 3, shares: { [SP]: 3, [CP]: 1 } },
                { money: 20, shares: { [SP]: 1 } },
                { money: 1, shares: { [SP]: 2, [UP]: 1 } },
                { money: 20, shares: { [CP]: 1 } }
            ])
    },
    // Scenario 20: SP at $2; Royce owes $8 (4 SP shares) and has $1, so selling all four
    // at $1 each still leaves him short.
    'repairs-short-after-everything': {
        about: 'Southern Pacific track runs to a Repairs town; Royce holds four SP shares at $2 and has $1.',
        build: () =>
            repairsTable(6, [
                { money: 20, shares: { [SP]: 1 } },
                { money: 1, shares: { [SP]: 4 } },
                { money: 20, shares: { [SP]: 1 } },
                { money: 20 }
            ])
    }
} satisfies Record<string, TableFixture>

export type TableSlug = keyof typeof TABLE_FIXTURES

export const TABLE_SLUGS = Object.keys(TABLE_FIXTURES).filter(isTableSlug)

function isTableSlug(slug: string): slug is TableSlug {
    return slug in TABLE_FIXTURES
}

// "opening-turn" is "Opening turn", the name the dev harness lists it under.
export function tableName(slug: TableSlug): string {
    const words = slug.replaceAll('-', ' ')
    return words.charAt(0).toUpperCase() + words.slice(1)
}

// The table as a position to save for the dev harness. The state goes through `dehydrate()`,
// since a hydrated state written as JSON carries its validator and fails to load.
export function tablePosition(slug: TableSlug): PositionSetUp<PromontoryPointGameState> {
    const { game, state } = TABLE_FIXTURES[slug].build()
    return {
        slug,
        name: tableName(slug),
        game,
        // A fixed state id, so the file changes only when the table does.
        state: canonical({
            ...new HydratedPromontoryPointGameState(state).dehydrate(),
            id: `table-${slug}`
        })
    }
}
