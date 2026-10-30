import {
    ExplorationHistory,
    Visibility,
    assert,
    assertExists,
    deriveGameSeeds,
    getPrng,
    type Game,
    type GameAction
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { RAILROAD_IDS } from '../components/railroads.js'
import { ActionType } from './actions.js'
import { PromontoryPointRuntime } from './runtime.js'
import { MachineState } from './states.js'
import {
    PromontoryPointGameStateValidator,
    type PromontoryPointGameState,
    type PromontoryPointProjectedState
} from '../model/gameState.js'
import { invariantsHold } from '../model/invariants.js'
import {
    CompleteGamePlayer,
    PlayStyle,
    masterSeedOf,
    playCompleteGame,
    type CompleteGameSetting
} from '../testing/completeGame.js'
import type { Step } from '../testing/seededWalk.js'
import { canonical, engine } from '../testing/startGame.js'

// Far more than any branch takes: the bag of 96 runs out within a few dozen turns.
const ACTION_LIMIT = 2000
const BRANCH_SEED = 5
const spectator = { kind: 'spectator' } as const

type Moment = {
    name: string
    state: PromontoryPointGameState
    // The actions that led to it.
    actions: GameAction[]
}

type Run = CompleteGameSetting & { name: string; game: Game; moments: Moment[] }

const SETTINGS: CompleteGameSetting[] = [
    { playerCount: 2, config: {}, seed: 3, style: PlayStyle.Spender },
    { playerCount: 3, config: { fourPieceVariant: true }, seed: 1, style: PlayStyle.TownSeeker },
    { playerCount: 4, config: { fourPieceVariant: true }, seed: 2, style: PlayStyle.Blocker },
    { playerCount: 4, config: {}, seed: 3, style: PlayStyle.Spender }
]

// The states of a scripted complete game the exploration is tried at, where each occurs.
function momentsOf(setting: CompleteGameSetting): { game: Game; moments: Moment[] } {
    const walked = playCompleteGame(setting)
    // A seat acts only once a cascade settles, so each moment is the state a step leaves.
    const settled = walked.steps.map((step, index) => {
        const state = step.states.at(-1)
        assertExists(state, 'A step leaves a state')
        const actions = walked.steps
            .slice(0, index + 1)
            .flatMap(({ processedActions }) => processedActions)
        return { step, state, actions }
    })
    const first = (
        name: string,
        found: (state: PromontoryPointGameState, step: Step) => boolean
    ): Moment[] => {
        const moment = settled.find(({ state, step }) => found(state, step))
        return moment === undefined ? [] : [{ name, state: moment.state, actions: moment.actions }]
    }
    const lastStep = walked.steps.at(-1)
    assertExists(lastStep, 'A complete game takes steps')
    return {
        game: walked.game,
        moments: [
            // R-2.2 step 1: a later turn's pieces just revealed, the other hands still concealed.
            ...first('the start of a turn', (_, step) =>
                step.processedActions.some(({ type }) => type === ActionType.RevealHand)
            ),
            ...first(
                'mid-placing',
                (state) =>
                    state.machineState === MachineState.Placing &&
                    (state.turn?.placementsMade ?? 0) > 0
            ),
            ...first('a pending Repairs', (state) => state.pendingRepairs !== undefined),
            // R-6.3, R-6.3-H2
            ...first('a variant kept piece', (state) =>
                state.players.some((player) => player.keptPiece !== undefined)
            ),
            // R-6.1: the state the game-ending EndTurn is taken from.
            {
                name: 'the last turn',
                state: lastStep.before,
                actions: settled.at(-2)?.actions ?? []
            }
        ]
    }
}

const RUNS: Run[] = SETTINGS.map((setting) => {
    const variant = setting.config.fourPieceVariant === true ? 'variant on' : 'variant off'
    return {
        ...setting,
        name: `${setting.playerCount} players, ${variant}, seed ${setting.seed}`,
        ...momentsOf(setting)
    }
})

const CASES = RUNS.flatMap((run) => run.moments.map((moment) => ({ ...moment, run })))

function perspectivesOf(state: PromontoryPointGameState): Visibility.Perspective[] {
    return [
        ...state.turnManager.turnOrder.map((playerId) => ({ kind: 'player', playerId }) as const),
        spectator
    ]
}

function project(
    state: PromontoryPointGameState,
    game: Game,
    perspective: Visibility.Perspective
): PromontoryPointProjectedState {
    return PromontoryPointRuntime.visibility.state.project(state, perspective, {
        config: game.config
    })
}

// What the platform hands a new branch: no master seed, and fresh public and protected streams,
// fixed here so a branch is reproducible.
function prepared(
    source: PromontoryPointProjectedState,
    seed = BRANCH_SEED
): PromontoryPointProjectedState {
    const state = new ExplorationHistory(engine).prepareState(source)
    state.prng = { seed, invocations: 0 }
    state.protectedPrng = {
        algorithm: 'chacha20-v1',
        seed: deriveGameSeeds(masterSeedOf(seed)).protectedSeed,
        invocations: 0
    }
    return state
}

function explore(
    source: PromontoryPointGameState,
    { run, actions }: { run: Run; actions: GameAction[] },
    perspective: Visibility.Perspective,
    seed = BRANCH_SEED
): PromontoryPointGameState {
    return PromontoryPointRuntime.exploration.createFromProjectedState({
        game: run.game,
        state: prepared(project(source, run.game, perspective)),
        actions,
        perspective,
        random: getPrng(seed)
    })
}

// The projection less the streams a branch replaces.
function named(view: PromontoryPointProjectedState): PromontoryPointProjectedState {
    const kept = structuredClone(view)
    delete kept.masterSeed
    delete kept.protectedPrng
    kept.prng = { seed: 0, invocations: 0 }
    return kept
}

// The same game with values the explorer cannot see changed: the bag in reverse, and two hidden
// pieces of different railroads (in the bag or an unseen hand) traded. Undefined when nothing
// hidden can change.
function withHiddenValuesChanged(
    state: PromontoryPointGameState,
    perspective: Visibility.Perspective
): PromontoryPointGameState | undefined {
    const changed = structuredClone(state)
    changed.bag.items.reverse()
    const hidden = [
        changed.bag.items,
        ...changed.players
            .filter(
                ({ playerId }) => perspective.kind !== 'player' || playerId !== perspective.playerId
            )
            .map(({ hand }) => hand)
    ].flatMap((pieces) => pieces.map((piece, index) => ({ pieces, index, piece })))
    const [first] = hidden
    const other = hidden.find(({ piece }) => piece !== first?.piece)
    if (first === undefined || other === undefined) {
        return undefined
    }
    first.pieces[first.index] = other.piece
    other.pieces[other.index] = first.piece
    return changed
}

// R-6.1, R-6.1-H2: a branch plays on through the real engine, with ordinary user actions, to the
// game's end, conserving every piece.
function playToTheEnd(run: Run, branch: PromontoryPointGameState): PromontoryPointGameState {
    const player = new CompleteGamePlayer(run.seed, run.style)
    let state = branch
    let taken = 0
    while (state.machineState !== MachineState.EndOfGame) {
        assert(taken < ACTION_LIMIT, 'A branch ends')
        const { updatedState } = engine.executeCanonicalAction({
            action: player.nextAction(run.game, state),
            state,
            game: run.game
        })
        state = canonical(updatedState)
        assert(invariantsHold(state), 'A branch conserves every piece')
        taken += 1
    }
    return state
}

function pieceCounts(pieces: readonly string[]): Record<string, number> {
    return Object.fromEntries(
        RAILROAD_IDS.map((railroadId) => [
            railroadId,
            pieces.filter((piece) => piece === railroadId).length
        ])
    )
}

describe('Promontory Point exploration', () => {
    it('R-5, R-6.3: the scripted games reach every state exploration is tried at', () => {
        expect(new Set(CASES.map(({ name }) => name))).toEqual(
            new Set([
                'the start of a turn',
                'mid-placing',
                'a pending Repairs',
                'a variant kept piece',
                'the last turn'
            ])
        )
    })

    describe.each(CASES)('$run.name, at $name', (moment) => {
        const { run, state: source } = moment

        describe.each(perspectivesOf(source))('from %o', (perspective) => {
            const view = project(source, run.game, perspective)
            const branch = explore(source, moment, perspective)

            it('R-5, R-6.3-H2: keeps everything the projection names, the explorer’s hand and kept pieces among it', () => {
                expect(named(project(branch, run.game, perspective))).toEqual(named(view))
                for (const [index, player] of branch.players.entries()) {
                    expect(player.keptPiece).toBe(source.players[index].keptPiece)
                    if (perspective.kind === 'player' && player.playerId === perspective.playerId) {
                        expect(player.hand).toEqual(source.players[index].hand)
                    }
                }
            })

            it('R-5: deals each unseen hand its count and the bag the rest, with no master seed', () => {
                expect(PromontoryPointGameStateValidator.Check(branch)).toBe(true)
                expect(() => engine.validateCanonicalState(branch)).not.toThrow()
                expect(branch).not.toHaveProperty('masterSeed')
                for (const [index, player] of branch.players.entries()) {
                    expect(player.hand).toHaveLength(source.players[index].handCount)
                }
                expect(branch.bag.items).toHaveLength(source.bag.remaining)
                expect(branch.bag.remaining).toBe(source.bag.remaining)
                const unseen = (state: PromontoryPointGameState) =>
                    pieceCounts([
                        ...state.bag.items,
                        ...state.players
                            .filter(
                                ({ playerId }) =>
                                    perspective.kind !== 'player' ||
                                    playerId !== perspective.playerId
                            )
                            .flatMap(({ hand }) => hand)
                    ])
                expect(unseen(branch)).toEqual(unseen(source))
            })

            it('R-5: is the same branch from a source differing only in hidden values, and reproducible from its randomness', () => {
                expect(explore(source, moment, perspective)).toEqual(branch)
                const changed = withHiddenValuesChanged(source, perspective)
                if (changed !== undefined) {
                    expect(changed).not.toEqual(source)
                    expect(project(changed, run.game, perspective)).toEqual(view)
                    expect(explore(changed, moment, perspective)).toEqual(branch)
                }
            })

            it('R-6.1: plays on to the end', () => {
                expect(playToTheEnd(run, branch).machineState).toBe(MachineState.EndOfGame)
            })
        })

        it('R-5: from canonical state, reshuffles the bag from the branch’s new protected stream and keeps every hand', () => {
            const start = prepared(source)
            const branch = PromontoryPointRuntime.exploration.createFromCanonicalState(start)
            assert(
                PromontoryPointGameStateValidator.Check(branch),
                'A canonical branch is complete'
            )
            expect(branch.players).toEqual(source.players)
            expect(pieceCounts(branch.bag.items)).toEqual(pieceCounts(source.bag.items))
            const { bag, protectedPrng: _branchStream, ...rest } = branch
            const { bag: startBag, protectedPrng: _startStream, ...startRest } = start
            expect(rest).toEqual(startRest)
            expect(bag.remaining).toBe(startBag.remaining)
            expect(
                PromontoryPointRuntime.exploration.createFromCanonicalState(prepared(source))
            ).toEqual(branch)
            expect(playToTheEnd(run, branch).machineState).toBe(MachineState.EndOfGame)
        })
    })

    it('R-5: a different branch randomness deals the unseen pieces differently', () => {
        const moment = CASES.find(({ name }) => name === 'the start of a turn')
        assertExists(moment, 'A turn starts in a scripted game')
        const branch = explore(moment.state, moment, spectator)
        expect(explore(moment.state, moment, spectator, BRANCH_SEED + 1)).not.toEqual(branch)
    })

    it('R-5: from canonical state, a new protected stream reorders the bag', () => {
        const moment = CASES.find(({ name }) => name === 'the start of a turn')
        assertExists(moment, 'A turn starts in a scripted game')
        const branch = PromontoryPointRuntime.exploration.createFromCanonicalState(
            prepared(moment.state)
        )
        expect(branch.bag.items).not.toEqual(moment.state.bag.items)
    })
})
