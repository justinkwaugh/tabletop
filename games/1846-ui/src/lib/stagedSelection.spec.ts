import { describe, expect, it } from 'vitest'
import {
    setStagedSelectionValue,
    undoableStagedSelection,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { TrackRequest } from '@tabletop/18xx'
import {
    PrivateLayStageOrder,
    SteamboatStageOrder,
    chooseSteamboatCompany,
    stagePrivateLay,
    stagedPrivateLays,
    type PrivateLaySelection,
    type PrivateLayValues,
    type SteamboatSelection,
    type SteamboatSelectionValues
} from './stagedSelection.js'

const lay = (locationId: string): TrackRequest => ({
    companyId: 'NYC',
    locationId,
    definitionId: '18xx:7',
    rotation: 0,
    nodeMapping: {}
})

function held<Values extends Record<string, unknown>>(
    order: readonly Extract<keyof Values, string>[],
    initial: StagedSelectionState<Values>
) {
    let selection = initial
    const local = undoableStagedSelection<Values>(
        order,
        () => selection,
        (next) => (selection = next)
    )
    return { local, current: () => selection }
}

describe('1846 Steamboat selection', () => {
    it('replaces the railroad when another is chosen', () => {
        const first = chooseSteamboatCompany({}, 'NYC')
        expect(chooseSteamboatCompany(first, 'B&O').company?.value).toBe('B&O')
    })

    it('pops the chosen railroad on Undo without reaching for an action', () => {
        const { local, current } = held<SteamboatSelectionValues>(
            SteamboatStageOrder,
            chooseSteamboatCompany({}, 'NYC')
        )
        expect(local.hasManual()).toBe(true)
        expect(local.undo()).toBe(true)
        expect(current()).toEqual({})
    })

    it('leaves Undo to the last action when nothing manual is staged', () => {
        const automatic: SteamboatSelection = setStagedSelectionValue<
            SteamboatSelectionValues,
            'company'
        >({}, SteamboatStageOrder, 'company', 'NYC', 'auto')
        const { local, current } = held<SteamboatSelectionValues>(SteamboatStageOrder, automatic)
        expect(local.hasManual()).toBe(false)
        expect(local.undo()).toBe(false)
        expect(current()).toBe(automatic)
        expect(held<SteamboatSelectionValues>(SteamboatStageOrder, {}).local.undo()).toBe(false)
    })

    it('throws for a stage outside its stage order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, string>, string>(
                {},
                SteamboatStageOrder,
                'port',
                'D20',
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })
})

describe('1846 private construction lay', () => {
    it('stages a first lay for its power only', () => {
        const staged = stagePrivateLay({}, 'MC', lay('F14'))
        expect(stagedPrivateLays(staged, 'MC')).toEqual([lay('F14')])
        expect(stagedPrivateLays(staged, 'O&I')).toEqual([])
    })

    it('replaces the staged lay when the first lay is chosen again', () => {
        const staged = stagePrivateLay(stagePrivateLay({}, 'MC', lay('F14')), 'O&I', lay('G15'))
        expect(stagedPrivateLays(staged, 'MC')).toEqual([])
        expect(stagedPrivateLays(staged, 'O&I')).toEqual([lay('G15')])
    })

    it('pops the staged lay on Undo, then leaves Undo to the last action', () => {
        const { local, current } = held<PrivateLayValues>(
            PrivateLayStageOrder,
            stagePrivateLay({}, 'MC', lay('F14'))
        )
        expect(local.undo()).toBe(true)
        expect(current()).toEqual({})
        expect(local.undo()).toBe(false)
    })

    it('clears the staged lay', () => {
        const { local, current } = held<PrivateLayValues>(
            PrivateLayStageOrder,
            stagePrivateLay({}, 'LM', lay('H12'))
        )
        local.clear()
        const cleared: PrivateLaySelection = current()
        expect(cleared).toEqual({})
        expect(local.hasManual()).toBe(false)
    })
})
