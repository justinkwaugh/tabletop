import { CardKind, PowerChoiceKind, powerKey, type PowerChoice } from '@tabletop/oath'
import { cardName } from './names.js'

/**
 * One option of a card-valued choice: a card's face, or a back where the chooser may not see it
 * (R-9.4). `key` is what the panel's draft stores.
 */
export type CardChoice = {
    key: string
    cardId?: string
    backKind?: CardKind
    label: string
    caption?: string
}

/** Cards named by id, each its own key. */
export function cardChoices(cardIds: readonly string[]): CardChoice[] {
    return cardIds.map((cardId) => ({ key: cardId, cardId, label: cardName(cardId) }))
}

/** A card's power offered for use (a modifier, a battle plan), keyed by card and power. */
export function powerUseCards(
    powers: readonly { cardId: string; powerIndex: number; text: string }[]
): CardChoice[] {
    return powers.map((power) => ({
        key: powerKey(power.cardId, power.powerIndex),
        cardId: power.cardId,
        label: `${cardName(power.cardId)} — ${power.text}`,
        caption: power.text
    }))
}

/** A tap picks the card; a tap on a picked card untaps it; a full multi-pick takes no more. */
export function togglePick(picked: readonly string[], key: string, max: number): string[] {
    if (picked.includes(key)) return picked.filter((pickedKey) => pickedKey !== key)
    if (max <= 1) return [key]
    return picked.length >= max ? [...picked] : [...picked, key]
}

/** A single choice's draft value after a tap: the key, or none when its own card is tapped again. */
export function toggleSingle(picked: string | undefined, key: string): string | undefined {
    return picked === key ? undefined : key
}

/** What a power choice's option needs from the table to be drawn as a card. */
export type CardResolvers = {
    knownRelicAt(slotId: string): string | undefined
    faceupSiteCardAt(siteId: string): string | undefined
    relicSlotLabel(slotId: string): string
    facedownAdviserLabel(playerId: string, index: number): string
    siteLabel(siteId: string): string
}

/**
 * A power choice's option as a card, where a card stands for it: a card, a relic (its face if
 * known, else a back), a facedown adviser (a back), or warbands at a site (the site card).
 * Warbands on a board, players, banks, regions and counts are not cards.
 */
export function powerChoiceCard(
    option: PowerChoice,
    key: string,
    resolve: CardResolvers
): CardChoice | undefined {
    switch (option.kind) {
        case PowerChoiceKind.Card:
            return { key, cardId: option.cardId, label: cardName(option.cardId) }
        case PowerChoiceKind.RelicSlot: {
            const known = resolve.knownRelicAt(option.slotId)
            return known
                ? { key, cardId: known, label: cardName(known) }
                : { key, backKind: CardKind.Relic, label: resolve.relicSlotLabel(option.slotId) }
        }
        case PowerChoiceKind.FacedownAdviser:
            return {
                key,
                backKind: CardKind.Denizen,
                label: resolve.facedownAdviserLabel(option.playerId, option.index)
            }
        case PowerChoiceKind.Warbands: {
            const at = option.group.at
            if (at.kind !== 'site') return undefined
            const caption = `${option.group.count} ${option.group.color}`
            const siteCardId = resolve.faceupSiteCardAt(at.siteId)
            return siteCardId
                ? {
                      key,
                      cardId: siteCardId,
                      label: `${caption} at ${cardName(siteCardId)}`,
                      caption
                  }
                : {
                      key,
                      backKind: CardKind.Site,
                      label: `${caption} at ${resolve.siteLabel(at.siteId)}`,
                      caption
                  }
        }
        default:
            return undefined
    }
}

/** Every option as a card, or nothing when any option is not one: a row never mixes the two. */
export function powerChoiceCards(
    options: readonly PowerChoice[],
    resolve: CardResolvers
): CardChoice[] | undefined {
    const cards = options.map((option, index) => powerChoiceCard(option, String(index), resolve))
    return cards.every((card): card is CardChoice => card !== undefined) ? cards : undefined
}
