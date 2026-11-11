import {
    clearStagedSelectionAtOrAfter,
    getStagedSelectionValue,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

type StageOrder<Values extends Record<string, unknown>> = readonly Extract<keyof Values, string>[]

/**
 * A merger being proposed: the player's company, then the company to merge it with, then, for a
 * System either president could lead, the other president's presidency.
 */
export type MergerSelectionValues = { company: string; partner: string; presidency: 'yielded' }
export type MergerSelection = StagedSelectionState<MergerSelectionValues>
export const MergerStageOrder = [
    'company',
    'partner',
    'presidency'
] as const satisfies StageOrder<MergerSelectionValues>

/** The merger choices made so far. */
export function stagedMergerChoices(selection: MergerSelection) {
    return {
        companyId: getStagedSelectionValue<MergerSelectionValues, 'company'>(selection, 'company'),
        partnerId: getStagedSelectionValue<MergerSelectionValues, 'partner'>(selection, 'partner'),
        yielded:
            getStagedSelectionValue<MergerSelectionValues, 'presidency'>(
                selection,
                'presidency'
            ) === 'yielded'
    }
}

// Choosing what is already shown, even the only choice made for the player, records nothing for
// Undo to pop; choosing anew clears the later stages.
export function stageMergerCompany(
    selection: MergerSelection,
    companyId: string,
    shownCompanyId: string | undefined
): MergerSelection {
    return companyId === shownCompanyId
        ? selection
        : setStagedSelectionValue<MergerSelectionValues, 'company'>(
              selection,
              MergerStageOrder,
              'company',
              companyId,
              'manual'
          )
}

export function stageMergerPartner(
    selection: MergerSelection,
    partnerId: string,
    shownPartnerId: string | undefined
): MergerSelection {
    return partnerId === shownPartnerId
        ? selection
        : setStagedSelectionValue<MergerSelectionValues, 'partner'>(
              selection,
              MergerStageOrder,
              'partner',
              partnerId,
              'manual'
          )
}

/** The proposer's own presidency is the default; only yielding it is a stage to undo. */
export function stageSystemPresidency(
    selection: MergerSelection,
    yielded: boolean
): MergerSelection {
    return yielded
        ? setStagedSelectionValue<MergerSelectionValues, 'presidency'>(
              selection,
              MergerStageOrder,
              'presidency',
              'yielded',
              'manual'
          )
        : clearStagedSelectionAtOrAfter(selection, MergerStageOrder, 'presidency')
}

/** The kind of train a company over its limit after a takeover is to discard. */
export type MergedDiscardValues = { kind: string }
export type MergedDiscardSelection = StagedSelectionState<MergedDiscardValues>
export const MergedDiscardStageOrder = ['kind'] as const satisfies StageOrder<MergedDiscardValues>

/** Choosing the chosen kind again clears the choice. */
export function toggleMergedDiscard(
    selection: MergedDiscardSelection,
    definitionId: string
): MergedDiscardSelection {
    return getStagedSelectionValue<MergedDiscardValues, 'kind'>(selection, 'kind') === definitionId
        ? clearStagedSelectionAtOrAfter(selection, MergedDiscardStageOrder, 'kind')
        : setStagedSelectionValue<MergedDiscardValues, 'kind'>(
              selection,
              MergedDiscardStageOrder,
              'kind',
              definitionId,
              'manual'
          )
}
