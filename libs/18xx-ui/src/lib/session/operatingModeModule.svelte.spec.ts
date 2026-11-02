import { describe, expect, it } from 'vitest'
import { minimalPlayState } from '@tabletop/18xx/testing'
import type { FinanceChoice } from '@tabletop/18xx'
import type { StagedSelectionEntry } from '@tabletop/frontend-components'
import type { PrivateTrackPower } from './privateActionsModule.svelte.js'
import {
    OperatingModeModule,
    type OperatingModeSession,
    type TitleOperatingMode
} from './operatingModeModule.svelte.js'
import { testSession } from './moduleTestSession.js'

const issue: FinanceChoice = { companyId: 'A', operation: 'issue', shares: 1, amount: 10 }

function operating(
    machineState: string,
    initialValid: string[],
    rules: OperatingModeSession['rules'] = { stationsWithTrack: true },
    financeChoices: readonly FinanceChoice[] = []
) {
    let valid = $state(initialValid)
    let trackPowerSelection = $state<StagedSelectionEntry<PrivateTrackPower>>()
    let titleModes = $state<readonly TitleOperatingMode[]>([])
    const state: OperatingModeSession['state'] = { ...minimalPlayState(), machineState }
    const harness = testSession(state, rules, [])
    const session: OperatingModeSession = {
        ...harness.session,
        get validActionTypes() {
            return valid
        }
    }
    let cleared = 0
    let finished = 0
    const module = new OperatingModeModule(
        session,
        {
            choices: financeChoices,
            modeLabel: { label: 'Issue shares', shortLabel: 'Issue' }
        },
        {
            titlePower: undefined,
            selection: undefined,
            get trackPowerSelection() {
                return trackPowerSelection
            }
        },
        { selection: undefined },
        {
            clearSelections: () => cleared++,
            finishTrack: async () => {
                finished++
            }
        },
        () => titleModes
    )
    return {
        module,
        setValid: (types: string[]) => (valid = types),
        setTitleModes: (modes: readonly TitleOperatingMode[]) => (titleModes = modes),
        selectTrackPower: (power: PrivateTrackPower) =>
            (trackPowerSelection = { value: power, source: 'manual' }),
        cleared: () => cleared,
        finished: () => finished
    }
}

describe('OperatingModeModule', () => {
    it('stays out of the way of titles with separate steps and no share issues', () => {
        const { module } = operating('PlacingStation', ['PlaceStation'], {})
        expect(module.enabled).toBe(false)
        expect(module.switchVisible).toBe(false)
        expect(module.trackActive).toBe(true)
        expect(module.stationsActive).toBe(true)
        expect(module.completion).toBeUndefined()
    })

    it('offers track and stations in a combined step and keeps the chosen mode', () => {
        const { module, cleared } = operating('LayingTrack', [
            'LayTile',
            'PlaceStation',
            'FinishTrack'
        ])
        expect(module.mode).toBe('track')
        expect(module.options.map((option) => option.label)).toEqual(['Lay track', 'Place station'])
        expect(module.switchVisible).toBe(true)
        expect(module.trackActive).toBe(true)
        expect(module.stationsActive).toBe(false)
        module.options[1].choose()
        expect(module.mode).toBe('stations')
        expect(cleared()).toBe(1)
        expect(module.trackActive).toBe(false)
        expect(module.stationsActive).toBe(true)
        expect(module.stationsShown).toBe(true)
    })

    it('falls back to the derived mode when the chosen one is no longer available', () => {
        const { module, setValid } = operating('LayingTrack', [
            'LayTile',
            'PlaceStation',
            'FinishTrack'
        ])
        module.choose('stations')
        setValid(['LayTile', 'FinishTrack'])
        expect(module.mode).toBe('track')
        expect(module.switchVisible).toBe(false)
    })

    it('selects share issues when they are all that is left to build', () => {
        const { module } = operating(
            'LayingTrack',
            ['FinishTrack', 'CorporateFinance'],
            { stationsWithTrack: true },
            [issue]
        )
        expect(module.mode).toBe('finance')
        expect(module.financeShown).toBe(true)
        expect(module.switchVisible).toBe(true)
        expect(module.nothingToBuild).toBe(false)
    })

    it('reports nothing to build when only finishing remains', () => {
        const { module } = operating('LayingTrack', ['FinishTrack'])
        expect(module.mode).toBe('stations')
        expect(module.stationsShown).toBe(true)
        expect(module.nothingToBuild).toBe(true)
    })

    it('sets share issues beside the run before routes are run', () => {
        const { module } = operating(
            'RunningTrains',
            ['RunTrains', 'CorporateFinance'],
            { stationsWithTrack: true },
            [issue]
        )
        expect(module.options.map((option) => [option.label, option.selected])).toEqual([
            ['Run trains', true],
            ['Issue shares', false]
        ])
        module.options[1].choose()
        expect(module.mode).toBe('finance')
        module.options[0].choose()
        expect(module.mode).not.toBe('finance')
    })

    it('sets a title mode between construction and share issues', () => {
        const { module, setTitleModes } = operating(
            'LayingTrack',
            ['LayTile', 'FinishTrack', 'CorporateFinance'],
            { stationsWithTrack: true },
            [issue]
        )
        setTitleModes([{ id: 'ferries', label: 'Buy ferry', shortLabel: 'Ferry' }])
        expect(module.options.map((option) => [option.label, option.selected])).toEqual([
            ['Lay track', true],
            ['Buy ferry', false],
            ['Issue shares', false]
        ])
        expect(module.titleModeShown).toBeUndefined()
        module.options[1].choose()
        expect(module.mode).toEqual({ titleModeId: 'ferries' })
        expect(module.titleModeShown).toBe('ferries')
        expect(module.trackActive).toBe(false)
        setTitleModes([])
        expect(module.mode).toBe('track')
        expect(module.titleModeShown).toBeUndefined()
    })

    it('shows a title mode alone when nothing else is left to build', () => {
        const { module, setTitleModes } = operating('LayingTrack', ['FinishTrack'])
        setTitleModes([{ id: 'ferries', label: 'Buy ferry', shortLabel: 'Ferry' }])
        expect(module.mode).toEqual({ titleModeId: 'ferries' })
        expect(module.titleModeShown).toBe('ferries')
        expect(module.switchVisible).toBe(true)
        expect(module.nothingToBuild).toBe(false)
        expect(module.constructionOpen).toBe(true)
    })

    it('sets a title mode beside the run', () => {
        const { module, setTitleModes } = operating('RunningTrains', ['RunTrains'])
        setTitleModes([{ id: 'ferries', label: 'Luxury ferry', shortLabel: 'Luxury' }])
        expect(module.options.map((option) => [option.label, option.selected])).toEqual([
            ['Run trains', true],
            ['Luxury ferry', false]
        ])
        expect(module.canChoose).toBe(true)
        module.options[1].choose()
        expect(module.titleModeShown).toBe('ferries')
        module.options[0].choose()
        expect(module.titleModeShown).toBeUndefined()
    })

    it('lays a selected private tile power through track', () => {
        const { module, selectTrackPower } = operating(
            'LayingTrack',
            ['PlaceStation', 'FinishTrack', 'CorporateFinance'],
            { stationsWithTrack: true },
            [issue]
        )
        expect(module.mode).toBe('stations')
        selectTrackPower({ privateCompanyId: 'P', playerId: 'alex' })
        expect(module.mode).toBe('track')
        expect(module.trackActive).toBe(true)
        expect(module.financeShown).toBe(false)
    })

    it('finishes a combined step through its track and skips to the run', async () => {
        const { module, finished } = operating('LayingTrack', ['LayTile', 'FinishTrack'])
        expect(module.completion?.lastTarget).toBe(1)
        await module.completion?.finish()
        expect(finished()).toBe(1)
    })
})
