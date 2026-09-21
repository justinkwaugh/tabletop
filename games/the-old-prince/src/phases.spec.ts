import { expect, it } from 'vitest'
import type { Train } from '@tabletop/18xx'
import { TheOldPrincePhaseRules } from './phaseRules.js'
import { TheOldPrincePhases, TheOldPrinceTrainDepot } from './trains.js'
import { createTheOldPrinceOpening } from './openingAuction.js'
import { Prng } from '@tabletop/common'

it('declares the TOP phases', () => {
    expect(
        TheOldPrincePhases.phases.map((phase) => [
            phase.id,
            phase.tileColors.at(-1),
            phase.operatingRounds,
            phase.trainLimit
        ])
    ).toEqual([
        ['2H', 'yellow', 1, 4],
        ['3H', 'yellow', 1, 4],
        ['4H', 'green', 2, 4],
        ['5H', 'green', 2, 4],
        ['6H', 'green', 2, 4],
        ['2+', 'green', 2, 3],
        ['3+', 'green', 2, 3],
        ['4+', 'brown', 3, 3],
        ['7', 'brown', 3, 2],
        ['D', 'gray', 3, 2]
    ])
})

it('starts each phase with its train and rusts each train on schedule', () => {
    for (const phase of TheOldPrincePhases.phases.slice(1))
        expect(TheOldPrincePhases.phaseAfterPurchase('2H', phase.id)).toBe(phase.id)
    const firstRustedIn = Object.fromEntries(
        TheOldPrinceTrainDepot.definition.trains.map((train) => [
            train.id,
            TheOldPrincePhases.phases.find((phase) =>
                TheOldPrincePhases.rustTiming(phase.id, train.id)
            )?.id
        ])
    )
    expect(firstRustedIn).toEqual({
        '2H': '5H',
        '3H': '6H',
        '4H': '2+',
        '5H': '3+',
        '6H': '4+',
        '2+': '7',
        '3+': 'D',
        '4+': 'D',
        '7': undefined,
        D: undefined
    })
})

it('lets a company-owned 4+ that never ran survive until it next runs', () => {
    const players = ['a', 'b', 'c'].map((playerId) => ({ playerId, color: 'blue' as const }))
    const { position } = createTheOldPrinceOpening({
        players,
        prng: new Prng({ seed: 1, invocations: 0 }),
        config: {}
    })
    const state = { ...position, phaseId: 'D' }
    const owner = { kind: 'company', companyId: 'So' } as const
    const owned = (hasRun: boolean): Train => ({
        id: '4+:1',
        definitionId: '4+',
        status: 'owned',
        owner,
        hasRun
    })
    expect(TheOldPrincePhaseRules.rustTiming(state, owned(false))).toBe('after-operation')
    expect(TheOldPrincePhaseRules.rustTiming(state, owned(true))).toBe('immediate')
    expect(
        TheOldPrincePhaseRules.rustTiming(state, {
            id: '4+:2',
            definitionId: '4+',
            status: 'depot'
        })
    ).toBe('immediate')
})
