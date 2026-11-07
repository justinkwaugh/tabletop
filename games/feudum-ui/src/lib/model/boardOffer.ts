import {
    ActionType,
    MachineState,
    StartingSpaceIds,
    type HydratedFeudumGameState,
    type SpaceId
} from '@tabletop/feudum'

/** What a board layer can be asked about. Later picks add their element kinds here. */
export type BoardTarget = `space:${SpaceId}`

export function spaceTarget(spaceId: SpaceId): BoardTarget {
    return `space:${spaceId}`
}

export type BoardRole = 'lit' | 'picked' | 'being-decided' | 'dimmed' | 'plain'

export type ChipKind = 'cost' | 'threat' | 'role' | 'gain'
export type ChipTone = 'rose' | 'amber'

export interface ChipNote {
    readonly kind: ChipKind
    readonly label: string
}

export interface BoardChip extends ChipNote {
    readonly tone: ChipTone
}

/** Contract, Coexistence and precedence: a cost or threat wins over a role, a role over a gain. */
const ChipPrecedence: readonly ChipKind[] = ['cost', 'threat', 'role', 'gain']
const RoseChips: readonly ChipKind[] = ['cost', 'threat']

/** The one chip a target shows of everything a pick says about it. */
export function strongestChip(notes: readonly ChipNote[]): BoardChip | undefined {
    const note = notes.toSorted(
        (a, b) => ChipPrecedence.indexOf(a.kind) - ChipPrecedence.indexOf(b.kind)
    )[0]
    return note && { ...note, tone: RoseChips.includes(note.kind) ? 'rose' : 'amber' }
}

export interface PickTarget {
    readonly target: BoardTarget
    readonly notes?: readonly ChipNote[]
}

/** An open pick on the map: what one seat chooses among, in the displayed state. */
export interface MapPick {
    readonly action: ActionType
    readonly deciderId: string
    readonly targets: readonly PickTarget[]
    readonly picked: readonly BoardTarget[]
    /** Others and History View see the outline only where the choice is public. */
    readonly isPublic: boolean
}

/** The drafts' stages a pick reads. Each is read only while its flow applies. */
export interface BoardStages {
    readonly startingPawnSpace?: SpaceId
}

/** R-1.4.9 The six starting spaces, lit from the start since either order is allowed (S2). */
function startingPawnPick(
    state: HydratedFeudumGameState,
    stages: BoardStages
): MapPick | undefined {
    const deciderId = state.flow.setupOrder?.playerId
    if (!deciderId) {
        return undefined
    }
    return {
        action: ActionType.PlaceStartingPawn,
        deciderId,
        targets: StartingSpaceIds.map((spaceId) => ({ target: spaceTarget(spaceId) })),
        picked: stages.startingPawnSpace ? [spaceTarget(stages.startingPawnSpace)] : [],
        isPublic: true
    }
}

/** One row per machine state with a map pick; a later draft adds its row and its stages. */
const MapPicks: Partial<
    Record<
        MachineState,
        (state: HydratedFeudumGameState, stages: BoardStages) => MapPick | undefined
    >
> = {
    [MachineState.PlacingStartingPawn]: startingPawnPick
}

export function openMapPick(
    state: HydratedFeudumGameState,
    stages: BoardStages
): MapPick | undefined {
    return MapPicks[state.machineState]?.(state, stages)
}

export interface BoardTargetOffer {
    readonly role: BoardRole
    readonly chip?: BoardChip
}

export interface BoardOffer {
    readonly targets: ReadonlyMap<BoardTarget, BoardTargetOffer>
    /** A map pick is open for this seat, so everything it doesn't name dims. */
    readonly dimsRest: boolean
}

export const NoBoardOffer: BoardOffer = { targets: new Map(), dimsRest: false }

export function roleOf(offer: BoardOffer, target: BoardTarget): BoardRole {
    return offer.targets.get(target)?.role ?? (offer.dimsRest ? 'dimmed' : 'plain')
}

export function chipOf(offer: BoardOffer, target: BoardTarget): BoardChip | undefined {
    return offer.targets.get(target)?.chip
}

export interface BoardViewer {
    readonly viewerId?: string
    /** The displayed state's valid actions for this seat. */
    readonly validActions: readonly string[]
    readonly viewingHistory: boolean
    readonly updatingVisibleState: boolean
}

/** A pick as one viewer sees it (contract: Coexistence and precedence). Pure. */
export function offerOfPick(pick: MapPick | undefined, viewer: BoardViewer): BoardOffer {
    if (viewer.updatingVisibleState || !pick) {
        return NoBoardOffer
    }
    const isDecider = pick.deciderId === viewer.viewerId
    if (!viewer.viewingHistory && isDecider && viewer.validActions.includes(pick.action)) {
        return {
            targets: new Map(
                pick.targets.map(({ target, notes }) => {
                    const chip = strongestChip(notes ?? [])
                    const role: BoardRole = pick.picked.includes(target) ? 'picked' : 'lit'
                    return [target, { role, ...(chip ? { chip } : {}) }]
                })
            ),
            dimsRest: true
        }
    }
    if (!pick.isPublic || (isDecider && !viewer.viewingHistory)) {
        return NoBoardOffer
    }
    return {
        targets: new Map(pick.targets.map(({ target }) => [target, { role: 'being-decided' }])),
        dimsRest: false
    }
}

/** The board offer: derived, never stored, from the displayed state, valid actions and stages. */
export function deriveBoardOffer(
    state: HydratedFeudumGameState,
    stages: BoardStages,
    viewer: BoardViewer
): BoardOffer {
    return offerOfPick(openMapPick(state, stages), viewer)
}
