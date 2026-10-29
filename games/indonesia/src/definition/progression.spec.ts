import { assertExists, GameProgress, reportGameProgress } from '@tabletop/common'
import * as Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { Deeds } from '../components/deed.js'
import type { IndonesiaGameState } from '../model/gameState.js'
import { createGame, engine, placeNewEraCities } from '../utils/testGame.js'
import { CompanyType } from './companyType.js'
import { Era } from './eras.js'
import { Good } from './goods.js'
import { IndonesiaRuntime } from './runtime.js'
import { MachineState } from './states.js'

function eraDeeds(era: Era) {
    return structuredClone(Deeds.filter((deed) => deed.era === era))
}

function report(state: IndonesiaGameState): GameProgress {
    const progress = reportGameProgress(IndonesiaRuntime, state)
    assertExists(progress, 'Indonesia reports Game Progress')
    expect(Value.Check(GameProgress, progress)).toBe(true)
    return progress
}

describe.each([3, 4, 5])('Indonesia Game Progress with %i players', (count) => {
    const game = createGame(count)
    const initialState = engine.startGame(game).initialState
    const year = placeNewEraCities(game, initialState)

    it('starts at Era A with every Era A deed left', () => {
        expect(report(initialState)).toEqual({ fraction: 0, label: 'Era A · 8 deeds left' })
        expect(year.machineState).toBe(MachineState.BiddingForTurnOrder)
        expect(report(year)).toEqual({ fraction: 0, label: 'Era A · 8 deeds left' })
    })

    it('counts the current era deeds used towards the next era', () => {
        expect(report({ ...year, availableDeeds: eraDeeds(Era.A).slice(3) })).toEqual({
            fraction: 0.125,
            label: 'Era A · 5 deeds left'
        })
        expect(report({ ...year, availableDeeds: eraDeeds(Era.A).slice(7) })).toEqual({
            fraction: 0.292,
            label: 'Era A · 1 deed left'
        })
    })

    it('counts a new era as unused until its deeds are placed', () => {
        const leftover = eraDeeds(Era.A).slice(7)
        expect(
            report({
                ...year,
                era: Era.B,
                machineState: MachineState.NewEra,
                availableDeeds: leftover
            })
        ).toEqual({ fraction: 0.333, label: 'Era B · 9 deeds left' })
        expect(
            report({
                ...year,
                era: Era.B,
                availableDeeds: [...leftover, ...eraDeeds(Era.B).slice(3)]
            })
        ).toEqual({ fraction: 0.444, label: 'Era B · 6 deeds left' })
        expect(
            report({
                ...year,
                era: Era.C,
                machineState: MachineState.NewEra,
                availableDeeds: eraDeeds(Era.B).filter(
                    (deed) => deed.type === CompanyType.Production && deed.good === Good.Rice
                )
            })
        ).toEqual({ fraction: 0.667, label: 'Era C · 7 deeds left' })
        expect(report({ ...year, era: Era.C, availableDeeds: eraDeeds(Era.C) })).toEqual({
            fraction: 0.667,
            label: 'Era C · 7 deeds left'
        })
    })

    it('marks the last operations once Era C can no longer continue', () => {
        const oilDeeds = eraDeeds(Era.C).filter(
            (deed) => deed.type === CompanyType.Production && deed.good === Good.Oil
        )
        expect(report({ ...year, era: Era.C, availableDeeds: oilDeeds })).toEqual({
            fraction: 0.81,
            label: 'Era C · last operations',
            final: true
        })
        expect(
            report({
                ...year,
                era: Era.C,
                machineState: MachineState.EndOfGame,
                availableDeeds: []
            })
        ).toEqual({ fraction: 1, label: 'Era C · last operations', final: true })
        expect(report({ ...year, era: Era.B, availableDeeds: [] })).toEqual({
            fraction: 0.667,
            label: 'Era B · 0 deeds left'
        })
    })
})
