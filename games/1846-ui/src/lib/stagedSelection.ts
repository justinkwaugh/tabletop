import type { TrackRequest } from '@tabletop/18xx'
import type { ConstructionPrivateId } from '@tabletop/1846'
import { setStagedSelectionValue, type StagedSelectionState } from '@tabletop/frontend-components'

type StageOrder<Values extends Record<string, unknown>> = readonly Extract<keyof Values, string>[]

/** The Steamboat's railroad, chosen before its port is picked on the map. */
export type SteamboatSelectionValues = { company: string }
export type SteamboatSelection = StagedSelectionState<SteamboatSelectionValues>
export const SteamboatStageOrder = [
    'company'
] as const satisfies StageOrder<SteamboatSelectionValues>

/** A private construction power's first lay, held until its combined action is submitted. */
export type PrivateLayValues = {
    firstLay: { privateCompanyId: ConstructionPrivateId; request: TrackRequest }
}
export type PrivateLaySelection = StagedSelectionState<PrivateLayValues>
export const PrivateLayStageOrder = ['firstLay'] as const satisfies StageOrder<PrivateLayValues>

export function chooseSteamboatCompany(
    selection: SteamboatSelection,
    companyId: string
): SteamboatSelection {
    return setStagedSelectionValue<SteamboatSelectionValues, 'company'>(
        selection,
        SteamboatStageOrder,
        'company',
        companyId,
        'manual'
    )
}

export function stagePrivateLay(
    selection: PrivateLaySelection,
    privateCompanyId: ConstructionPrivateId,
    request: TrackRequest
): PrivateLaySelection {
    return setStagedSelectionValue<PrivateLayValues, 'firstLay'>(
        selection,
        PrivateLayStageOrder,
        'firstLay',
        { privateCompanyId, request },
        'manual'
    )
}

export function stagedPrivateLays(
    selection: PrivateLaySelection,
    privateCompanyId: ConstructionPrivateId
): TrackRequest[] {
    const staged = selection.firstLay?.value
    return staged?.privateCompanyId === privateCompanyId ? [staged.request] : []
}
