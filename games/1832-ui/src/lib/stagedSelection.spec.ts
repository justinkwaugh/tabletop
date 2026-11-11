import { describe, expect, it } from 'vitest'
import {
    setStagedSelectionValue,
    undoableStagedSelection,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import {
    MergedDiscardStageOrder,
    MergerStageOrder,
    stageMergerCompany,
    stageMergerPartner,
    stageSystemPresidency,
    stagedMergerChoices,
    toggleMergedDiscard,
    type MergedDiscardValues,
    type MergerSelection,
    type MergerSelectionValues
} from './stagedSelection.js'

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

/** ACL with CG, the other president leading the System. */
const chosen: MergerSelection = stageSystemPresidency(
    stageMergerPartner(stageMergerCompany({}, 'ACL', undefined), 'CG', undefined),
    true
)

describe('1832 merger selection', () => {
    it('clears the partner and presidency when another company is chosen', () => {
        expect(stagedMergerChoices(stageMergerCompany(chosen, 'GRR', 'ACL'))).toEqual({
            companyId: 'GRR',
            partnerId: undefined,
            yielded: false
        })
    })

    it('clears the presidency when another partner is chosen', () => {
        expect(stagedMergerChoices(stageMergerPartner(chosen, 'LN', 'CG'))).toEqual({
            companyId: 'ACL',
            partnerId: 'LN',
            yielded: false
        })
    })

    it('records nothing when the company or partner shown is chosen again', () => {
        expect(stageMergerCompany(chosen, 'ACL', 'ACL')).toBe(chosen)
        expect(stageMergerPartner(chosen, 'CG', 'CG')).toBe(chosen)
        // The only company, shown without a choice, records nothing either.
        expect(stageMergerCompany({}, 'ACL', 'ACL')).toEqual({})
    })

    it('stages only a yielded presidency, so keeping one’s own clears it', () => {
        expect(stagedMergerChoices(chosen).yielded).toBe(true)
        expect(stagedMergerChoices(stageSystemPresidency(chosen, false))).toEqual({
            companyId: 'ACL',
            partnerId: 'CG',
            yielded: false
        })
    })

    it('pops the presidency, then the partner, then the company on Undo', () => {
        const { local, current } = held<MergerSelectionValues>(MergerStageOrder, chosen)
        expect(local.undo()).toBe(true)
        expect(stagedMergerChoices(current())).toEqual({
            companyId: 'ACL',
            partnerId: 'CG',
            yielded: false
        })
        expect(local.undo()).toBe(true)
        expect(stagedMergerChoices(current()).partnerId).toBeUndefined()
        expect(local.undo()).toBe(true)
        expect(current()).toEqual({})
        expect(local.hasManual()).toBe(false)
        expect(local.undo()).toBe(false)
    })

    it('leaves Undo to the last action when the choices were made for the player', () => {
        const automatic = setStagedSelectionValue<MergerSelectionValues, 'company'>(
            {},
            MergerStageOrder,
            'company',
            'ACL',
            'auto'
        )
        const { local, current } = held<MergerSelectionValues>(MergerStageOrder, automatic)
        expect(local.hasManual()).toBe(false)
        expect(local.undo()).toBe(false)
        expect(current()).toBe(automatic)
    })

    it('throws for a stage outside its stage order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, string>, string>(
                {},
                MergerStageOrder,
                'outcome',
                'takeover',
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })
})

describe('1832 merged train discard selection', () => {
    it('replaces the chosen kind, and clears it when chosen again', () => {
        const fours = toggleMergedDiscard({}, '4')
        expect(toggleMergedDiscard(fours, '5').kind?.value).toBe('5')
        expect(toggleMergedDiscard(fours, '4')).toEqual({})
    })

    it('pops the chosen kind on Undo, then leaves Undo to the last action', () => {
        const { local, current } = held<MergedDiscardValues>(
            MergedDiscardStageOrder,
            toggleMergedDiscard({}, '4')
        )
        expect(local.undo()).toBe(true)
        expect(current()).toEqual({})
        expect(local.undo()).toBe(false)
    })

    it('throws for a stage outside its stage order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, string>, string>(
                {},
                MergedDiscardStageOrder,
                'train',
                '4:1',
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })
})
