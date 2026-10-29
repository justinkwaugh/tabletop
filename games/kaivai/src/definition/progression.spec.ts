import {
    ActionSource,
    assert,
    assertExists,
    GameEngine,
    GameProgress,
    MachineContext,
    PlayerStatus,
    reportGameProgress,
    type Game,
    type GameAction
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { HydratedBuild } from '../actions/build.js'
import { HydratedMoveGod } from '../actions/moveGod.js'
import type { HydratedKaivaiGameState, KaivaiProjectedState } from '../model/gameState.js'
import { ActionType } from './actions.js'
import { Ruleset } from './gameConfig.js'
import { Definition } from './gameDefinition.js'
import { HutType } from './huts.js'
import { KaivaiRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(KaivaiRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'
const lowestRoundBid = 1

function createGame(count: number, ruleset: Ruleset) {
    return KaivaiRuntime.initializer.initializeGame(
        {
            id: 'kaivai-progression',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config: { ruleset, lucklessFishing: false },
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function initialHut(state: HydratedKaivaiGameState, playerId: string) {
    const coordList = [...state.board.grid].map((node) => node.coords)
    for (const hutType of [HutType.BoatBuilding, HutType.Fishing]) {
        const coords = coordList.find(
            (coords) => HydratedBuild.isValidPlacement(state, { playerId, hutType, coords }).valid
        )
        if (coords) return { type: ActionType.Build, playerId, hutType, coords }
    }
    throw Error(`${playerId} has nowhere to build an initial hut`)
}

function passingMove(game: Game, state: HydratedKaivaiGameState, playerId: string) {
    switch (state.machineState) {
        case MachineState.Bidding: {
            const taken = Object.values(state.bids)
            let amount = lowestRoundBid
            while (taken.includes(amount)) amount++
            return { type: ActionType.PlaceBid, playerId, amount }
        }
        case MachineState.InitialHuts:
            return initialHut(state, playerId)
        case MachineState.MovingGod: {
            const coords = [...state.board.grid]
                .map((node) => node.coords)
                .find((coords) => HydratedMoveGod.isValidPlacement(state, coords).valid)
            assertExists(coords, 'The god has somewhere to move')
            return { type: ActionType.MoveGod, playerId, coords }
        }
        case MachineState.TakingActions: {
            const context = new MachineContext({ gameState: state, gameConfig: game.config })
            const [passOrSacrifice] = KaivaiRuntime.stateHandlers[
                MachineState.TakingActions
            ].validActionsForPlayer(playerId, context)
            return { type: passOrSacrifice, playerId }
        }
        case MachineState.FinalScoring:
            return {
                type: ActionType.ChooseScoringIsland,
                playerId,
                islandId: state.islandsToScore[0]
            }
        case MachineState.IslandBidding:
            return { type: ActionType.PlaceScoringBid, playerId, amount: 0 }
        default:
            throw Error(`No passing move in ${state.machineState}`)
    }
}

function playToEnd(
    count: number,
    ruleset: Ruleset,
    onState: (state: KaivaiProjectedState) => void
): KaivaiProjectedState {
    const game = createGame(count, ruleset)
    const { startedGame, initialState } = engine.startGame(game, { masterSeed })
    let state = initialState
    onState(state)
    for (let step = 0; state.machineState !== MachineState.EndOfGame; step++) {
        assert(step < 5000, 'Playthrough did not finish')
        const hydrated = KaivaiRuntime.hydrator.hydrateState(state)
        const [playerId] = hydrated.activePlayerIds
        assertExists(playerId, `No active player in ${state.machineState}`)
        const action: GameAction = {
            id: `progression-${step}`,
            gameId: startedGame.id,
            source: ActionSource.User,
            ...passingMove(startedGame, hydrated, playerId)
        }
        state = engine.executeCanonicalAction({ game: startedGame, state, action }).updatedState
        onState(state)
    }
    return state
}

const finalScoringStates = [
    MachineState.FinalScoring,
    MachineState.IslandBidding,
    MachineState.EndOfGame
]

describe.each([3, 4])('Kaivai Game Progress with %i players', (count) => {
    it.each([
        { ruleset: Ruleset.FirstEdition, roundCount: 10 },
        { ruleset: Ruleset.SecondEdition, roundCount: 8 }
    ])('counts $roundCount rounds of $ruleset, then final scoring', ({ ruleset, roundCount }) => {
        const reports: GameProgress[] = []
        const finished = playToEnd(count, ruleset, (state) => {
            const progress = reportGameProgress(KaivaiRuntime, state)
            assertExists(progress, 'Kaivai reports Game Progress')
            expect(Value.Check(GameProgress, progress)).toBe(true)
            const roundNumber = state.rounds.series.length
            const expected = finalScoringStates.includes(state.machineState)
                ? { fraction: 1, label: 'Final scoring', final: true }
                : roundNumber === roundCount
                  ? { label: 'Last round', final: true }
                  : { label: `Round ${roundNumber} of ${roundCount}` }
            expect(progress).toMatchObject(expected)
            expect(progress.final).toBe(expected.final)
            reports.push(progress)
        })
        expect(finished.rounds.series).toHaveLength(roundCount)
        expect(reports[0]).toEqual({ fraction: 0, label: `Round 1 of ${roundCount}` })
        for (const [index, progress] of reports.entries())
            expect(progress.fraction).toBeGreaterThanOrEqual(reports[index - 1]?.fraction ?? 0)
        const labels = [...new Set(reports.map((progress) => progress.label))]
        expect(labels).toEqual([
            ...Array.from(
                { length: roundCount - 1 },
                (_, index) => `Round ${index + 1} of ${roundCount}`
            ),
            'Last round',
            'Final scoring'
        ])
        expect(reports.find((progress) => progress.label === 'Last round')).toEqual({
            fraction: Math.round(((roundCount - 1) / roundCount) * 1000) / 1000,
            label: 'Last round',
            final: true
        })
        expect(reports.at(-1)).toEqual({ fraction: 1, label: 'Final scoring', final: true })
    })
})
