import { describe, expect, it } from 'vitest'
import { assertExists, GameEngine, validateGameResult } from '@tabletop/common'
import { botMove, Random } from '../test/bot.js'
import { kit } from '../test/kit.js'
import { Definition } from './definition/gameDefinition.js'
import { ScenarioIds1822 } from './scenarioCatalog.js'

const runtime = Definition.runtime
const counts = [3, 4, 5, 6, 7]

// Every configuration that changes setup: 1822+ and its ways of dealing the privates, the tax
// haven variant, and each scenario (§6.1, §6.2.1).
const Configurations: readonly [string, Record<string, boolean | string> | undefined][] = [
    ['the standard game', undefined],
    ['1822+', { plus: true }],
    [
        '1822+ with all privates and tax haven shares',
        { plus: true, allPrivates: true, taxHavenShares: true }
    ],
    ['1822+ with mixed privates', { plus: true, mixedPrivates: true }],
    ...ScenarioIds1822.map((scenario): [string, Record<string, string>] => [
        `the ${scenario} scenario`,
        { scenario }
    ])
]

function rotations(playerIds: readonly string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

// What a seat assignment rightly changes: the turn order, and who acts first.
function withoutSeating(state: object, normal: { turnManager: object }) {
    return JSON.parse(
        JSON.stringify({ ...state, turnManager: normal.turnManager }, (key, value) =>
            key === 'activePlayerIds' ? undefined : value
        )
    )
}

describe.each(
    Configurations.flatMap(([name, config]) =>
        counts.map((count) => [name, count, config] as const)
    )
)('1822 tournaments: %s with %i players', (_, count, config) => {
    const ids = Array.from({ length: count }, (_, index) => `p${index + 1}`)

    it('seats each assigned order in the first stock round', () => {
        for (const order of rotations(ids)) {
            const game = kit.table(count, 7, config, () => order)
            expect(game.state.turnManager.turnOrder).toEqual(order)
            expect(game.player).toBe(order[0])
        }
    })

    it('leaves ordinary setup otherwise unchanged', () => {
        const game = kit.table(count, 7, config).game
        const engine = new GameEngine(runtime)
        const uninitialized = engine.generateUninitializedState(
            game,
            '0123456789abcdef0123456789abcdef'
        )
        const initialize = (playerIds?: string[]) =>
            runtime.initializer
                .initializeGameState(
                    game,
                    structuredClone(uninitialized),
                    playerIds ? { playerIds } : undefined
                )
                .dehydrate()
        const normal = initialize()
        expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)
        for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
            const assigned = initialize(order)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect(withoutSeating(assigned, normal)).toEqual(withoutSeating(normal, normal))
        }
    })
})

describe('1822 results', () => {
    it('scores every player from a finished game', { timeout: 600_000 }, () => {
        const ids = ['p1', 'p2', 'p3', 'p4']
        const game = kit.table(4, 1, undefined, () => [...ids].reverse())
        const random = new Random(1)
        for (let moves = 0; moves < 20_000 && game.state.machineState !== 'GameOver'; moves++) {
            const next = botMove(game, random)
            game.act(next.type, next.fields, next.playerId)
        }
        expect(game.state.machineState).toBe('GameOver')
        expect(() => validateGameResult(game.hydrated)).not.toThrow()
        const scoring = runtime.scoring
        assertExists(scoring, 'The title reports final scores')
        expect(Object.keys(scoring.finalScores(game.state)).toSorted()).toEqual(ids.toSorted())
    })

    it('scores every player from a finished scenario game', { timeout: 600_000 }, () => {
        const ids = ['p1', 'p2', 'p3', 'p4']
        const game = kit.table(4, 1, { scenario: 'mini-game' }, () => [...ids].reverse())
        const random = new Random(1)
        for (let moves = 0; moves < 20_000 && game.state.machineState !== 'GameOver'; moves++) {
            const next = botMove(game, random)
            game.act(next.type, next.fields, next.playerId)
        }
        expect(game.state.machineState).toBe('GameOver')
        expect(() => validateGameResult(game.hydrated)).not.toThrow()
    })
})
