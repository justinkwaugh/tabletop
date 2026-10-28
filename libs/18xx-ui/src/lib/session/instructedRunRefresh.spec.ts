import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    instructedRunsOf,
    type InstructedRun,
    type RunTrains,
    type StandingRunInstruction
} from '@tabletop/18xx'
import {
    withInstructedRuns,
    type RunRefreshContext,
    type InstructedRunState,
    type SimulatedCascade
} from './instructedRunRefresh.js'

type Position = InstructedRunState & { routeKey: string }

function position(routeKey: string, runs: InstructedRun[], president = 'alex'): Position {
    const declared: StandingRunInstruction = {
        companyId: 'AR',
        playerId: 'alex',
        payout: 'pay',
        declaredRevenue: 40,
        declaredTrainIds: [],
        runs
    }
    return {
        routeKey,
        companies: [
            { id: 'AR', kind: 'major', president: { kind: 'player', playerId: president } }
        ],
        certificates: [],
        runInstructions: [declared]
    }
}

const action: GameAction = {
    id: 'finish',
    gameId: 'game',
    source: ActionSource.User,
    type: 'FinishTrack',
    playerId: 'blair'
}

function instructedRun(): GameAction {
    const run: RunTrains = {
        id: 'run',
        gameId: 'game',
        source: ActionSource.System,
        type: 'RunTrains',
        playerId: 'alex',
        companyId: 'AR',
        routes: []
    }
    return run
}

function solver(simulate: (action: GameAction) => SimulatedCascade<Position>) {
    const solved: string[] = []
    const refresh: RunRefreshContext<Position> = {
        simulate,
        read: (state) => state,
        key: (state) => state.routeKey,
        solve: async (state, _companyId, key) => {
            solved.push(state.routeKey)
            return key === 'unprovable' ? { unsolved: true, key } : { routes: [], key }
        }
    }
    return { refresh, solved }
}

const attachments = instructedRunsOf

describe('Instructed run refresh', () => {
    it('leaves an Action alone when every stored run fits its position', async () => {
        const fresh = position('k1', [{ routes: [], key: 'k1' }])
        const { refresh, solved } = solver(() => ({ before: fresh, transitions: [] }))
        expect(await withInstructedRuns(action, refresh)).toEqual(action)
        expect(solved).toEqual([])
    })

    it('attaches the run for the position the cascade ends in', async () => {
        const before = position('k1', [{ routes: [], key: 'k1' }])
        const after = position('k2', [{ routes: [], key: 'k1' }])
        const { refresh, solved } = solver((candidate) => ({
            before,
            transitions: [
                {
                    action: candidate,
                    after: attachments(candidate)
                        ? position('k2', [{ routes: [], key: 'k2' }])
                        : after
                }
            ]
        }))
        const attached = await withInstructedRuns(action, refresh)
        expect(attachments(attached)).toEqual([
            { companyId: 'AR', runs: [{ routes: [], key: 'k2' }] }
        ])
        expect(solved).toEqual(['k2'])
    })

    it('attaches one run for each turn the cascade reaches, then one for its end', async () => {
        const stored: InstructedRun = { routes: [], key: 'old' }
        const { refresh } = solver((candidate) => {
            const runs = attachments(candidate)?.[0]?.runs ?? [stored]
            return {
                before: position('start', [stored]),
                transitions: [
                    { action: candidate, after: position('turn', runs) },
                    {
                        action: instructedRun(),
                        after: position('end', runs.length > 1 ? runs.slice(1) : runs)
                    }
                ]
            }
        })
        const attached = await withInstructedRuns(action, refresh)
        expect(attachments(attached)).toEqual([
            {
                companyId: 'AR',
                runs: [
                    { routes: [], key: 'turn' },
                    { routes: [], key: 'end' }
                ]
            }
        ])
    })

    it('records a position the solver could not prove', async () => {
        const { refresh } = solver((candidate) => ({
            before: position(
                'unprovable',
                attachments(candidate)?.[0]?.runs ?? [{ routes: [], key: 'old' }]
            ),
            transitions: []
        }))
        const attached = await withInstructedRuns(action, refresh)
        expect(attachments(attached)).toEqual([
            { companyId: 'AR', runs: [{ unsolved: true, key: 'unprovable' }] }
        ])
    })

    it('solves each position once, following a company its corrected run lets operate', async () => {
        // With its stale run the company stops at its turn; with the right one it runs, and the
        // cascade goes on to a later turn of the same company.
        const stale: InstructedRun = { routes: [], key: 'old' }
        const { refresh, solved } = solver((candidate) => {
            const runs = attachments(candidate)?.[0]?.runs ?? [stale]
            const [first, ...later] = runs
            if (first.key !== 'turn')
                return {
                    before: position('start', [stale]),
                    transitions: [{ action: candidate, after: position('turn', runs) }]
                }
            const second = later.length ? later : runs
            const afterFirst = position('later turn', second)
            const rest = second.length > 1 ? second.slice(1) : second
            return {
                before: position('start', [stale]),
                transitions: [
                    { action: candidate, after: position('turn', runs) },
                    { action: instructedRun(), after: afterFirst },
                    { action: instructedRun(), after: position('end', rest) }
                ]
            }
        })
        const attached = await withInstructedRuns(action, refresh)
        expect(attachments(attached)?.[0]?.runs.map((run) => run.key)).toEqual([
            'turn',
            'later turn',
            'end'
        ])
        expect(solved).toEqual(['turn', 'later turn', 'end'])
    })

    it('skips an instruction whose player no longer presides', async () => {
        const { refresh, solved } = solver(() => ({
            before: position('k2', [{ routes: [], key: 'k1' }], 'casey'),
            transitions: []
        }))
        expect(await withInstructedRuns(action, refresh)).toEqual(action)
        expect(solved).toEqual([])
    })

    it('sends the Action unchanged when it cannot be executed locally', async () => {
        const { refresh } = solver(() => {
            throw new Error('Invalid action')
        })
        expect(await withInstructedRuns(action, refresh)).toEqual(action)
    })

    it('keeps the run each earlier turn used when a later position needs a new one', async () => {
        // Two turns face the same routes; the position after them does not.
        const stale: InstructedRun = { routes: [], key: 'old' }
        const spend = (runs: InstructedRun[]) => (runs.length > 1 ? runs.slice(1) : runs)
        const { refresh, solved } = solver((candidate) => {
            const runs = attachments(candidate)?.[0]?.runs ?? [stale]
            const afterFirst = spend(runs)
            return {
                before: position('start', [stale]),
                transitions: [
                    { action: candidate, after: position('turn', runs) },
                    { action: instructedRun(), after: position('turn', afterFirst) },
                    { action: instructedRun(), after: position('end', spend(afterFirst)) }
                ]
            }
        })
        const attached = await withInstructedRuns(action, refresh)
        expect(attachments(attached)?.[0]?.runs.map((run) => run.key)).toEqual([
            'turn',
            'turn',
            'end'
        ])
        expect(solved).toEqual(['turn', 'end'])
    })
})
