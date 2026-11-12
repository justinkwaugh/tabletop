import {
    getStagedSelectionValue,
    pushStagedSelectionValue,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

// A choice of any of several items, in any order: each press pushes the whole list again onto one
// stacked stage, so Undo takes back the latest press, whether it chose an item or took one out.
function toggled(chosen: readonly string[], item: string): string[] {
    return chosen.includes(item) ? chosen.filter((other) => other !== item) : [...chosen, item]
}

// The cards chosen to lay away.
export type LayAwaySelectionValues = { cards: string[] }

export type LayAwaySelection = StagedSelectionState<LayAwaySelectionValues>

export const LayAwayStageOrder = [
    'cards'
] as const satisfies readonly (keyof LayAwaySelectionValues)[]
type MissingLayAwayStages = Exclude<
    keyof LayAwaySelectionValues,
    (typeof LayAwayStageOrder)[number]
>
const layAwayCoverage: MissingLayAwayStages extends never ? true : never = true
void layAwayCoverage

export function chosenToLayAway(selection: LayAwaySelection): string[] {
    return getStagedSelectionValue<LayAwaySelectionValues, 'cards'>(selection, 'cards') ?? []
}

// Choosing a chosen card again takes it back out.
export function toggleLayAway(selection: LayAwaySelection, cardId: string): LayAwaySelection {
    return pushStagedSelectionValue<LayAwaySelectionValues, 'cards'>(
        selection,
        LayAwayStageOrder,
        'cards',
        toggled(chosenToLayAway(selection), cardId)
    )
}

// Playing a card takes two clicks: the first picks it, the second on the same card plays it.
export type PlaySelectionValues = { card: string }

export type PlaySelection = StagedSelectionState<PlaySelectionValues>

export const PlayStageOrder = ['card'] as const satisfies readonly (keyof PlaySelectionValues)[]

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

// The bonuses and Kontras chosen in the announcements, by key.
export type AnnouncementSelectionValues = { choices: string[] }

export type AnnouncementSelection = StagedSelectionState<AnnouncementSelectionValues>

export const AnnouncementStageOrder = [
    'choices'
] as const satisfies readonly (keyof AnnouncementSelectionValues)[]
type MissingAnnouncementStages = Exclude<
    keyof AnnouncementSelectionValues,
    (typeof AnnouncementStageOrder)[number]
>
const announcementCoverage: MissingAnnouncementStages extends never ? true : never = true
void announcementCoverage

export function chosenAnnouncements(selection: AnnouncementSelection): string[] {
    return (
        getStagedSelectionValue<AnnouncementSelectionValues, 'choices'>(selection, 'choices') ?? []
    )
}

export function toggleAnnouncement(
    selection: AnnouncementSelection,
    key: string
): AnnouncementSelection {
    return pushStagedSelectionValue<AnnouncementSelectionValues, 'choices'>(
        selection,
        AnnouncementStageOrder,
        'choices',
        toggled(chosenAnnouncements(selection), key)
    )
}
