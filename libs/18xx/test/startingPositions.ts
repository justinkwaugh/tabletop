import { describe, expect, it } from 'vitest'
import {
    GameEngine,
    PlayerStatus,
    assertExists,
    validateGameResult,
    type GameDefinition,
    type HydratedGameState
} from '@tabletop/common'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'

const masterSeed = '0123456789abcdef0123456789abcdef'

function rotations(playerIds: readonly string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

/** The opening auction with seat one as its first actor. */
function openingSeated(
    state: Pick<EighteenXXState, 'openingAuction' | 'selectionAuction' | 'offerAuction'>,
    seatOne: string
): Partial<EighteenXXState> {
    const { openingAuction, selectionAuction, offerAuction } = state
    return {
        ...(openingAuction && { openingAuction: { ...openingAuction, nextPlayerId: seatOne } }),
        ...(selectionAuction && {
            selectionAuction: { ...selectionAuction, nominatorId: seatOne }
        }),
        ...(offerAuction && { offerAuction: { ...offerAuction, auctioneerId: seatOne } })
    }
}

/** The ordinary setup with the assigned seating: only the turn order and who acts first move. */
function seatedAsAssigned<Raw extends EighteenXXState>(
    ordinary: Omit<Raw, 'id'>,
    playerIds: readonly string[]
): Omit<Raw, 'id'> {
    const seatOne = playerIds[0]
    return {
        ...ordinary,
        activePlayerIds: [seatOne],
        turnManager: {
            ...ordinary.turnManager,
            turnOrder: [...playerIds],
            series: [{ type: 'turn', playerId: seatOne, start: 0 }]
        },
        ...openingSeated(ordinary, seatOne)
    }
}

function finishOperatingTurn<
    Raw extends EighteenXXState,
    State extends HydratedEighteenXXState & HydratedGameState<Raw>
>(play: ExamplePlay<Raw, State>) {
    const companyId = play.state.trainPurchaseStep?.companyId
    assertExists(companyId, 'The ending position is a company buying trains')
    play.act('FinishOperatingTurn', { companyId })
}

export function startingPositionTests<
    Raw extends EighteenXXState,
    State extends HydratedEighteenXXState & HydratedGameState<Raw>
>(
    definition: GameDefinition<Raw, State>,
    scenarios: GameDefinition<Raw, State>,
    playerCounts: readonly number[],
    {
        setupConfigs = [{}],
        finishEnding = finishOperatingTurn,
        seated = seatedAsAssigned
    }: {
        /** Configurations that change setup or the first player, each run at every count. */
        setupConfigs?: readonly Record<string, unknown>[]
        /** Plays the prepared final turn to the game's end. */
        finishEnding?: (play: ExamplePlay<Raw, State>) => void
        /** The ordinary setup as the assigned seating should leave it. */
        seated?: (ordinary: Omit<Raw, 'id'>, playerIds: readonly string[]) => Omit<Raw, 'id'>
    } = {}
) {
    const engine = new GameEngine(definition.runtime)
    const createGame = (count: number, gameDefinition = definition, config = {}) =>
        gameDefinition.runtime.initializer.initializeGame(
            {
                id: 'starting-positions',
                typeId: gameDefinition.info.id,
                ownerId: 'p0',
                config,
                players: Array.from({ length: count }, (_, index) => ({
                    id: `p${index}`,
                    name: `p${index}`,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            },
            gameDefinition
        )
    const start = (count: number, playerIds?: string[], config = {}) => {
        const { id, ...state } = engine.startGame(createGame(count, definition, config), {
            masterSeed,
            ...(playerIds ? { startingPositions: { playerIds } } : {})
        }).initialState
        return state
    }

    describe.each(
        setupConfigs.flatMap((config) => playerCounts.map((count) => ({ count, config })))
    )('assigned starting positions with $count players and config $config', ({ count, config }) => {
        const ordinary = start(count, undefined, config)

        it('reproduces an ordinary game from its master seed', () => {
            expect(start(count, undefined, config)).toEqual(ordinary)
            expect(ordinary.masterSeed).toBe(masterSeed)
            expect(ordinary.protectedPrng).toMatchObject({ algorithm: 'chacha20-v1' })
        })

        it('reproduces the ordinary setup when assigned its seating', () => {
            expect(start(count, ordinary.turnManager.turnOrder, config)).toEqual(ordinary)
        })

        it.each(
            [
                ...rotations(ordinary.turnManager.turnOrder),
                [...ordinary.turnManager.turnOrder].reverse()
            ].map((playerIds) => ({ playerIds }))
        )('seats $playerIds and starts with the first position', ({ playerIds }) => {
            const assigned = start(count, playerIds, config)
            expect(assigned).toEqual(seated(ordinary, playerIds))
            expect(assigned.activePlayerIds).toEqual([playerIds[0]])
            expect(assigned.turnManager.turnOrder).toEqual(playerIds)
        })
    })

    it('rejects an assignment that does not seat every player once', () => {
        const count = playerCounts[0]
        const playerIds = Array.from({ length: count }, (_, index) => `p${index}`)
        expect(() =>
            definition.runtime.initializer.initializeGameState(
                createGame(count),
                engine.generateUninitializedState(createGame(count), masterSeed),
                { playerIds: [...playerIds.slice(1), 'stranger'] }
            )
        ).toThrow('Starting positions must assign every player exactly once')
    })

    it('rejects assigned starting positions for a prepared scenario', () => {
        const game = createGame(3, scenarios, { examplePosition: 'trading' })
        expect(() =>
            new GameEngine(scenarios.runtime).startGame(game, {
                masterSeed,
                startingPositions: { playerIds: ['p2', 'p0', 'p1'] }
            })
        ).toThrow('Prepared scenarios do not support assigned starting positions')
    })

    it('finishes the final operating turn with a valid result ranked by final scores', () => {
        const play = playExample(scenarios, 'ending')
        finishEnding(play)
        const finished = play.state
        expect(finished.machineState).toBe('GameOver')
        expect(() => validateGameResult(finished)).not.toThrow()
        const scoring = scenarios.runtime.scoring
        assertExists(scoring, '18xx titles declare final scores')
        const scores = scoring.finalScores(finished)
        const highest = Math.max(...Object.values(scores))
        expect(Object.keys(scores).filter((id) => scores[id] === highest)).toEqual(
            finished.winningPlayerIds
        )
    })
}
