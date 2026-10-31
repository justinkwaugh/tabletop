import { describe, expect, it } from 'vitest'
import {
    isSetRunInstruction,
    isSetRunInstructionStops,
    type InstructedRun,
    type StandingRunInstruction
} from '@tabletop/18xx'
import { RunInstructionModule, type RunInstructionSession } from './runInstructionModule.svelte.js'
import { testSession } from './moduleTestSession.js'

function instructionState(
    runInstructions?: StandingRunInstruction[]
): RunInstructionSession['state'] {
    return {
        result: undefined,
        companies: [
            { id: 'IR', kind: 'major', president: { kind: 'player', playerId: 'alex' } },
            { id: 'AR', kind: 'major', president: { kind: 'player', playerId: 'blair' } },
            {
                id: 'SR',
                kind: 'major',
                president: { kind: 'player', playerId: 'alex' },
                closed: true
            }
        ],
        certificates: [],
        ...(runInstructions ? { runInstructions } : {})
    }
}

function standing(stop?: StandingRunInstruction['stopReason']): StandingRunInstruction {
    return {
        companyId: 'IR',
        playerId: 'alex',
        payout: 'pay',
        declaredRevenue: 90,
        declaredTrainIds: ['2/1'],
        runs: [{ routes: [], key: 'k' }],
        ...(stop ? { stopReason: stop } : {})
    }
}

function module(
    state: RunInstructionSession['state'],
    {
        solved = { routes: [], key: 'k' },
        validActionTypes = ['SetRunInstruction'],
        supersedes,
        operatingCompanies = ['IR', 'AR'],
        operatingOrder = []
    }: {
        solved?: InstructedRun
        validActionTypes?: string[]
        supersedes?: string
        operatingCompanies?: readonly string[]
        operatingOrder?: readonly string[]
    } = {}
) {
    const rules = { operatingRules: { companyOrder: () => operatingCompanies } }
    const { session, applied } = testSession(state, rules, validActionTypes, { supersedes })
    const solves: string[] = []
    const runs = new RunInstructionModule(
        session,
        () => async (companyId) => {
            solves.push(companyId)
            return solved
        },
        () => operatingOrder
    )
    return { runs, applied, solves, session }
}

describe('Run instruction module', () => {
    it('lists the operating companies the viewer presides over', () => {
        const { runs } = module(instructionState([standing()]))
        expect(runs.presided).toEqual(['IR'])
        expect(runs.declared).toEqual([standing()])
        const unavailable = module(instructionState(), { validActionTypes: [] }).runs
        expect([unavailable.presided, unavailable.declared]).toEqual([[], []])
        expect(module(instructionState()).runs.declared).toEqual([])
    })

    it('lists the companies in operating order, any floated since the order was set last', () => {
        const president = { kind: 'player', playerId: 'alex' } as const
        const state = instructionState()
        state.companies = [
            { id: 'IR', kind: 'major', president },
            { id: 'UR', kind: 'major', president },
            { id: 'TR', kind: 'major', president }
        ]
        const { runs } = module(state, {
            operatingCompanies: ['UR', 'IR', 'TR'],
            operatingOrder: ['AR', 'TR', 'IR']
        })
        expect(runs.presided).toEqual(['TR', 'IR', 'UR'])
    })

    it('declares with the company’s solved run', async () => {
        const { runs, applied, solves } = module(instructionState())
        await runs.declare('IR')
        expect(solves).toEqual(['IR'])
        const [declaration] = applied
        expect(isSetRunInstruction(declaration) && declaration.instruction).toEqual({
            payout: 'pay',
            run: { routes: [], key: 'k' }
        })
        expect(runs.changing).toBeUndefined()
    })

    it('declares nothing when the best run cannot be proven in time', async () => {
        const { runs, applied, session } = module(instructionState(), {
            solved: { unsolved: true, key: 'k' }
        })
        await runs.declare('IR')
        expect(applied).toEqual([])
        expect(runs.failure?.companyId).toBe('IR')
        Object.assign(session, { state: instructionState() })
        expect(runs.failure).toBeUndefined()
    })

    it('cancels, and resumes a stopped instruction by ignoring its stop', async () => {
        const { runs, applied } = module(instructionState([standing('run-lowered')]))
        await runs.keepGoing('IR')
        await runs.cancel('IR')
        const [resume, cancel] = applied
        expect(isSetRunInstructionStops(resume) && resume.ignoredStops).toEqual(['run-lowered'])
        expect(isSetRunInstruction(cancel) && cancel.instruction).toBeUndefined()
    })

    it('names the declaration a cancel replaces, so toggling does not grow history', async () => {
        const { runs, applied } = module(instructionState([standing()]), { supersedes: 'on' })
        await runs.cancel('IR')
        expect(applied[0].supersedesActionId).toBe('on')
    })

    it('sends stops chosen before declaring with the declaration, and changes them after', async () => {
        const { runs, applied } = module(instructionState())
        await runs.toggleIgnoredStop('IR', 'run-lowered')
        expect(applied).toEqual([])
        expect(runs.ignoredStops('IR')).toEqual(['run-lowered'])
        await runs.declare('IR')
        const [declaration] = applied
        expect(isSetRunInstruction(declaration) && declaration.instruction?.ignoredStops).toEqual([
            'run-lowered'
        ])

        const declared = module(instructionState([standing()]))
        await declared.runs.toggleIgnoredStop('IR', 'train-lost')
        const [change] = declared.applied
        expect(isSetRunInstructionStops(change) && change.ignoredStops).toEqual(['train-lost'])
    })
})
