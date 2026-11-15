export type PhaseTextPart = { text: string; phaseId?: string }

const PhaseReference = /\b(?:phases?|at)\s$/i
const FurtherPhase = /^(?:[–-]|,\s+|,?\s+(?:and|or)\s+)$/i

/**
 * Splits text at the phases it names, so they can be drawn as badges: an id counts straight after
 * "phase" or "at", or following another phase in a list or range, as in "phases 6 and 7".
 */
export function phaseTextParts(text: string, phaseIds: readonly string[]): PhaseTextPart[] {
    if (!phaseIds.length) return [{ text }]
    const ids = [...phaseIds]
        .sort((first, second) => second.length - first.length)
        .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const pieces = text.split(new RegExp(`(?<![\\w+])(${ids.join('|')})(?![\\w+])`, 'g'))
    const parts: PhaseTextPart[] = []
    let afterPhase = false
    for (const [index, piece] of pieces.entries()) {
        if (index % 2 === 0) {
            parts.push({ text: piece })
            continue
        }
        const before = pieces[index - 1]
        afterPhase = PhaseReference.test(before) || (afterPhase && FurtherPhase.test(before))
        parts.push(afterPhase ? { text: piece, phaseId: piece } : { text: piece })
    }
    return parts.filter((part) => part.text)
}
