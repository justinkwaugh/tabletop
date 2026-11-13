import { assert, assertExists, type Game, type ScenarioData } from '@tabletop/common'
import {
    startingPosition,
    startingPositionFile,
    type PositionSetUp,
    type ScenarioFile
} from '@tabletop/common/testing'
import {
    ActionType,
    PhaseName,
    USA_CITIES,
    adjacentHexIds,
    usaHex,
    type CityId,
    type HexId,
    type HydratedRideTheRailsGameState,
    type RailroadId,
    type RideTheRailsGameState,
    type Shares,
    type Track,
    type TranscontinentalClaim,
    type YellowState
} from '@tabletop/ride-the-rails'
import {
    buildState,
    createGame,
    engine,
    fixturePlayerIds,
    hydrated,
    masterSeed,
    runAction
} from '@tabletop/ride-the-rails/testing'

// The named tables the dev harness offers under Scenarios, each a position reached by legal play:
// every past placement is made through the engine in its seat's building turn, holding the share
// it took that round. `tableFixtures.spec.ts` writes them to `src/scenarios`.

/** Invented seat names, in turn order. */
export const SEAT_NAMES = ['Ada', 'Ben', 'Cora', 'Dell', 'Eli'] as const

/** One railroad's placements in order, each next to the one before or the railroad's track. */
export type Run = readonly [RailroadId, readonly HexId[]]

/** One building turn: its seat's placements in the order made. */
export type BuildingTurn = { playerId: string; runs: readonly Run[] }

/** A round as played: the share each seat took (R-3.1), then the building turns (R-3.2). */
export type PlayedRound = {
    shares: Readonly<Record<string, RailroadId>>
    builds: readonly BuildingTurn[]
}

export type TableRecipe = {
    playerCount: number
    /** Every round up to the current one, which may be part played. */
    rounds: readonly PlayedRound[]
    phase: PhaseName
    currentPlayerId?: string
    /** What each seat earned from journeys in the rounds played (R-3.3.4, R-3.3.5). */
    journeyMoney?: Readonly<Record<string, number>>
    /** The cities whose passenger a journey carried away (R-3.3.6). */
    carried?: readonly CityId[]
}

export type TableFixture = {
    slug: string
    name: string
    recipe: TableRecipe
}

const FIXED_DATE = new Date('2026-01-05T12:00:00Z')

export function cityHexId(name: string): HexId {
    const city = USA_CITIES.find((candidate) => candidate.name === name)
    assertExists(city, `No city ${name}`)
    return city.hexId
}

export function cityIdOf(name: string): CityId {
    const city = USA_CITIES.find((candidate) => candidate.name === name)
    assertExists(city, `No city ${name}`)
    return city.id
}

/**
 * The shortest walk from `from` to `to`, excluding `from`: plain hexes only on the way, unless
 * `mountains` allows them, and never another city. The search reads neighbours in map order.
 */
export function walk(from: HexId, to: HexId, mountains = false): HexId[] {
    const previous = new Map<HexId, HexId>()
    const frontier: HexId[] = [from]
    const seen = new Set<HexId>([from])
    for (let index = 0; index < frontier.length; index++) {
        const hexId = frontier[index]
        if (hexId === to) {
            break
        }
        for (const next of adjacentHexIds(hexId)) {
            const terrain = usaHex(next).terrain
            const passable =
                next === to || terrain === 'plain' || (mountains && terrain === 'mountain')
            if (passable && !seen.has(next)) {
                seen.add(next)
                previous.set(next, hexId)
                frontier.push(next)
            }
        }
    }
    const path: HexId[] = []
    for (let at: HexId | undefined = to; at !== undefined && at !== from; at = previous.get(at)) {
        path.unshift(at)
    }
    assert(path[0] !== undefined && previous.has(to), `No walk from ${from} to ${to}`)
    return path
}

/** A railroad's run through the named cities, the first being where it already is or starts. */
export function line(names: readonly string[], options: { start?: boolean } = {}): HexId[] {
    const hexIds = names.map(cityHexId)
    const [first, ...rest] = hexIds
    assertExists(first, 'A line names a city')
    const walked: HexId[] = []
    let at = first
    for (const next of rest) {
        walked.push(...walk(at, next))
        at = next
    }
    return options.start ? [first, ...walked] : walked
}

type Position = {
    shares: Record<string, Shares>
    track: Track
    yellow: YellowState
    transcontinental?: TranscontinentalClaim
    money: Record<string, number>
}

function emptyPosition(playerIds: readonly string[]): Position {
    return {
        shares: Object.fromEntries(playerIds.map((playerId) => [playerId, {}])),
        track: {},
        yellow: { startedInChicago: false },
        money: Object.fromEntries(playerIds.map((playerId) => [playerId, 0]))
    }
}

function withShare(position: Position, playerId: string, railroadId: RailroadId): void {
    const shares = position.shares[playerId]
    assertExists(shares, `No seat ${playerId}`)
    shares[railroadId] = (shares[railroadId] ?? 0) + 1
}

// R-3.2: one seat's building turn, each placement an engine action that pays its own bonuses.
function playBuildingTurn(
    position: Position,
    playerCount: number,
    round: number,
    turn: BuildingTurn
): void {
    let state = buildState({
        playerCount,
        round,
        phase: PhaseName.Build,
        currentPlayerId: turn.playerId,
        ...position
    })
    const placements = turn.runs.flatMap(([railroadId, hexIds]) =>
        hexIds.map((hexId) => ({ railroadId, hexId }))
    )
    for (const [index, { railroadId, hexId }] of placements.entries()) {
        assert(
            state.building !== undefined,
            `${turn.playerId}'s building turn in round ${round} ended before placement ${index + 1}`
        )
        const run = runAction(state, {
            type: ActionType.PlaceLocomotive,
            playerId: turn.playerId,
            railroadId,
            hexId
        })
        state = hydrated(run.after)
    }
    position.track = structuredClone(state.track)
    position.yellow = structuredClone(state.yellow)
    if (state.transcontinental) {
        position.transcontinental = { ...state.transcontinental }
    }
    for (const player of state.players) {
        position.money[player.playerId] = player.money
    }
}

/** The recipe's position: every round played through the engine, then the current turn opened. */
export function tableState(recipe: TableRecipe): HydratedRideTheRailsGameState {
    const { playerCount, rounds, phase } = recipe
    const playerIds = fixturePlayerIds(playerCount)
    const position = emptyPosition(playerIds)
    for (const [index, round] of rounds.entries()) {
        for (const [playerId, railroadId] of Object.entries(round.shares)) {
            withShare(position, playerId, railroadId)
        }
        for (const turn of round.builds) {
            playBuildingTurn(position, playerCount, index + 1, turn)
        }
    }
    for (const [playerId, money] of Object.entries(recipe.journeyMoney ?? {})) {
        position.money[playerId] = (position.money[playerId] ?? 0) + money
    }
    const carried = new Set(recipe.carried ?? [])
    return buildState({
        playerCount,
        round: rounds.length,
        phase,
        ...(recipe.currentPlayerId ? { currentPlayerId: recipe.currentPlayerId } : {}),
        ...position,
        passengers: USA_CITIES.map((city) => city.id).filter((cityId) => !carried.has(cityId))
    })
}

function namedGame(playerCount: number): Game {
    const game = createGame(playerCount)
    const { startedGame } = engine.startGame(
        {
            ...game,
            players: game.players.map((player, index) => ({
                ...player,
                name: SEAT_NAMES[index] ?? player.name
            }))
        },
        { masterSeed, startingPositions: { playerIds: fixturePlayerIds(playerCount) } }
    )
    return {
        ...startedGame,
        createdAt: FIXED_DATE,
        startedAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        lastActionAt: FIXED_DATE
    }
}

function positionSetUp(fixture: TableFixture): PositionSetUp<RideTheRailsGameState> {
    return {
        slug: fixture.slug,
        name: fixture.name,
        game: namedGame(fixture.recipe.playerCount),
        // A fixed id keeps the written file the same from one run to the next.
        state: { ...tableState(fixture.recipe).dehydrate(), id: `state-${fixture.slug}` }
    }
}

/** The game and state the harness loads for this fixture. */
export function fixturePosition(
    fixture: TableFixture
): ScenarioData & { state: RideTheRailsGameState } {
    return startingPosition(positionSetUp(fixture))
}

/** The scenario file the harness reads for this fixture. */
export function fixtureFile(fixture: TableFixture): ScenarioFile {
    return startingPositionFile(positionSetUp(fixture))
}

const RED: RailroadId = 'railroad.red'
const BLUE: RailroadId = 'railroad.blue'
const ORANGE: RailroadId = 'railroad.orange'
const YELLOW: RailroadId = 'railroad.yellow'
const PURPLE: RailroadId = 'railroad.purple'
const BLACK: RailroadId = 'railroad.black'

// R-4.1.2: each line below is a walk over plain hexes, built a few placements a turn.
// Red's long run west from New York (R-4.2.1), past Pittsburgh and Cincinnati.
const RED_WEST = line(['New York', 'Pittsburgh', 'Cincinnati', 'Saint Louis', 'Kansas City'], {
    start: true
})
// Blue between two East Coast cities (R-4.1.4).
const BLUE_SOUTH = line(['Baltimore', 'Washington'], { start: true })
// Orange west from Chicago (R-4.2.2), to Denver's door.
const ORANGE_WEST = line(['Chicago', 'Des Moines', 'Omaha', 'Denver'], { start: true })
// Red from New York into Chicago.
const RED_TO_CHICAGO = line(['New York', 'Chicago'], { start: true })
// Purple east from San Francisco through the mountains (R-4.2.4, R-3.2.4), beside Denver.
const PURPLE_EAST: HexId[] = [
    cityHexId('San Francisco'),
    ...walk(cityHexId('San Francisco'), 'hex.usa.9-23', true)
]

const SHARE_ROUND_ONE: PlayedRound['shares'] = { p1: RED, p2: BLUE, p3: RED, p4: BLUE }

export const TABLE_FIXTURES: readonly TableFixture[] = [
    // Scenario 1: the last seat in turn order takes the game's first share (R-2.2, R-3.1).
    {
        slug: 'first-share',
        name: 'First share',
        recipe: {
            playerCount: 4,
            rounds: [{ shares: {}, builds: [] }],
            phase: PhaseName.TakeShare
        }
    },
    // Scenario 2: Red's 27 locomotives are all shares and track (R-1.1-H1).
    {
        slug: 'red-supply-empty',
        name: 'Red supply empty',
        recipe: {
            playerCount: 4,
            rounds: [
                {
                    shares: { p1: RED, p2: RED, p3: RED, p4: BLUE },
                    builds: [
                        { playerId: 'p1', runs: [[RED, RED_WEST.slice(0, 5)]] },
                        { playerId: 'p2', runs: [[RED, RED_WEST.slice(5, 10)]] },
                        { playerId: 'p3', runs: [[RED, RED_WEST.slice(10, 13)]] },
                        { playerId: 'p4', runs: [[BLUE, BLUE_SOUTH]] }
                    ]
                },
                {
                    shares: { p1: RED, p2: RED, p3: ORANGE, p4: BLUE },
                    builds: [
                        { playerId: 'p1', runs: [[RED, RED_WEST.slice(13, 17)]] },
                        { playerId: 'p2', runs: [[RED, RED_WEST.slice(17, 20)]] },
                        { playerId: 'p3', runs: [[ORANGE, ORANGE_WEST.slice(0, 3)]] }
                    ]
                },
                // Phase 1 runs in reverse turn order: Dell and Cora have taken theirs.
                { shares: { p4: RED, p3: RED }, builds: [] }
            ],
            phase: PhaseName.TakeShare,
            currentPlayerId: 'p2',
            journeyMoney: { p1: 6, p2: 9, p3: 11, p4: 14 },
            carried: [cityIdOf('New York'), cityIdOf('Pittsburgh'), cityIdOf('Baltimore')]
        }
    },
    // Scenarios 3, 6 and 10: the first building turn of the game, Ada holding Red only.
    {
        slug: 'first-placement',
        name: 'First placement',
        recipe: {
            playerCount: 4,
            rounds: [{ shares: SHARE_ROUND_ONE, builds: [] }],
            phase: PhaseName.Build
        }
    },
    // Scenario 4: Ada started Blue in Philadelphia; Ben, holding Red, builds next (R-4.2.1).
    {
        slug: 'philadelphia-taken',
        name: 'Philadelphia taken',
        recipe: {
            playerCount: 4,
            rounds: [
                {
                    shares: { p1: BLUE, p2: RED, p3: BLUE, p4: RED },
                    builds: [
                        {
                            playerId: 'p1',
                            runs: [
                                [
                                    BLUE,
                                    [
                                        cityHexId('Philadelphia'),
                                        ...walk(
                                            cityHexId('Philadelphia'),
                                            cityHexId('Pittsburgh')
                                        ).slice(0, 3)
                                    ]
                                ]
                            ]
                        }
                    ]
                }
            ],
            phase: PhaseName.Build,
            currentPlayerId: 'p2'
        }
    },
    // Scenario 5: Ada holds Red and Blue, whose networks face each other across three hexes.
    {
        slug: 'two-railroads-meet',
        name: 'Two railroads meet',
        recipe: {
            playerCount: 4,
            rounds: [
                {
                    shares: SHARE_ROUND_ONE,
                    builds: [
                        {
                            playerId: 'p1',
                            runs: [[RED, [cityHexId('Baltimore'), 'hex.usa.9-53', 'hex.usa.9-51']]]
                        },
                        {
                            playerId: 'p2',
                            runs: [
                                [BLUE, [cityHexId('Washington'), 'hex.usa.11-53', 'hex.usa.11-51']]
                            ]
                        }
                    ]
                },
                { shares: { p4: ORANGE, p3: RED, p2: BLUE, p1: BLUE }, builds: [] }
            ],
            phase: PhaseName.Build,
            journeyMoney: { p1: 2, p2: 3, p3: 4, p4: 5 }
        }
    },
    // Scenarios 7 and 9: round 5, Ada holds Red, Orange and Black, and Black is unstarted.
    {
        slug: 'black-unstarted',
        name: 'Black unstarted',
        recipe: {
            playerCount: 4,
            rounds: [
                {
                    shares: { p1: RED, p2: RED, p3: BLUE, p4: BLUE },
                    builds: [
                        { playerId: 'p1', runs: [[RED, RED_WEST.slice(0, 5)]] },
                        { playerId: 'p2', runs: [[RED, RED_WEST.slice(5, 10)]] },
                        { playerId: 'p3', runs: [[BLUE, BLUE_SOUTH]] }
                    ]
                },
                {
                    shares: { p1: ORANGE, p2: RED, p3: ORANGE, p4: BLUE },
                    builds: [
                        { playerId: 'p1', runs: [[ORANGE, ORANGE_WEST.slice(0, 5)]] },
                        { playerId: 'p2', runs: [[RED, RED_WEST.slice(10, 13)]] },
                        { playerId: 'p3', runs: [[ORANGE, ORANGE_WEST.slice(5, 10)]] }
                    ]
                },
                {
                    shares: { p1: ORANGE, p2: YELLOW, p3: RED, p4: ORANGE },
                    builds: [{ playerId: 'p4', runs: [[ORANGE, ORANGE_WEST.slice(10, 12)]] }]
                },
                { shares: { p1: RED, p2: PURPLE, p3: YELLOW, p4: PURPLE }, builds: [] },
                { shares: { p4: ORANGE, p3: BLACK, p2: RED, p1: BLACK }, builds: [] }
            ],
            phase: PhaseName.Build,
            journeyMoney: { p1: 14, p2: 17, p3: 21, p4: 24 },
            carried: [cityIdOf('New York'), cityIdOf('Pittsburgh'), cityIdOf('Omaha')]
        }
    },
    // Scenario 8: Purple from San Francisco waits beside Denver, where Orange's line from Chicago
    // ends, and Red runs from New York into Chicago (R-4.3.3).
    {
        slug: 'transcontinental-in-reach',
        name: 'Transcontinental in reach',
        recipe: {
            playerCount: 4,
            rounds: [
                {
                    shares: { p1: RED, p2: RED, p3: BLUE, p4: RED },
                    builds: [
                        { playerId: 'p1', runs: [[RED, RED_TO_CHICAGO.slice(0, 5)]] },
                        { playerId: 'p2', runs: [[RED, RED_TO_CHICAGO.slice(5, 10)]] },
                        { playerId: 'p3', runs: [[BLUE, BLUE_SOUTH]] },
                        { playerId: 'p4', runs: [[RED, RED_TO_CHICAGO.slice(10, 15)]] }
                    ]
                },
                {
                    shares: { p1: ORANGE, p2: ORANGE, p3: RED, p4: ORANGE },
                    builds: [
                        { playerId: 'p1', runs: [[ORANGE, ORANGE_WEST.slice(0, 5)]] },
                        { playerId: 'p2', runs: [[ORANGE, ORANGE_WEST.slice(5, 10)]] },
                        { playerId: 'p3', runs: [[RED, RED_TO_CHICAGO.slice(15)]] },
                        { playerId: 'p4', runs: [[ORANGE, ORANGE_WEST.slice(10)]] }
                    ]
                },
                { shares: { p1: RED, p2: ORANGE, p3: YELLOW, p4: BLUE }, builds: [] },
                {
                    shares: { p1: PURPLE, p2: PURPLE, p3: PURPLE, p4: RED },
                    builds: [
                        { playerId: 'p1', runs: [[PURPLE, PURPLE_EAST.slice(0, 4)]] },
                        { playerId: 'p2', runs: [[PURPLE, PURPLE_EAST.slice(4, 8)]] },
                        { playerId: 'p3', runs: [[PURPLE, PURPLE_EAST.slice(8)]] }
                    ]
                },
                { shares: { p4: ORANGE, p3: RED, p2: BLACK, p1: PURPLE }, builds: [] }
            ],
            phase: PhaseName.Build,
            journeyMoney: { p1: 15, p2: 18, p3: 20, p4: 22 },
            carried: [cityIdOf('New York'), cityIdOf('Chicago'), cityIdOf('Omaha')]
        }
    },
    // Scenario 9: round 3 with three seats; Ada holds Orange and Yellow, and the westernmost
    // occupied cities are Omaha, Kansas City and Des Moines (R-4.2.3, R-4.2.3-H2).
    {
        slug: 'yellow-starts',
        name: 'Yellow starts',
        recipe: {
            playerCount: 3,
            rounds: [
                {
                    shares: { p1: RED, p2: BLUE, p3: RED },
                    builds: [
                        { playerId: 'p1', runs: [[RED, RED_WEST.slice(0, 8)]] },
                        { playerId: 'p2', runs: [[BLUE, BLUE_SOUTH]] },
                        { playerId: 'p3', runs: [[RED, RED_WEST.slice(8, 16)]] }
                    ]
                },
                {
                    shares: { p1: ORANGE, p2: ORANGE, p3: BLUE },
                    builds: [
                        {
                            playerId: 'p1',
                            runs: [
                                [ORANGE, ORANGE_WEST.slice(0, 4)],
                                [RED, RED_WEST.slice(16, 20)]
                            ]
                        },
                        { playerId: 'p2', runs: [[ORANGE, ORANGE_WEST.slice(4, 7)]] },
                        { playerId: 'p3', runs: [[RED, RED_WEST.slice(20)]] }
                    ]
                },
                { shares: { p3: RED, p2: ORANGE, p1: YELLOW }, builds: [] }
            ],
            phase: PhaseName.Build,
            journeyMoney: { p1: 7, p2: 9, p3: 12 },
            carried: [cityIdOf('New York'), cityIdOf('Pittsburgh'), cityIdOf('Chicago')]
        }
    },
    // Scenario 11: Ada builds with Red's last two locomotives in the supply, and Blue.
    {
        slug: 'red-runs-out',
        name: 'Red runs out',
        recipe: {
            playerCount: 4,
            rounds: [
                {
                    shares: { p1: RED, p2: RED, p3: RED, p4: BLUE },
                    builds: [
                        { playerId: 'p1', runs: [[RED, RED_WEST.slice(0, 5)]] },
                        { playerId: 'p2', runs: [[RED, RED_WEST.slice(5, 10)]] },
                        { playerId: 'p3', runs: [[RED, RED_WEST.slice(10, 13)]] },
                        { playerId: 'p4', runs: [[BLUE, BLUE_SOUTH]] }
                    ]
                },
                {
                    shares: { p1: RED, p2: RED, p3: ORANGE, p4: BLUE },
                    builds: [
                        { playerId: 'p1', runs: [[RED, RED_WEST.slice(13, 17)]] },
                        { playerId: 'p2', runs: [[RED, RED_WEST.slice(17, 19)]] },
                        { playerId: 'p3', runs: [[ORANGE, ORANGE_WEST.slice(0, 3)]] }
                    ]
                },
                { shares: { p4: BLUE, p3: ORANGE, p2: RED, p1: BLUE }, builds: [] }
            ],
            phase: PhaseName.Build,
            journeyMoney: { p1: 6, p2: 9, p3: 11, p4: 14 },
            carried: [cityIdOf('New York'), cityIdOf('Pittsburgh'), cityIdOf('Baltimore')]
        }
    }
]
