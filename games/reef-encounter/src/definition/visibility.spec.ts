import { assert, assertExists, type Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { CoralColor } from '../components/colors.js'
import {
    ReefEncounterGameStateValidator,
    type ReefEncounterProjectedState
} from '../model/gameState.js'
import { completeSetup, startTestGame, type TestSession } from '../util/testHelper.js'
import { ReefEncounterRuntime } from './runtime.js'
import { MachineState } from './states.js'

// Only their owner sees these until the game ends.
const SecretFields = ['secretSupplyPolyps', 'secretParrotfishPolyps'] as const
// Anyone could track these, so they are shown unless the game is Concealed.
const TrackableFields = [
    'knownSupplyPolyps',
    'secretSupplyPolypCount',
    'knownParrotfishPolyps',
    'larvaCubes',
    'shrimpsInSupply',
    'shrimpsInParrotfish'
] as const
const PublicFields = ['playerId', 'color', 'shrimpOnOpenSea', 'consumedPolyps'] as const

function perspectivesFor(state: ReefEncounterProjectedState): Visibility.Perspective[] {
    return [
        { kind: 'spectator' },
        ...state.turnManager.turnOrder.map((playerId) => ({ kind: 'player', playerId }) as const)
    ]
}

function playTurns(session: TestSession, turns: number) {
    for (let turn = 0; turn < turns; turn++) {
        const space = session.state.openSea.find(
            (candidate) => session.state.larvaCubeSupply[candidate.larvaColor] > 0
        )
        assertExists(space, 'An open-sea space can be taken')
        session.takeOpenSeaSpace(session.currentPlayerId(), space.larvaColor)
    }
}

// The game at setup, part-way through, and at its end.
function stages(count: number, concealed: boolean): ReefEncounterProjectedState[] {
    const session = startTestGame(count, { concealed })
    const atSetup = structuredClone(session.state)
    completeSetup(session)
    playTurns(session, count * 2)
    const midGame = structuredClone(session.state)
    session.edit((draft) => {
        draft.larvaCubeSupply[CoralColor.Orange] = 0
    })
    session.takeOpenSeaSpace(session.currentPlayerId(), CoralColor.Orange)
    expect(session.state.machineState).toBe(MachineState.EndOfGame)
    return [atSetup, midGame, session.state]
}

describe.each([2, 3, 4])('what each Perspective sees with %i players', (count) => {
    it.each([false, true])('hides what it must and shows the rest (Concealed %s)', (concealed) => {
        for (const state of stages(count, concealed)) {
            assert(
                ReefEncounterGameStateValidator.Check(state),
                'Projection starts from canonical state'
            )
            const ended = state.machineState === MachineState.EndOfGame
            for (const perspective of perspectivesFor(state)) {
                const view = ReefEncounterRuntime.visibility.state.project(state, perspective, {
                    config: { concealed, advanced: false }
                })
                expect(view).not.toHaveProperty('masterSeed')
                expect(view.protectedPrng).toEqual({ seed: 0, invocations: 0 })
                expect(view.polypBag).toEqual({ items: [], remaining: state.polypBag.remaining })

                for (const player of view.players) {
                    const own =
                        perspective.kind === 'player' && perspective.playerId === player.playerId
                    const real: ReefEncounterProjectedState['players'][number] | undefined =
                        state.players.find((candidate) => candidate.playerId === player.playerId)
                    assertExists(real, 'Every projected player is in the game')
                    for (const field of SecretFields) {
                        expect(Object.hasOwn(player, field)).toBe(own || ended)
                    }
                    for (const field of TrackableFields) {
                        expect(Object.hasOwn(player, field)).toBe(own || ended || !concealed)
                    }
                    for (const field of [...SecretFields, ...TrackableFields, ...PublicFields]) {
                        if (Object.hasOwn(player, field)) {
                            expect(player[field]).toEqual(real[field])
                        }
                    }
                }
                expect(() => ReefEncounterRuntime.hydrator.hydrateState(view)).not.toThrow()
            }
        }
    })
})
