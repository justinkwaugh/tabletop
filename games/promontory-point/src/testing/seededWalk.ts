import { assert, type Game, type GameAction, type GameConfig } from '@tabletop/common'
import { isScrapTrack } from '../actions/scrapTrack.js'
import { perRailroad } from '../components/railroads.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { withHoldings } from './fixtures.js'
import { SeededPlayer } from './seededPlayer.js'
import { canonical, engine, startGame } from './startGame.js'
import { withNoRoomFor } from './turnPieces.js'

// Far more than any game takes: the bag of 96 runs out within a few dozen turns.
const ACTION_LIMIT = 2000

export type Step = {
    before: PromontoryPointGameState
    submitted: GameAction
    processedActions: GameAction[]
    // The state after each processed action of the cascade, in order.
    states: PromontoryPointGameState[]
}

export type Walk = { game: Game; initial: PromontoryPointGameState; steps: Step[] }

export type WalkSetting = { name: string; playerCount: number; config: GameConfig; seed: number }

export const WALKS: WalkSetting[] = [
    { name: '2 players', playerCount: 2, config: {}, seed: 11 },
    { name: '3 players', playerCount: 3, config: {}, seed: 24 },
    {
        name: '4 players, four-piece variant',
        playerCount: 4,
        config: { fourPieceVariant: true },
        seed: 37
    }
]

// R-3.3, R-4.3: the Kansas Pacific boxed in from the start and every seat nearly out of money, so
// a seeded game scraps, draws replacements and queues debtors as well as trading and placing.
function fixture(state: PromontoryPointGameState): PromontoryPointGameState {
    const boxedIn = withNoRoomFor(state, 'railroad.kp', 'railroad.up')
    return withHoldings(
        boxedIn,
        boxedIn.turnManager.turnOrder.map(() => ({
            money: 1,
            shares: perRailroad(() => 1)
        }))
    )
}

// R-6.1, R-6.1-H2: a seeded game through the real engine from the fixture to its end.
export function walk({ playerCount, config, seed }: WalkSetting): Walk {
    const started = startGame({ playerCount, config })
    const game = started.game
    const initial = fixture(started.state)
    return playToEnd(game, initial, new SeededPlayer(seed))
}

// R-6.1, R-6.1-H2: the seat's chosen action, step by step through the real engine, to the end;
// beforeStep may check each state an action is chosen in.
export function playToEnd(
    game: Game,
    initial: PromontoryPointGameState,
    player: SeededPlayer,
    beforeStep: (state: PromontoryPointGameState) => void = () => {}
): Walk {
    const steps: Step[] = []
    let state = initial
    while (state.machineState !== MachineState.EndOfGame) {
        assert(steps.length < ACTION_LIMIT, 'A seeded game ends')
        beforeStep(state)
        const submitted = player.nextAction(game, state)
        const { processedActions, actionCascade } = engine.executeCanonicalAction({
            action: submitted,
            state,
            game
        })
        const states = actionCascade.transitions.map(({ after }) => canonical(after))
        steps.push({ before: state, submitted, processedActions, states })
        state = states[states.length - 1]
    }
    return { game, initial, steps }
}

export function history(walked: Walk): GameAction[] {
    return walked.steps.flatMap(({ processedActions }) => processedActions)
}

export function finalState(walked: Walk): PromontoryPointGameState {
    return walked.steps.at(-1)?.states.at(-1) ?? walked.initial
}

// R-X.2: the barriers a reveal or a draw from the bag sets.
export function isUndoBarrier(action: GameAction): boolean {
    return (
        action.type === ActionType.RevealHand ||
        action.type === ActionType.EndTurn ||
        (isScrapTrack(action) && action.metadata?.bagEmpty === false)
    )
}
