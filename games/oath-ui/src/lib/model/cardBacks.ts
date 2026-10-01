import { CardKind, type AdviserRow, type OathProjectedPlayerState } from '@tabletop/oath'

export type HandBack = { back: CardKind.Vision | CardKind.Denizen; label: string }

const VISION_IN_HAND: HandBack = { back: CardKind.Vision, label: 'A Vision in hand' }
const DENIZEN_IN_HAND: HandBack = { back: CardKind.Denizen, label: 'A denizen in hand' }

/** R-9.4 — a Vision's back differs from a denizen's, so the adviser row says which back it shows. */
export function adviserBack(row: Pick<AdviserRow, 'vision'>): CardKind {
    return row.vision ? CardKind.Vision : CardKind.Denizen
}

/** R-9.4 — a hand holds world-deck cards: its Visions show the Vision back, the rest a denizen's. */
export function handBacks(
    playerState: Pick<OathProjectedPlayerState, 'handCount' | 'handVisions'>
): HandBack[] {
    return Array.from({ length: playerState.handCount }, (_, index) =>
        index < playerState.handVisions ? VISION_IN_HAND : DENIZEN_IN_HAND
    )
}
