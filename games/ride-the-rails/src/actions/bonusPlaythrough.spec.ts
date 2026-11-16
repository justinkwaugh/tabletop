import { describe, expect, it } from 'vitest'
import {
    CHICAGO_BONUS,
    FIVE_DOLLAR_BONUS,
    TRANSCONTINENTAL_BONUS,
    type BonusId
} from '../data/bonuses.js'
import type { HexId } from '../data/hexes.js'
import type { RailroadId } from '../data/railroads.js'
import { USA_CITIES, usaCity, usaHex, type CityId } from '../data/usaMap.js'
import { ActionType } from '../definition/actions.js'
import type { RideTheRailsGameState } from '../model/gameState.js'
import { currentRoundNumber } from '../rules/endOfRound.js'
import { isWestCoastCity } from '../rules/startRailroad.js'
import { hasTrack, hasTrackIn, railroadsIn } from '../rules/track.js'
import { transcontinentalLine } from '../rules/transcontinental.js'
import type { ActionRun } from '../testing/fixtures.js'
import { playToEnd, seededGame, type SteeredGame, type Steering } from '../testing/steeredPlay.js'
import { isPlaceLocomotive, type PaidBonus, type PlaceLocomotive } from './placeLocomotive.js'

const RED: RailroadId = 'railroad.red'
const BLUE: RailroadId = 'railroad.blue'
const ORANGE: RailroadId = 'railroad.orange'
const YELLOW: RailroadId = 'railroad.yellow'
const PURPLE: RailroadId = 'railroad.purple'
const BLACK: RailroadId = 'railroad.black'

const CHICAGO: CityId = 'city.usa.chicago'
const MINNEAPOLIS: CityId = 'city.usa.minneapolis'
const DENVER: CityId = 'city.usa.denver'
const KANSAS_CITY: CityId = 'city.usa.kansas-city'
const DALLAS: CityId = 'city.usa.dallas'

const DENVER_HEX = usaCity(DENVER).hexId
const KANSAS_CITY_HEX = usaCity(KANSAS_CITY).hexId
// A plain hex next to Denver, on its east side.
const EAST_OF_DENVER: HexId = 'hex.usa.8-24'

// R-3: the players' own actions; every system action comes from the handlers.
const USER_ACTION_TYPES: readonly string[] = [
    ActionType.TakeShare,
    ActionType.PlaceLocomotive,
    ActionType.EndBuilding,
    ActionType.RideJourney,
    ActionType.PassJourney
]

const BONUS_CITY_HEXES = USA_CITIES.filter((city) => city.bonus !== null).map((city) => city.hexId)

// One USA bonus: Chicago, one of the four $5 cities, or the Transcontinental (R-4.3).
type Entry = { bonusId: BonusId; cityId?: CityId }

// What a board must show for an entry: it fires (at this price), or it cannot, and why.
type Expectation = Entry & ({ fires: true; amount: number } | { fires: false; why: string })

type Board = {
    name: string
    playerCount: number
    masterSeed: string
    steering: Steering
    entries: readonly Expectation[]
}

type Placement = {
    actionRun: ActionRun
    action: PlaceLocomotive
    isStart: boolean
    bonuses: PaidBonus[]
}

function placementsOf(game: SteeredGame): Placement[] {
    return game.actionRuns.flatMap((actionRun) => {
        const [action] = actionRun.processed
        if (!isPlaceLocomotive(action) || !action.metadata) {
            return []
        }
        const { isStart, bonuses } = action.metadata
        return [{ actionRun, action, isStart, bonuses }]
    })
}

function moneyOf(state: RideTheRailsGameState): Record<string, number> {
    return Object.fromEntries(state.players.map((player) => [player.playerId, player.money]))
}

function sameEntry(bonus: PaidBonus, entry: Entry): boolean {
    return bonus.bonusId === entry.bonusId && bonus.cityId === entry.cityId
}

// R-4.3.1, R-4.3.2, read straight from the board before the placement.
function cityBonusesDue(before: RideTheRailsGameState, placement: Placement): PaidBonus[] {
    const hex = usaHex(placement.action.hexId)
    if (hex.terrain !== 'city') {
        return []
    }
    const city = usaCity(hex.cityId)
    if (city.bonus === CHICAGO_BONUS.id) {
        return [{ bonusId: CHICAGO_BONUS.id, amount: CHICAGO_BONUS.amount, cityId: city.id }]
    }
    const firstInCity = railroadsIn(before.track, hex.id).length === 0
    if (city.bonus === FIVE_DOLLAR_BONUS.id && firstInCity && !placement.isStart) {
        return [
            { bonusId: FIVE_DOLLAR_BONUS.id, amount: FIVE_DOLLAR_BONUS.amount, cityId: city.id }
        ]
    }
    return []
}

const sweepEntries: readonly Expectation[] = [
    { bonusId: CHICAGO_BONUS.id, cityId: CHICAGO, fires: true, amount: 2 },
    { bonusId: FIVE_DOLLAR_BONUS.id, cityId: MINNEAPOLIS, fires: true, amount: 5 },
    { bonusId: FIVE_DOLLAR_BONUS.id, cityId: DENVER, fires: true, amount: 5 },
    { bonusId: FIVE_DOLLAR_BONUS.id, cityId: KANSAS_CITY, fires: true, amount: 5 },
    { bonusId: FIVE_DOLLAR_BONUS.id, cityId: DALLAS, fires: true, amount: 5 },
    {
        bonusId: TRANSCONTINENTAL_BONUS.id,
        fires: false,
        why: 'every railroad stops once the bonus cities hold track, so none reaches the West Coast'
    }
]

// The railroads build only towards the bonus cities still empty; Black is never taken.
const sweepSteering: Steering = {
    sharePreference: () => [RED, BLUE, ORANGE, YELLOW, PURPLE],
    targetsOf: (state, railroadId) =>
        railroadId === BLACK
            ? []
            : BONUS_CITY_HEXES.filter((hexId) => railroadsIn(state.track, hexId).length === 0)
}

// Red from the East Coast and Purple from the West Coast each build to one meeting hex. Red's
// shares are taken in round 1 only, so its supply keeps locomotives for track (R-1.1).
function meetingSteering(meetAt: (state: RideTheRailsGameState) => HexId): Steering {
    return {
        sharePreference: (state) => (currentRoundNumber(state) === 1 ? [RED] : [PURPLE, BLUE]),
        targetsOf: (state, railroadId) => {
            const hexId = meetAt(state)
            return (railroadId === RED || railroadId === PURPLE) &&
                !hasTrackIn(state.track, hexId, railroadId)
                ? [hexId]
                : []
        }
    }
}

// Red builds to Kansas City but holds back a hex until Black, from round 5, starts there.
const blackStartSteering: Steering = {
    sharePreference: () => [BLACK, RED],
    targetsOf: (state, railroadId) => {
        const inCity = railroadsIn(state.track, KANSAS_CITY_HEX)
        if (railroadId === BLACK) {
            return inCity.length === 0 ? [KANSAS_CITY_HEX] : []
        }
        return railroadId === RED && !inCity.includes(RED) ? [KANSAS_CITY_HEX] : []
    },
    refuses: (state, placement) =>
        placement.hexId === KANSAS_CITY_HEX &&
        placement.railroadId !== BLACK &&
        !hasTrackIn(state.track, KANSAS_CITY_HEX, BLACK)
}

const NOT_ON_THE_WAY =
    'only Red and Purple build, towards Denver or the hex beside it, and neither passes it'
const SOUTH_OF_CHICAGO = 'Red’s shortest track west runs through Kansas City, south of Chicago'

const ONLY_KANSAS_CITY = 'only Red builds, towards Kansas City, and Black starts there'

const BOARDS: readonly Board[] = [
    {
        name: 'three players',
        playerCount: 3,
        masterSeed: '0123456789abcdef0123456789abcdef',
        steering: sweepSteering,
        entries: sweepEntries
    },
    {
        name: 'four players',
        playerCount: 4,
        masterSeed: 'fedcba9876543210fedcba9876543210',
        steering: sweepSteering,
        entries: sweepEntries
    },
    {
        name: 'five players',
        playerCount: 5,
        masterSeed: '00112233445566778899aabbccddeeff',
        steering: sweepSteering,
        entries: sweepEntries
    },
    {
        name: 'Red and Purple meet in Denver',
        playerCount: 3,
        masterSeed: '1111222233334444555566667777aaaa',
        steering: meetingSteering(() => DENVER_HEX),
        entries: [
            { bonusId: CHICAGO_BONUS.id, cityId: CHICAGO, fires: false, why: SOUTH_OF_CHICAGO },
            {
                bonusId: FIVE_DOLLAR_BONUS.id,
                cityId: MINNEAPOLIS,
                fires: false,
                why: NOT_ON_THE_WAY
            },
            // Red is first into Denver; Purple's arrival completes the Transcontinental line.
            { bonusId: FIVE_DOLLAR_BONUS.id, cityId: DENVER, fires: true, amount: 5 },
            { bonusId: FIVE_DOLLAR_BONUS.id, cityId: KANSAS_CITY, fires: true, amount: 5 },
            { bonusId: FIVE_DOLLAR_BONUS.id, cityId: DALLAS, fires: false, why: NOT_ON_THE_WAY },
            { bonusId: TRANSCONTINENTAL_BONUS.id, fires: true, amount: 12 }
        ]
    },
    {
        name: 'Red and Purple meet east of Denver',
        playerCount: 3,
        masterSeed: '2222333344445555666677778888bbbb',
        steering: meetingSteering((state) =>
            state.transcontinental ? DENVER_HEX : EAST_OF_DENVER
        ),
        entries: [
            { bonusId: CHICAGO_BONUS.id, cityId: CHICAGO, fires: false, why: SOUTH_OF_CHICAGO },
            {
                bonusId: FIVE_DOLLAR_BONUS.id,
                cityId: MINNEAPOLIS,
                fires: false,
                why: NOT_ON_THE_WAY
            },
            // Purple passes through Denver on its way to the plain hex east of it.
            { bonusId: FIVE_DOLLAR_BONUS.id, cityId: DENVER, fires: true, amount: 5 },
            { bonusId: FIVE_DOLLAR_BONUS.id, cityId: KANSAS_CITY, fires: true, amount: 5 },
            { bonusId: FIVE_DOLLAR_BONUS.id, cityId: DALLAS, fires: false, why: NOT_ON_THE_WAY },
            { bonusId: TRANSCONTINENTAL_BONUS.id, fires: true, amount: 8 }
        ]
    },
    {
        name: 'Black starts in Kansas City',
        playerCount: 3,
        masterSeed: '3333444455556666777788889999cccc',
        steering: blackStartSteering,
        entries: [
            {
                bonusId: CHICAGO_BONUS.id,
                cityId: CHICAGO,
                fires: false,
                why: 'Red’s shortest track to Kansas City runs south of Chicago'
            },
            {
                bonusId: FIVE_DOLLAR_BONUS.id,
                cityId: MINNEAPOLIS,
                fires: false,
                why: ONLY_KANSAS_CITY
            },
            { bonusId: FIVE_DOLLAR_BONUS.id, cityId: DENVER, fires: false, why: ONLY_KANSAS_CITY },
            {
                bonusId: FIVE_DOLLAR_BONUS.id,
                cityId: KANSAS_CITY,
                fires: false,
                why: 'Black starts there first, using the bonus up unpaid (R-4.3.2)'
            },
            { bonusId: FIVE_DOLLAR_BONUS.id, cityId: DALLAS, fires: false, why: ONLY_KANSAS_CITY },
            {
                bonusId: TRANSCONTINENTAL_BONUS.id,
                fires: false,
                why: 'no railroad builds or starts on the West Coast'
            }
        ]
    }
]

const played = new Map(
    BOARDS.map((board) => [
        board.name,
        playToEnd(seededGame(board.playerCount, board.masterSeed), board.steering)
    ])
)

function gameOf(name: string): SteeredGame {
    const game = played.get(name)
    if (!game) {
        throw new Error(`No game for ${name}`)
    }
    return game
}

function entryName(entry: Entry): string {
    return entry.cityId ? `${entry.bonusId} in ${entry.cityId}` : entry.bonusId
}

function paymentsOf(game: SteeredGame, entry: Entry): { placement: Placement; bonus: PaidBonus }[] {
    return placementsOf(game).flatMap((placement) =>
        placement.bonuses
            .filter((bonus) => sameEntry(bonus, entry))
            .map((bonus) => ({ placement, bonus }))
    )
}

function gainsOf(actionRun: ActionRun): Record<string, number> {
    const before = moneyOf(actionRun.before)
    return Object.fromEntries(
        Object.entries(moneyOf(actionRun.after)).map(([playerId, money]) => [
            playerId,
            money - (before[playerId] ?? 0)
        ])
    )
}

describe.each(BOARDS)('the USA bonuses in a steered game: $name (R-4.3)', (board) => {
    const game = gameOf(board.name)

    it('plays to the end with ordinary user actions only', () => {
        expect(game.state.result).toBeDefined()
        for (const actionRun of game.actionRuns) {
            expect(USER_ACTION_TYPES).toContain(actionRun.processed[0]?.type)
        }
    })

    it('pays each placement its city bonuses, in metadata and in money (R-3.2.5, R-4.3.1, R-4.3.2)', () => {
        for (const placement of placementsOf(game)) {
            const { actionRun, action, bonuses } = placement
            expect(bonuses.filter((bonus) => bonus.bonusId !== TRANSCONTINENTAL_BONUS.id)).toEqual(
                cityBonusesDue(actionRun.before, placement)
            )
            const paid = bonuses.reduce((total, bonus) => total + bonus.amount, 0)
            const expected = Object.fromEntries(
                actionRun.before.players.map(({ playerId }) => [
                    playerId,
                    playerId === action.playerId ? paid : 0
                ])
            )
            expect(gainsOf(actionRun)).toEqual(expected)
        }
    })

    it('claims the Transcontinental for the one placement that paid it (R-4.3.3)', () => {
        const payments = paymentsOf(game, { bonusId: TRANSCONTINENTAL_BONUS.id })
        expect(payments.length).toBeLessThanOrEqual(1)
        const [payment] = payments
        const claim = payment
            ? { playerId: payment.placement.action.playerId, amount: payment.bonus.amount }
            : undefined
        expect(game.state.transcontinental).toEqual(claim)
        if (payment) {
            expect(payment.placement.actionRun.before.transcontinental).toBeUndefined()
            expect(payment.placement.actionRun.after.transcontinental).toEqual(claim)
        }
    })

    for (const entry of board.entries) {
        if (entry.fires) {
            it(`fires ${entryName(entry)} at $${entry.amount} through PlaceLocomotive`, () => {
                const payments = paymentsOf(game, entry)
                expect(payments.length).toBeGreaterThan(0)
                if (entry.bonusId !== CHICAGO_BONUS.id) {
                    expect(payments).toHaveLength(1)
                }
                for (const { bonus } of payments) {
                    expect(bonus.amount).toBe(entry.amount)
                }
            })
        } else {
            it(`cannot fire ${entryName(entry)}: ${entry.why}`, () => {
                expect(paymentsOf(game, entry)).toEqual([])
            })
        }
    }
})

describe('the sweep boards (R-4.3.3)', () => {
    it.each(['three players', 'four players', 'five players'])(
        'leaves the West Coast cities empty, so no Transcontinental line can exist: %s',
        (name) => {
            const track = gameOf(name).state.track
            const westCoast = USA_CITIES.filter(isWestCoastCity)
            expect(westCoast.filter((city) => railroadsIn(track, city.hexId).length > 0)).toEqual(
                []
            )
        }
    )
})

describe('Chicago in a real game (R-4.3.1)', () => {
    it('pays a railroad that starts in Chicago', () => {
        const starts = placementsOf(gameOf('four players')).filter(
            ({ action, isStart }) => isStart && action.hexId === usaCity(CHICAGO).hexId
        )
        expect(starts.map(({ action, bonuses }) => [action.railroadId, bonuses])).toEqual([
            [ORANGE, [{ bonusId: CHICAGO_BONUS.id, amount: 2, cityId: CHICAGO }]]
        ])
        expect(starts.map(({ actionRun, action }) => gainsOf(actionRun)[action.playerId])).toEqual([
            2
        ])
    })
})

describe('a $5 city started in by Black, in a real game (R-4.3.2)', () => {
    const game = gameOf('Black starts in Kansas City')
    const inKansasCity = placementsOf(game).filter(({ action }) => action.hexId === KANSAS_CITY_HEX)

    it('is Black’s start, then a placement of the railroad that builds in', () => {
        expect(inKansasCity.map(({ action, isStart }) => [action.railroadId, isStart])).toEqual([
            [BLACK, true],
            [RED, false]
        ])
        const [start] = inKansasCity
        expect(hasTrack(start.actionRun.before.track, BLACK)).toBe(false)
    })

    it('pays neither of them, in metadata or in money', () => {
        for (const { actionRun, bonuses } of inKansasCity) {
            expect(bonuses).toEqual([])
            expect(Object.values(gainsOf(actionRun)).every((gain) => gain === 0)).toBe(true)
        }
    })
})

describe('the Transcontinental once taken, in a real game (R-4.3.3)', () => {
    it('pays nothing for a later line, even one that changes railroad only in a city', () => {
        const game = gameOf('Red and Purple meet east of Denver')
        const later = placementsOf(game).filter(({ actionRun }) => {
            const lineBefore = transcontinentalLine(actionRun.before.track)
            const lineAfter = transcontinentalLine(actionRun.after.track)
            return (
                lineBefore?.changesRailroadOnlyInCities === false &&
                lineAfter?.changesRailroadOnlyInCities === true
            )
        })
        expect(later.map(({ action }) => [action.railroadId, action.hexId])).toEqual([
            [RED, DENVER_HEX]
        ])
        const [{ actionRun, bonuses }] = later
        expect(actionRun.before.transcontinental?.amount).toBe(8)
        expect(bonuses).toEqual([])
        expect(actionRun.after.transcontinental).toEqual(actionRun.before.transcontinental)
    })
})
