import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { AxialCoordinates } from '@tabletop/common'
import type { CompanyId, Placement } from '@tabletop/railheads'

// Laying track: the first company and its pieces, then, where the action allows a second
// company, that company and its pieces.
export type TrackSelectionValues = {
    firstCompany: CompanyId
    firstPiece1: Placement
    firstPiece2: Placement
    firstPiece3: Placement
    firstPiece4: Placement
    secondCompany: CompanyId
    secondPiece1: Placement
    secondPiece2: Placement
    secondPiece3: Placement
    secondPiece4: Placement
    // Off the Rails: an Industry Site picked, waiting for how it develops.
    boostHex: AxialCoordinates
}

export type TrackSelection = StagedSelectionState<TrackSelectionValues>

export const TrackStageOrder = [
    'firstCompany',
    'firstPiece1',
    'firstPiece2',
    'firstPiece3',
    'firstPiece4',
    'secondCompany',
    'secondPiece1',
    'secondPiece2',
    'secondPiece3',
    'secondPiece4',
    'boostHex'
] as const satisfies readonly (keyof TrackSelectionValues)[]
type MissingTrackStages = Exclude<keyof TrackSelectionValues, (typeof TrackStageOrder)[number]>
const trackCoverage: MissingTrackStages extends never ? true : never = true
void trackCoverage

export type CompanySlot = 'first' | 'second'

const PIECE_STAGES = {
    first: ['firstPiece1', 'firstPiece2', 'firstPiece3', 'firstPiece4'],
    second: ['secondPiece1', 'secondPiece2', 'secondPiece3', 'secondPiece4']
} as const

const COMPANY_STAGES = { first: 'firstCompany', second: 'secondCompany' } as const

export const MAX_PIECES_PER_COMPANY = PIECE_STAGES.first.length

export function selectCompany(
    selection: TrackSelection,
    slot: CompanySlot,
    companyId: CompanyId
): TrackSelection {
    return setStagedSelectionValue<TrackSelectionValues, (typeof COMPANY_STAGES)[CompanySlot]>(
        selection,
        TrackStageOrder,
        COMPANY_STAGES[slot],
        companyId,
        'manual'
    )
}

export function selectedCompany(
    selection: TrackSelection,
    slot: CompanySlot
): CompanyId | undefined {
    return selection[COMPANY_STAGES[slot]]?.value
}

export function piecesOf(selection: TrackSelection, slot: CompanySlot): Placement[] {
    return PIECE_STAGES[slot].flatMap((stage) => {
        const entry = selection[stage]
        return entry ? [entry.value] : []
    })
}

export function stagedPlacements(selection: TrackSelection): Placement[] {
    return [...piecesOf(selection, 'first'), ...piecesOf(selection, 'second')]
}

export function addPiece(
    selection: TrackSelection,
    slot: CompanySlot,
    placement: Placement
): TrackSelection {
    const stage = PIECE_STAGES[slot][piecesOf(selection, slot).length]
    return setStagedSelectionValue<TrackSelectionValues, typeof stage>(
        selection,
        TrackStageOrder,
        stage,
        placement,
        'manual'
    )
}

export function pickBoostHex(selection: TrackSelection, coords: AxialCoordinates): TrackSelection {
    return setStagedSelectionValue<TrackSelectionValues, 'boostHex'>(
        selection,
        TrackStageOrder,
        'boostHex',
        coords,
        'manual'
    )
}

export function clearBoostHex(selection: TrackSelection): TrackSelection {
    return clearStagedSelectionAtOrAfter<TrackSelectionValues, 'boostHex'>(
        selection,
        TrackStageOrder,
        'boostHex'
    )
}

export function hasManualTrackSelection(selection: TrackSelection): boolean {
    return hasManualStagedSelection<TrackSelectionValues>(selection, TrackStageOrder)
}

export function popTrackSelection(selection: TrackSelection): TrackSelection {
    return popHighestManualStagedSelection<TrackSelectionValues>(selection, TrackStageOrder)
        .nextState
}

export type IssueSelectionValues = { company: CompanyId }

export type IssueSelection = StagedSelectionState<IssueSelectionValues>

export const IssueStageOrder = [
    'company'
] as const satisfies readonly (keyof IssueSelectionValues)[]

export function selectIssueCompany(
    selection: IssueSelection,
    companyId: CompanyId
): IssueSelection {
    return setStagedSelectionValue<IssueSelectionValues, 'company'>(
        selection,
        IssueStageOrder,
        'company',
        companyId,
        'manual'
    )
}

export function hasManualIssueSelection(selection: IssueSelection): boolean {
    return hasManualStagedSelection<IssueSelectionValues>(selection, IssueStageOrder)
}

export function popIssueSelection(selection: IssueSelection): IssueSelection {
    return popHighestManualStagedSelection<IssueSelectionValues>(selection, IssueStageOrder)
        .nextState
}
