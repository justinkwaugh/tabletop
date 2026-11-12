import { ActionSource, GameEngine, type GameAction } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { isAnswerAttack } from '../actions/answerAttack.js'
import { isAnswerStarve } from '../actions/answerStarve.js'
import { isBeginDawn } from '../actions/beginDawn.js'
import { isFeast } from '../actions/feast.js'
import { isGuildAction } from '../actions/guildAction.js'
import { isImprove } from '../actions/improve.js'
import { isKeepWrits } from '../actions/keepWrits.js'
import { isRevealPouches } from '../actions/revealPouches.js'
import { isRollProgressDie } from '../actions/rollProgressDie.js'
import { isScoreGame } from '../actions/scoreGame.js'
import { isTendLandscape } from '../actions/tendLandscape.js'
import type { FeudumProjectedState } from '../model/gameState.js'
import {
    completeGame,
    persistedReplay,
    publicPart,
    replayFromView
} from '../testing/completeGame.js'
import {
    asStored,
    perspectivesOf,
    processedOf,
    seedOf,
    Spectator,
    viewOf
} from '../testing/protected.js'
import { undoAction, withoutClock, type GameWalk } from '../testing/walk.js'
import { ActionType } from './actions.js'
import { FeudumRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(FeudumRuntime)

/**
 * Pinned to the seats' choices and the rules, so a change to either can drop a case below: its spec
 * then fails by name, and the answer is other seeds, not a weaker spec.
 */
const Games = [
    { numPlayers: 2, seeds: [3, 4, 6] },
    { numPlayers: 3, seeds: [1, 2, 7] },
    { numPlayers: 4, seeds: [6, 7, 8] },
    { numPlayers: 5, seeds: [5, 1, 3] }
].flatMap(({ numPlayers, seeds }) => seeds.map((seed) => ({ numPlayers, seed: seedOf(seed) })))

const played = new Map<string, GameWalk>()

/** Each game once; a stall fails every spec of that seed and seat count, naming where it stood. */
function walkOf(seed: string, numPlayers: number): GameWalk {
    const key = `${numPlayers} ${seed}`
    const walk = played.get(key) ?? completeGame(seed, numPlayers)
    played.set(key, walk)
    return walk
}

const SystemActions: readonly string[] = [
    ActionType.StartRound,
    ActionType.RevealPouches,
    ActionType.AdvanceTurn,
    ActionType.NourishPawns,
    ActionType.RollProgressDie,
    ActionType.BeginDawn,
    ActionType.ReplenishMap,
    ActionType.ReplenishGuilds,
    ActionType.EndRound,
    ActionType.ScoreGame
]

const hasEmptyStack = ({ regionStacks }: FeudumProjectedState): boolean =>
    Object.values(regionStacks).some((stack) => stack.length === 0)

/**
 * R-6.1-H1 A stack emptied while cards were still being played: those cards finish, no die is rolled,
 * epoch V's dawn comes next and the game is scored.
 */
function reachedVMidRound(walk: GameWalk): boolean {
    const actions = processedOf(walk)
    const states = walk.steps.flatMap(({ after }) => after)
    const emptiedAt = states.findIndex(hasEmptyStack)
    if (emptiedAt < 0) {
        return false
    }
    const rollAt = actions.findIndex(
        (action, index) => index > emptiedAt && isRollProgressDie(action)
    )
    const [roll] = actions.slice(rollAt, rollAt + 1).filter(isRollProgressDie)
    const rest = actions.slice(rollAt)
    return (
        states
            .slice(emptiedAt, rollAt)
            .some(({ machineState }) => machineState === MachineState.PlayingCards) &&
        roll?.metadata?.faces.length === 0 &&
        rest.filter(isBeginDawn)[0]?.metadata?.epoch === 5 &&
        rest.some(isScoreGame)
    )
}

/**
 * A record as storage replays it. A stored state keeps no undefined field, so its keys can come in
 * another order, and the patches of a cascade with them: the same operations, listed differently.
 */
function settled(action: GameAction): GameAction {
    const byPath = (patch: GameAction['undoPatch']) =>
        patch && [...patch].sort((a, b) => a.path.localeCompare(b.path))
    return {
        ...withoutClock(action),
        forwardPatch: byPath(action.forwardPatch),
        undoPatch: byPath(action.undoPatch)
    }
}

const dawnAt =
    (epoch: number) =>
    (action: GameAction): boolean =>
        isBeginDawn(action) && action.metadata?.epoch === epoch

/** What the seeds must reach between them: each is a spec of its own, so a gap fails by name. */
const Coverage: readonly {
    readonly name: string
    readonly reached: (walk: GameWalk) => boolean
}[] = [
    {
        name: 'R-3.14-H1, R-4.8 the attack ask',
        reached: (walk) => processedOf(walk).some(isAnswerAttack)
    },
    {
        name: 'R-3.14-H1, R-3.12.3 the Royal Immunity ask',
        reached: (walk) => processedOf(walk).some(isAnswerStarve)
    },
    { name: 'R-4.4.1 a writ draw', reached: (walk) => processedOf(walk).some(isKeepWrits) },
    { name: 'R-3.16.3 a feast', reached: (walk) => processedOf(walk).some(isFeast) },
    ...[2, 3, 4, 5].map((epoch) => ({
        name: `R-4.12 the dawn of epoch ${epoch}`,
        reached: (walk: GameWalk) => processedOf(walk).some(dawnAt(epoch))
    })),
    { name: 'R-6.1-H1 a V reached mid-round', reached: reachedVMidRound },
    {
        name: 'R-3.9.1 a town improved to a feudum',
        reached: (walk) =>
            processedOf(walk).some(
                (action) => isImprove(action) && action.metadata?.to === 'feudum'
            )
    },
    {
        name: 'R-4.6.3 a monster tamed',
        reached: (walk) =>
            processedOf(walk).some(
                (action) =>
                    isGuildAction(action) && action.metadata?.details.kind === 'knight-trade'
            )
    },
    {
        name: 'R-4.10.2 a landscape tended',
        reached: (walk) => processedOf(walk).some(isTendLandscape)
    }
]

/** Every Action type a seat may send, each taken somewhere since the seats go after what's fresh. */
const UserActions = Object.values(ActionType).filter((type) => !SystemActions.includes(type))

describe.each(Games)(
    'R-6.1 a scripted game at $numPlayers players, seed $seed',
    { timeout: 60_000 },
    ({ seed, numPlayers }) => {
        const walk = () => walkOf(seed, numPlayers)

        it('R-6.1, R-6.3 reaches the end of the game with a score for every seat', () => {
            const { final, game } = walk()
            expect(final.machineState).toBe(MachineState.EndOfGame)
            expect(final.activePlayerIds).toEqual([])
            const scores = FeudumRuntime.scoring.finalScores(final)
            expect(Object.keys(scores).sort()).toEqual(game.players.map(({ id }) => id).sort())
            expect(Object.values(scores).every(Number.isInteger)).toBe(true)
            for (const { id } of game.players) {
                expect(engine.getValidActionTypesForPlayer(game, final, id)).toEqual([])
            }
        })

        it('R-X.2 sends only what the handler offered: ordinary user Actions', () => {
            const { game, steps } = walk()
            for (const { input, before, processed } of steps) {
                expect(SystemActions).not.toContain(input.type)
                expect(processed[0]).toMatchObject({ type: input.type, source: ActionSource.User })
                expect(engine.getValidActionTypesForPlayer(game, before, input.playerId)).toContain(
                    input.type
                )
            }
        })

        it('R-X.2 replays from storage to the same cascades and the same final state', () => {
            const original = walk()
            const replay = persistedReplay(original)
            expect(replay.cascades).toEqual(original.steps.map(({ processed }) => processed.length))
            expect(replay.processed.map(settled)).toEqual(processedOf(original).map(settled))
            expect(replay.final).toEqual(original.final)
        })

        it('R-X.2 undoes every Action in reverse, each back to the state before it', () => {
            const original = walk()
            const backwards = original.steps
                .flatMap(({ before, processed, after }) =>
                    processed.map((action, index) => ({
                        action,
                        previous: index === 0 ? before : after[index - 1]
                    }))
                )
                .reverse()
            let state = original.final
            for (const { action, previous } of backwards) {
                state = undoAction(action, state)
                expect(state).toEqual(previous)
            }
            expect(state).toEqual(original.initial)
        })

        it('R-3.1-H1 no view tells a pouch good or a hand size until every seat has finalised', () => {
            const original = walk()
            let hidden = 0
            let revealed = 0
            for (const { processed, after } of original.steps) {
                processed.forEach((action, index) => {
                    const state = after[index]
                    for (const perspective of perspectivesOf(original)) {
                        const view = viewOf(state, perspective, original)
                        for (const row of view.players) {
                            const own =
                                perspective.kind === 'player' &&
                                perspective.playerId === row.playerId
                            if (state.machineState === MachineState.SelectingHands && !own) {
                                expect(row).not.toHaveProperty('committedPouch')
                                expect(row).not.toHaveProperty('hand')
                                expect(row.pouch).toBeUndefined()
                                expect(row.handCount).toBe(0)
                                hidden++
                            }
                        }
                        if (isRevealPouches(action)) {
                            const told = (action.metadata?.pouches ?? []).map(
                                ({ playerId }) => playerId
                            )
                            for (const row of view.players) {
                                expect(row.pouch !== undefined).toBe(told.includes(row.playerId))
                                expect(row.handCount).toBeGreaterThan(0)
                            }
                            revealed += told.length
                        }
                    }
                })
            }
            expect(hidden).toBeGreaterThan(0)
            expect(revealed).toBeGreaterThan(0)
        })

        it('R-5.1, R-5-H1 replays from each seat and a spectator to one public final state', () => {
            const original = walk()
            const expected = publicPart(viewOf(original.final, Spectator, original))
            const replays = perspectivesOf(original).map((perspective) => ({
                perspective,
                replay: replayFromView(original, perspective)
            }))
            for (const { perspective, replay } of replays) {
                expect(asStored(replay.final)).toEqual(
                    asStored(viewOf(original.final, perspective, original))
                )
                expect(publicPart(replay.final)).toEqual(expected)
                expect(replay.guessed).toEqual([])
                expect(replay.needless).toEqual([])
                expect(replay.differs).toEqual([])
            }
            const seats = replays.filter(({ perspective }) => perspective.kind === 'player')
            expect(seats.flatMap(({ replay }) => replay.ran)).not.toEqual([])
            // R-5.1 Exploring draws from the vault, so no seat's view can run it.
            expect(seats.flatMap(({ replay }) => replay.deferred)).toContain(ActionType.Explore)
        })
    }
)

describe('R-6.1 between them the scripted games reach', () => {
    const walks = () => Games.map(({ seed, numPlayers }) => walkOf(seed, numPlayers))

    it.each(Coverage)('$name', { timeout: 120_000 }, ({ reached }) => {
        expect(walks().filter(reached).length).toBeGreaterThan(0)
    })

    it.each([2, 3, 4, 5])(
        'R-4.12 at %i players, every run has the four dawns in order',
        { timeout: 120_000 },
        (numPlayers) => {
            const games = Games.filter((game) => game.numPlayers === numPlayers)
            expect(games.length).toBeGreaterThanOrEqual(3)
            for (const { seed } of games) {
                const dawns = processedOf(walkOf(seed, numPlayers))
                    .filter(isBeginDawn)
                    .map((action) => action.metadata?.epoch)
                expect(dawns).toEqual([2, 3, 4, 5])
            }
        }
    )

    it('R-X.2 every Action type a seat may send, by preferring what a game has not taken', () => {
        const taken = new Set(walks().flatMap(({ steps }) => steps.map(({ input }) => input.type)))
        expect(UserActions.filter((type) => !taken.has(type))).toEqual([])
    }, 120_000)
})
