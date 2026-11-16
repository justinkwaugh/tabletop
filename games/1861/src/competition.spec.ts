import { describe, expect, it } from 'vitest'
import {
    GameEngine,
    PlayerStatus,
    assertExists,
    validateGameResult,
    type GameConfig
} from '@tabletop/common'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'
import { Definition } from './definition/gameDefinition.js'
import { Privates1861, privateTerms1861 } from './privates.js'
import type { State1861 } from './state.js'

const masterSeed = '00000000000000000000000000001861'
const PlayerCounts = [2, 3, 4, 5, 6] as const
// The options that change setup or play: the special trains, the price floor, the RSR's
// exports, the game's end and who follows an auction (§14).
const SetupConfigs: readonly GameConfig[] = [
    {},
    { unlimitedSpecialTrains: false },
    { noPriceFloor: true },
    { trainExports: true },
    { longGame: true },
    { proposerOrder: true }
]

const engine = new GameEngine(Definition.runtime)

function createGame(count: number, config: GameConfig) {
    return Definition.runtime.initializer.initializeGame(
        {
            id: 'starting-positions',
            typeId: Definition.info.id,
            ownerId: 'p0',
            config,
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `p${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function start(count: number, config: GameConfig, playerIds?: readonly string[]) {
    const game = createGame(count, config)
    const started = engine.startGame(game, {
        masterSeed,
        ...(playerIds ? { startingPositions: { playerIds: [...playerIds] } } : {})
    })
    return started.initialState
}

function withoutId({ id: _id, ...state }: State1861) {
    return state
}

/** The ordinary setup as the assigned seating should leave it: only the order and opener move. */
function seated(ordinary: State1861, playerIds: readonly string[]) {
    const [seatOne] = playerIds
    const auction = ordinary.selectionAuction
    return {
        ...withoutId(ordinary),
        activePlayerIds: [seatOne],
        turnManager: {
            ...ordinary.turnManager,
            turnOrder: [...playerIds],
            series: [{ type: 'turn', playerId: seatOne, start: 0 }]
        },
        ...(auction ? { selectionAuction: { ...auction, nominatorId: seatOne } } : {})
    }
}

function rotations(playerIds: readonly string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

/** Who opens each private's auction as every other player passes it to its opener (§9.4). */
function openersOfPrivateAuction(count: number, config: GameConfig, seats: readonly string[]) {
    const game = kit.table(count, 7, config, () => [...seats])
    const openers: string[] = []
    for (;;) {
        const [lotId] = game.state.selectionAuction?.remainingLotIds ?? []
        if (!lotId || game.state.machineState !== 'SelectionAuction') return openers
        openers.push(game.player)
        game.act('NominateLot', { lotId, amount: privateTerms1861(lotId).minimumBid })
        while (game.state.selectionAuction?.bidding) game.act('PassSelectionAuction')
    }
}

describe.each(SetupConfigs.flatMap((config) => PlayerCounts.map((count) => ({ count, config }))))(
    '1861 assigned starting positions with $count players and config $config',
    ({ count, config }) => {
        const ordinary = start(count, config)

        it('reproduces an ordinary game from its master seed', () => {
            expect(withoutId(start(count, config))).toEqual(withoutId(ordinary))
            expect(ordinary.masterSeed).toBe(masterSeed)
            expect(ordinary.protectedPrng).toMatchObject({ algorithm: 'chacha20-v1' })
        })

        it('reproduces the ordinary setup when assigned its seating', () => {
            expect(withoutId(start(count, config, ordinary.turnManager.turnOrder))).toEqual(
                withoutId(ordinary)
            )
        })

        it.each(
            [
                ...rotations(ordinary.turnManager.turnOrder),
                [...ordinary.turnManager.turnOrder].reverse()
            ].map((playerIds) => ({ playerIds }))
        )('seats $playerIds with the first seat opening the private auction', ({ playerIds }) => {
            const assigned = start(count, config, playerIds)
            expect(withoutId(assigned)).toEqual(seated(ordinary, playerIds))
            expect(assigned.machineState).toBe('SelectionAuction')
            expect(assigned.activePlayerIds).toEqual([playerIds[0]])
        })
    }
)

describe('1861 private auction order', () => {
    it.each(
        PlayerCounts.flatMap((count) =>
            [{}, { proposerOrder: true }].map((config) => ({ count, config }))
        )
    )(
        'passes the opening around the table in seat order with $count players and $config',
        ({ count, config }) => {
            const seats = Array.from({ length: count }, (_, index) => `p${count - index}`)
            const lots = start(count, config).selectionAuction?.remainingLotIds ?? []
            expect(lots.length).toBe(count === 2 ? Privates1861.length - 2 : Privates1861.length)
            expect(openersOfPrivateAuction(count, config, seats)).toEqual(
                lots.map((_, index) => seats[index % count])
            )
        }
    )
})

describe('1861 competition setup', () => {
    it.each(PlayerCounts.map((count) => ({ count })))(
        'starts a $count-player game with a colour for each player',
        ({ count }) => {
            const colors = start(count, {}).players.map((player) => player.color)
            expect(new Set(colors).size).toBe(count)
            expect(colors.every(Boolean)).toBe(true)
        }
    )

    it('rejects an assignment that does not seat every player once', () => {
        const game = createGame(3, {})
        expect(() =>
            Definition.runtime.initializer.initializeGameState(
                game,
                engine.generateUninitializedState(game, masterSeed),
                { playerIds: ['p1', 'p2', 'stranger'] }
            )
        ).toThrow('Starting positions must assign every player exactly once')
    })
})

function expectRankedResult(state: State1861) {
    expect(state.machineState).toBe('GameOver')
    expect(() => validateGameResult(state)).not.toThrow()
    const scoring = Definition.runtime.scoring
    assertExists(scoring, '1861 declares final scores')
    const scores = scoring.finalScores(state)
    const highest = Math.max(...Object.values(scores))
    expect(
        Object.keys(scores)
            .filter((playerId) => scores[playerId] === highest)
            .sort()
    ).toEqual([...(state.winningPlayerIds ?? [])].sort())
}

describe('1861 competition results', () => {
    it(
        'finishes a game from assigned seats with a valid result ranked by final scores',
        { timeout: 600_000 },
        () => {
            const seed = 1
            const game = kit.table(2, seed, undefined, (playerIds) => [...playerIds].reverse())
            expect(game.state.turnManager.turnOrder).toEqual(['p2', 'p1'])
            playOut(game, seed)
            expectRankedResult(game.state)
        }
    )
})
