import { LetPeekSubjectKind, type LetPeekSubject } from '@tabletop/oath'
import { reliquaryRelicChoice, type CardChoice } from './cardChoice.js'
import { cardName, reliquaryLabel } from './names.js'

/** What the Show menu's draft stores for a subject: the adviser's card, or the Reliquary space. */
export function letPeekKey(subject: LetPeekSubject): string {
    return subject.kind === LetPeekSubjectKind.Adviser ? subject.cardId : subject.slotId
}

/**
 * R-6.1, R-6.6.1 — a subject as its card: the player's own facedown adviser by its face, or the
 * Reliquary relic as this seat knows it (R-6.4-H1: the Scepter's holder, the one who may show it,
 * knows every one).
 */
export function letPeekCard(
    subject: LetPeekSubject,
    knownRelicAt: (slotId: string) => string | undefined
): CardChoice {
    return subject.kind === LetPeekSubjectKind.Adviser
        ? { key: subject.cardId, cardId: subject.cardId, label: cardName(subject.cardId) }
        : reliquaryRelicChoice(subject.slotId, knownRelicAt)
}

/** A chip's accessible name: the adviser by its name; a relic by its space, as the History names it. */
export function letPeekChipName(subject: LetPeekSubject, playerName: string): string {
    const shown =
        subject.kind === LetPeekSubjectKind.Adviser
            ? cardName(subject.cardId)
            : `the relic on ${reliquaryLabel(subject.slotId)}`
    return `Show ${shown} to ${playerName}`
}
