import { GameResult, validateGameResult, type Game, type GameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Side } from '../components/pieces.js'
import { roundLabel } from '../components/timeTrack.js'
import { VictoryKind } from '../model/gameState.js'
import { TestGame, passTurns, playOut } from '../testing/harness.js'
import { ActionType } from './actions.js'
import { Definition } from './definition.js'
import { NapoleonsTriumphRuntime } from './runtime.js'
import { MachineState } from './states.js'

const SEED = '0123456789abcdef0123456789abcdef'
const SEATINGS = [
    ['p0', 'p1'],
    ['p1', 'p0']
]

function notYetStarted({ id, typeId, ownerId, config, players }: Game): Game {
    return NapoleonsTriumphRuntime.initializer.initializeGame(
        { id, typeId, ownerId, config, players },
        Definition
    )
}

function seated(
    playerIds: readonly string[],
    masterSeed = SEED,
    config: GameConfig = {}
): TestGame {
    const game = new TestGame(config, masterSeed)
    const { startedGame, initialState } = game.engine.startGame(notYetStarted(game.game), {
        masterSeed,
        startingPositions: { playerIds: [...playerIds] }
    })
    game.game = startedGame
    game.state = initialState
    return game
}

function deal(game: TestGame) {
    const state = game.hydrated
    return {
        blocks: Object.fromEntries(
            state.units.map((unit) => [
                unit.id,
                { face: unit.face, side: state.sideOf(unit.playerId) }
            ])
        ),
        colors: Object.fromEntries(state.players.map((player) => [player.side, player.color])),
        prng: state.prng,
        protectedPrng: state.protectedPrng
    }
}

describe('assigned starting positions', () => {
    it.each(SEATINGS)(
        'give the first position the Allies, who set up first and move first: %s, %s',
        (first, second) => {
            const game = seated([first, second])
            const state = game.hydrated
            expect(state.turnManager.turnOrder).toEqual([first, second])
            expect(state.playerOf(Side.Allied)).toMatchObject({ playerId: first, morale: 27 })
            expect(state.playerOf(Side.French)).toMatchObject({ playerId: second, morale: 23 })
            expect(state.machineState).toBe(MachineState.AlliedSetup)
            expect(state.activePlayerIds).toEqual([first])

            expect(() => game.deploy(Side.French)).toThrow()
            game.deploy(Side.Allied)
            expect(game.state.machineState).toBe(MachineState.FrenchSetup)
            expect(game.state.activePlayerIds).toEqual([second])
            game.deploy(Side.French)
            expect(game.state.machineState).toBe(MachineState.Commanding)
            expect(roundLabel(game.hydrated.currentRound, true)).toBe('2 December · 7:00AM')
            expect(game.state.activePlayerIds).toEqual([first])
            passTurns(game, 1)
            expect(game.state.activePlayerIds).toEqual([second])
            passTurns(game, 1)
            expect(game.state.activePlayerIds).toEqual([first])
        }
    )

    it.each(SEATINGS)(
        'do not take the place of the morale auction, which position zero opens: %s, %s',
        (first, second) => {
            const game = seated([first, second], SEED, { sideSelection: 'Auction' })
            expect(game.state.machineState).toBe(MachineState.Bidding)
            expect(game.state.activePlayerIds).toEqual([first])
            game.act(ActionType.PlaceBid, first, { amount: 2 })
            game.act(ActionType.PassBid, second)
            game.act(ActionType.ChooseSide, first, { side: Side.French })
            expect(game.hydrated.playerOf(Side.French)).toMatchObject({
                playerId: first,
                morale: 21
            })
            expect(game.hydrated.playerOf(Side.Allied)).toMatchObject({
                playerId: second,
                morale: 27
            })
        }
    )

    it('leave the deal of the blocks, the colours of the armies and the random streams as the seed made them', () => {
        const ordinary = deal(new TestGame({}, SEED))
        for (const seating of SEATINGS) {
            expect(deal(seated(seating))).toEqual(ordinary)
        }
    })

    it('change nothing when they ask for the seating the seed would have given', () => {
        const ordinary = new TestGame({}, SEED)
        const assigned = seated(ordinary.state.turnManager.turnOrder)
        expect({ ...assigned.canonical, id: undefined }).toEqual({
            ...ordinary.canonical,
            id: undefined
        })
    })

    it('start the same game every time for the same seed and seating', () => {
        const [seating] = SEATINGS.filter(
            ([first]) => first !== new TestGame({}, SEED).playerOf(Side.Allied)
        )
        const first = seated(seating)
        const second = seated(seating)
        expect({ ...second.canonical, id: undefined }).toEqual({
            ...first.canonical,
            id: undefined
        })
        expect(first.playerOf(Side.Allied)).toBe(seating[0])
    })

    it.each([
        ['one player twice', ['p0', 'p0']],
        ['only one player', ['p0']],
        ['a stranger', ['p0', 'p2']]
    ])('are refused when they name %s', (_fault, playerIds) => {
        const game = new TestGame()
        expect(() =>
            game.engine.startGame(notYetStarted(game.game), { startingPositions: { playerIds } })
        ).toThrow()
    })

    it('keep each player’s blocks hidden from the other', () => {
        const game = seated(['p1', 'p0'])
        game.deployBoth()
        const view = NapoleonsTriumphRuntime.visibility.state.project(
            game.canonical,
            { kind: 'player', playerId: 'p0' },
            { config: game.game.config }
        )
        for (const unit of view.units) {
            expect('face' in unit).toBe(unit.playerId === 'p0')
        }
    })

    it('record the result against the players as seated', () => {
        const game = seated(['p1', 'p0'])
        game.deployBoth()
        playOut(game)
        const state = game.hydrated
        expect(state.victory).toBe(VictoryKind.Marginal)
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toEqual(['p0'])
        expect(state.sideOf('p0')).toBe(Side.French)
        expect(() => validateGameResult(game.canonical)).not.toThrow()
        expect(() => game.act(ActionType.EndTurn, 'p0')).toThrow()
    })
})
