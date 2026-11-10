import {
    getStagedSelectionValue,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

// Each card chosen to lay away is its own stage, so Undo takes back the latest one. Sechserdreier
// lays away six.
export type LayAwaySelectionValues = {
    first: string
    second: string
    third: string
    fourth: string
    fifth: string
    sixth: string
}

export type LayAwaySelection = StagedSelectionState<LayAwaySelectionValues>

export const LayAwayStageOrder = [
    'first',
    'second',
    'third',
    'fourth',
    'fifth',
    'sixth'
] as const satisfies readonly (keyof LayAwaySelectionValues)[]
type MissingStages = Exclude<keyof LayAwaySelectionValues, (typeof LayAwayStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function chosenToLayAway(selection: LayAwaySelection): string[] {
    return LayAwayStageOrder.flatMap((stage) => {
        const cardId = getStagedSelectionValue<LayAwaySelectionValues, typeof stage>(
            selection,
            stage
        )
        return cardId === undefined ? [] : [cardId]
    })
}

function selectionOf(cardIds: readonly string[]): LayAwaySelection {
    return cardIds.reduce<LayAwaySelection>((selection, cardId, index) => {
        const stage = LayAwayStageOrder[index]
        if (stage === undefined) {
            throw new Error(`Cannot lay away more than ${LayAwayStageOrder.length} cards`)
        }
        return setStagedSelectionValue<LayAwaySelectionValues, typeof stage>(
            selection,
            LayAwayStageOrder,
            stage,
            cardId,
            'manual'
        )
    }, {})
}

// Choosing a chosen card again takes it back out.
export function toggleLayAway(selection: LayAwaySelection, cardId: string): LayAwaySelection {
    const chosen = chosenToLayAway(selection)
    return selectionOf(
        chosen.includes(cardId) ? chosen.filter((other) => other !== cardId) : [...chosen, cardId]
    )
}

export function hasManualLayAwaySelection(selection: LayAwaySelection): boolean {
    return hasManualStagedSelection<LayAwaySelectionValues>(selection, LayAwayStageOrder)
}

export function popLayAwaySelection(selection: LayAwaySelection): LayAwaySelection {
    return popHighestManualStagedSelection<LayAwaySelectionValues>(selection, LayAwayStageOrder)
        .nextState
}

// Playing a card takes two clicks: the first picks it, the second on the same card plays it.
export type PlaySelectionValues = { card: string }

export type PlaySelection = StagedSelectionState<PlaySelectionValues>

const PlayStageOrder = ['card'] as const satisfies readonly (keyof PlaySelectionValues)[]

export function pickedToPlay(selection: PlaySelection): string | undefined {
    return getStagedSelectionValue<PlaySelectionValues, 'card'>(selection, 'card')
}

export function pickToPlay(cardId: string): PlaySelection {
    return setStagedSelectionValue<PlaySelectionValues, 'card'>(
        {},
        PlayStageOrder,
        'card',
        cardId,
        'manual'
    )
}

export function hasManualPlaySelection(selection: PlaySelection): boolean {
    return hasManualStagedSelection<PlaySelectionValues>(selection, PlayStageOrder)
}

export function popPlaySelection(selection: PlaySelection): PlaySelection {
    return popHighestManualStagedSelection<PlaySelectionValues>(selection, PlayStageOrder).nextState
}

// Each bonus or Kontra chosen in the announcements is its own stage, so Undo takes back the latest.
export type AnnouncementSelectionValues = Record<string, string>

export type AnnouncementSelection = StagedSelectionState<AnnouncementSelectionValues>

const AnnouncementStageOrder: readonly string[] = Array.from(
    { length: 32 },
    (_, index) => `choice${index + 1}`
)

export function chosenAnnouncements(selection: AnnouncementSelection): string[] {
    return AnnouncementStageOrder.flatMap((stage) => {
        const key = getStagedSelectionValue<AnnouncementSelectionValues, string>(selection, stage)
        return key === undefined ? [] : [key]
    })
}

export function toggleAnnouncement(
    selection: AnnouncementSelection,
    key: string
): AnnouncementSelection {
    const chosen = chosenAnnouncements(selection)
    const next = chosen.includes(key) ? chosen.filter((other) => other !== key) : [...chosen, key]
    return next.reduce<AnnouncementSelection>(
        (built, choice, index) =>
            setStagedSelectionValue<AnnouncementSelectionValues, string>(
                built,
                AnnouncementStageOrder,
                AnnouncementStageOrder[index],
                choice,
                'manual'
            ),
        {}
    )
}

export function hasManualAnnouncementSelection(selection: AnnouncementSelection): boolean {
    return hasManualStagedSelection<AnnouncementSelectionValues>(selection, AnnouncementStageOrder)
}

export function popAnnouncementSelection(selection: AnnouncementSelection): AnnouncementSelection {
    return popHighestManualStagedSelection<AnnouncementSelectionValues>(
        selection,
        AnnouncementStageOrder
    ).nextState
}
