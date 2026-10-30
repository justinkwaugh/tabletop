import {
    ActionSource,
    assert,
    defaultGameConfig,
    GameEngine,
    GameProgress,
    PlayerStatus,
    reportGameProgress,
    assertExists
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { SolGameStateValidator, type SolProjectedState } from '../model/gameState.js'
import { STARTING_INSTABILITY } from '../utils/solConstants.js'
import { Definition } from './gameDefinition.js'
import { SolInfo } from './info.js'
import { SolRuntime } from './runtime.js'
import { MachineState } from './states.js'
import recorded from './tests/recorded-legacy-2026.json'

const engine = new GameEngine(SolRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function startGame(count: number): SolProjectedState {
    const game = SolRuntime.initializer.initializeGame(
        {
            id: 'sol-progression',
            typeId: SolInfo.id,
            ownerId: 'owner',
            config: defaultGameConfig(SolInfo.configurator?.options ?? []),
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    return engine.startGame(game, { masterSeed }).initialState
}

function report(state: SolProjectedState): GameProgress {
    const progress = reportGameProgress(SolRuntime, state)
    assertExists(progress, 'Sol reports Game Progress')
    expect(Value.Check(GameProgress, progress)).toBe(true)
    return progress
}

describe('Sol Game Progress', () => {
    it.each([2, 3, 4, 5])('starts at the initial instability with %i players', (count) => {
        const state = startGame(count)
        expect(state.instability).toBe(STARTING_INSTABILITY)
        expect(report(state)).toEqual({
            fraction: 0,
            label: `Instability ${STARTING_INSTABILITY}`
        })
    })

    it('counts the flares down to the last one', () => {
        const state = startGame(4)
        const reports = Array.from({ length: STARTING_INSTABILITY + 1 }, (_, flares) =>
            report({ ...state, instability: STARTING_INSTABILITY - flares })
        )
        for (const [index, progress] of reports.entries())
            expect(progress.fraction).toBeGreaterThan(reports[index - 1]?.fraction ?? -1)
        expect(reports[6]).toEqual({
            fraction: Math.round((6 / STARTING_INSTABILITY) * 1000) / 1000,
            label: `Instability ${STARTING_INSTABILITY - 6}`
        })
        expect(reports.at(-3)).toEqual({
            fraction: Math.round((11 / STARTING_INSTABILITY) * 1000) / 1000,
            label: 'Instability 2'
        })
        expect(reports.at(-2)).toEqual({
            fraction: Math.round((12 / STARTING_INSTABILITY) * 1000) / 1000,
            label: 'Last flare',
            final: true
        })
        expect(reports.at(-1)).toEqual({ fraction: 1, label: 'Last flare', final: true })
        expect(reports.filter((progress) => progress.final)).toHaveLength(2)
    })

    it('reports a recorded four-player game from the first turn to the last flare', () => {
        assert(SolGameStateValidator.Check(recorded.initial), 'The recorded state is canonical')
        const game = SolRuntime.initializer.initializeGame(
            {
                id: recorded.gameId,
                typeId: SolInfo.id,
                ownerId: 'owner',
                config: recorded.config,
                players: recorded.players.map((id) => ({
                    id,
                    name: id,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            },
            Definition
        )

        let state: SolProjectedState = structuredClone(recorded.initial)
        const reports = [report(state)]
        for (const action of recorded.actions) {
            state = engine.executeCanonicalAction({
                game,
                state,
                action: { ...action, source: ActionSource.User }
            }).updatedState
            reports.push(report(state))
        }

        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.actionCount).toBe(recorded.actionCount)
        expect(state.winningPlayerIds).toEqual(recorded.winners)

        expect(reports[0]).toEqual({ fraction: 0, label: `Instability ${STARTING_INSTABILITY}` })
        expect(reports.at(-1)).toEqual({ fraction: 1, label: 'Last flare', final: true })
        for (const [index, progress] of reports.entries()) {
            expect(progress.fraction).toBeGreaterThanOrEqual(reports[index - 1]?.fraction ?? 0)
            expect(progress.final ?? false).toBe(progress.label === 'Last flare')
        }
        expect([...new Set(reports.map((progress) => progress.label))]).toEqual([
            ...Array.from(
                { length: STARTING_INSTABILITY - 1 },
                (_, flares) => `Instability ${STARTING_INSTABILITY - flares}`
            ),
            'Last flare'
        ])
    })
})
