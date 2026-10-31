import type { RailroadId } from '@tabletop/promontory-point'
import {
    getStagedSelectionEntry,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionSource,
    type StagedSelectionState
} from '@tabletop/frontend-components'

// The hex stage is never stored: a press on a lit hex sends PlaceTrack.
export type TurnDraftValues = {
    piece: RailroadId
}

export type TurnDraft = StagedSelectionState<TurnDraftValues>

export type PiecePick = {
    railroadId: RailroadId
    source: StagedSelectionSource
}

const STAGE_ORDER = ['piece'] as const satisfies readonly (keyof TurnDraftValues)[]
type MissingStages = Exclude<keyof TurnDraftValues, (typeof STAGE_ORDER)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function emptyTurnDraft(): TurnDraft {
    return {}
}

export function draftPiece(draft: TurnDraft): RailroadId | undefined {
    return getStagedSelectionEntry<TurnDraftValues, 'piece'>(draft, 'piece')?.value
}

// O-2: a press picks a piece, a second press on it unpicks it, a press on another switches.
export function pressPiece(draft: TurnDraft, railroadId: RailroadId): TurnDraft {
    if (draftPiece(draft) === railroadId) {
        return emptyTurnDraft()
    }
    return setStagedSelectionValue<TurnDraftValues, 'piece'>(
        draft,
        STAGE_ORDER,
        'piece',
        railroadId,
        'manual'
    )
}

export function hasManualTurnDraft(draft: TurnDraft): boolean {
    return hasManualStagedSelection<TurnDraftValues>(draft, STAGE_ORDER)
}

export function popTurnDraft(draft: TurnDraft): TurnDraft {
    return popHighestManualStagedSelection<TurnDraftValues>(draft, STAGE_ORDER).nextState
}

// O-2: the manual pick while it is still pickable, else the lone railroad left in hand (auto).
export function piecePick(
    draft: TurnDraft,
    pickable: readonly RailroadId[],
    handPieces: readonly RailroadId[]
): PiecePick | undefined {
    const picked = draftPiece(draft)
    if (picked !== undefined && pickable.includes(picked)) {
        return { railroadId: picked, source: 'manual' }
    }
    const lone = loneRailroad(handPieces)
    return lone !== undefined && pickable.includes(lone)
        ? { railroadId: lone, source: 'auto' }
        : undefined
}

function loneRailroad(handPieces: readonly RailroadId[]): RailroadId | undefined {
    const railroads = new Set(handPieces)
    return railroads.size === 1 ? handPieces[0] : undefined
}
