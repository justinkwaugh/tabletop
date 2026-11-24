import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    ActionType,
    MachineState,
    PlanKind,
    type PlanOutcome,
    type ReactSoil,
    type RevealPlans
} from '@tabletop/dicke-kartoffeln'
import { latestYearEnd } from './yearEnd.js'

const reactSoil: ReactSoil = {
    id: 'soil',
    gameId: 'game',
    source: ActionSource.System,
    type: ActionType.ReactSoil,
    index: 0,
    metadata: { farms: [] }
}

function spreadCompost(outcome: Omit<PlanOutcome, 'playerId' | 'loansTaken'>): GameAction[] {
    const reveal: RevealPlans = {
        id: 'spread',
        gameId: 'game',
        source: ActionSource.System,
        type: ActionType.RevealPlans,
        step: MachineState.SpreadingCompost,
        index: 1,
        metadata: { outcomes: [{ playerId: 'p1', loansTaken: 0, ...outcome }] }
    }
    return [reactSoil, reveal]
}

function compostResults(actions: GameAction[]): string[] | undefined {
    return latestYearEnd(actions, [])?.phases[1].results.p1
}

describe('the compost year-end results', () => {
    it('shows what the worms sold for and the net when the farm also paid', () => {
        const actions = spreadCompost({
            plan: {
                kind: PlanKind.SpreadCompost,
                placements: [1, 2, 3, 4, 5].map((fieldId) => ({ fieldId, worms: 5 }))
            },
            cost: 500,
            income: 300
        })
        expect(compostResults(actions)).toEqual([
            'spread 25 worms on fields 1, 2, 3, 4 and 5',
            'sold 5 worms to the bank for 300 M',
            'paid 500 M',
            'net −200 M'
        ])
    })

    it('leaves the net off when the farm only sold', () => {
        const actions = spreadCompost({
            plan: { kind: PlanKind.SpreadCompost, placements: [] },
            cost: 0,
            income: 120
        })
        expect(compostResults(actions)).toEqual(['sold 2 worms to the bank for 120 M'])
    })
})
