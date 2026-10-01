import { assertExists } from '@tabletop/common'
import {
    Banner,
    CampaignTargetKind,
    cardDefinition,
    type CampaignTarget,
    type Transfer,
    type HydratedOathGameState,
    Region,
    RELIQUARY_MODIFIERS,
    Suit,
    IMPERIAL_WARBANDS,
    type WarbandOwner
} from '@tabletop/oath'

export function cardName(cardId: string): string {
    // R-6.6.2.a — a Reliquary trait rides the modifier framework under its own id.
    const trait = RELIQUARY_MODIFIERS.find((t) => t.id === cardId)
    if (trait) return trait.name
    const card = cardDefinition(cardId)
    assertExists(card, `No card is registered as ${cardId}`)
    return card.name
}

// R-9.4 — a facedown slot's card is private, so it is named by region and position.
export function siteName(gameState: HydratedOathGameState, slotId: string): string {
    const cardId = gameState.siteCardAt(slotId)
    if (cardId && gameState.isSiteFaceup(slotId)) return cardName(cardId)
    return `a facedown site in the ${regionName(gameState.regionOf(slotId))}`
}

export function relicSiteName(gameState: HydratedOathGameState, slotId: string): string {
    const found = gameState.findRelicSlot(slotId)
    assertExists(found, `${slotId} is not a relic slot at a site`)
    return siteName(gameState, found.siteId)
}

const REGION_NAMES: Record<Region, string> = {
    [Region.Cradle]: 'Cradle',
    [Region.Provinces]: 'Provinces',
    [Region.Hinterland]: 'Hinterland'
}

export function regionName(region: Region): string {
    return REGION_NAMES[region]
}

const SUIT_NAMES: Record<Suit, string> = {
    [Suit.Discord]: 'Discord',
    [Suit.Arcane]: 'Arcane',
    [Suit.Order]: 'Order',
    [Suit.Hearth]: 'Hearth',
    [Suit.Beast]: 'Beast',
    [Suit.Nomad]: 'Nomad'
}

export function suitName(suit: Suit): string {
    return SUIT_NAMES[suit]
}

export function slotLabel(slotId: string): string {
    const m = /^slot\.([a-z]+)\.(\d+)$/.exec(slotId)
    if (!m) return slotId
    const [, region, position] = m
    return `${region.charAt(0).toUpperCase()}${region.slice(1)} ${Number(position) + 1}`
}

/** R-9.4 — another player's facedown adviser, named by its place among their facedown ones. */
export function facedownAdviserLabel(
    gameState: HydratedOathGameState,
    ownerName: string,
    playerId: string,
    index: number
): string {
    const place = gameState
        .getPlayerState(playerId)
        .advisers.slice(0, index + 1)
        .filter((row) => !row.faceUp).length
    return `${ownerName}'s facedown adviser ${place}`
}

export function reliquaryLabel(slotId: string): string {
    const m = /^reliquary\.(\d+)$/.exec(slotId)
    return m ? `Reliquary space ${Number(m[1]) + 1}` : slotId
}

// The engine's refusals cite the Law ("(R-5.2.1)") for the specs and the rules
// table; on screen the citations are noise, so every form the engine uses is stripped.
const RULE = String.raw`R-\d+(?:\.\d+)*(?:\.[a-z])?(?:-H\d+)?(?:\.[IVX]+)?`
const RULE_PAREN = new RegExp(
    String.raw`\s*\((?:${RULE})(?:['’]s[^)]*)?(?:\s*(?:,|;|and|to|–|-)\s*(?:${RULE}))*\)`,
    'g'
)
const RULE_TRAIL = new RegExp(
    String.raw`\s*(?:—|·)\s*(?:${RULE})(?:\s*(?:,|to|–)\s*(?:${RULE}))*(?=\s*$|\s*[.,])`,
    'g'
)
const RULE_LEAD = new RegExp(String.raw`(?:${RULE})(?:\s*,\s*(?:${RULE}))*\s*—\s*`, 'g')
const RULE_POSSESSIVE = new RegExp(String.raw`(?:${RULE})['’]s\b`, 'g')
const RULE_BARE = new RegExp(String.raw`\s*\b(?:${RULE})\b`, 'g')
export function stripRules(text: string): string {
    return text
        .replace(RULE_PAREN, '')
        .replace(RULE_TRAIL, '')
        .replace(RULE_LEAD, '')
        .replace(RULE_POSSESSIVE, "the rule's")
        .replace(RULE_BARE, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([.,;:])/g, '$1')
        .trim()
}

export function humanizeReason(reason: string | undefined): string | undefined {
    if (!reason) return reason
    return nameIds(stripRules(reason), slotLabel)
}

/** Card, site and Reliquary ids inside engine text, named for a reader. */
export function nameIds(text: string, siteOf: (slotId: string) => string): string {
    return text
        .replace(/\b(?:denizen|relic|vision|site)\.[a-z0-9-]+(?:\.[a-z0-9-]+)?\b/g, (id) =>
            cardDefinition(id) ? cardName(id) : id
        )
        .replace(/\bslot\.[a-z]+\.\d+\b/g, (id) => siteOf(id))
        .replace(/\breliquary\.\d+\b/g, (id) => reliquaryLabel(id))
}

export function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** R-10.13 — whose warbands: the Empire's, or a player's by name; never a colour. */
export function warbandOwnerName(
    owner: WarbandOwner,
    nameOf: (playerId: string) => string
): string {
    return owner === IMPERIAL_WARBANDS ? 'Imperial' : `${nameOf(owner)}'s`
}

/** `selfId`'s own warbands need no owner named. */
export function warbandsOf(
    count: number,
    owner: WarbandOwner,
    nameOf: (playerId: string) => string,
    selfId?: string
): string {
    if (owner === selfId) return plural(count, 'warband')
    if (owner === IMPERIAL_WARBANDS) return plural(count, 'Imperial warband')
    return `${count} of ${nameOf(owner)}'s warbands`
}

const BANNER_NAMES: Record<Banner, string> = {
    [Banner.PeoplesFavor]: 'People’s Favor',
    [Banner.DarkestSecret]: 'Darkest Secret'
}

export function bannerName(banner: Banner): string {
    return BANNER_NAMES[banner]
}

/** R-5.5.2 — a Campaign target by printed names; the caller says how to name a place. */
export function campaignTargetText(
    target: CampaignTarget,
    places: { site(siteId: string): string; relicSlot(slotId: string): string }
): string {
    switch (target.kind) {
        case CampaignTargetKind.Site:
            return places.site(target.siteId)
        case CampaignTargetKind.Relic:
            return cardName(target.cardId)
        case CampaignTargetKind.Banner:
            return `the ${bannerName(target.banner)}`
        case CampaignTargetKind.PawnAndFavor:
            return 'their pawn and favor'
        case CampaignTargetKind.SiteRelic:
            return `the relic at ${places.relicSlot(target.slotId)}`
    }
}

/** R-2.5 — the People's Favor holds favor, the Darkest Secret secrets. */
export function bannerTokenKind(banner: Banner): 'favor' | 'secret' {
    return banner === Banner.PeoplesFavor ? 'favor' : 'secret'
}

/** R-9.4 — a faceup adviser by its printed name; a facedown one by its row alone. */
export function adviserRowText(
    gameState: HydratedOathGameState,
    holderId: string,
    row: number
): string {
    const adviser = gameState.getPlayerState(holderId).advisers[row]
    assertExists(adviser, `${holderId} has no adviser in row ${row + 1}`)
    if (!adviser.faceUp) return `the facedown adviser in row ${row + 1}`
    assertExists(adviser.cardId, 'A faceup adviser row names its card')
    return cardName(adviser.cardId)
}

/** What one side of an exchange or a Citizenship offer hands over, by printed names. */
export function transferText(
    gameState: HydratedOathGameState,
    transfer: Transfer | undefined,
    giverId: string
): string {
    const parts: string[] = []
    if (transfer?.favor) parts.push(`${transfer.favor} favor`)
    if (transfer?.secrets) parts.push(`${transfer.secrets} secrets`)
    for (const cardId of transfer?.relicCardIds ?? []) parts.push(cardName(cardId))
    for (const banner of transfer?.banners ?? []) parts.push(`the ${bannerName(banner)}`)
    for (const site of transfer?.sites ?? [])
        parts.push(
            `rule of ${siteName(gameState, site.siteId)} (${site.warbands} warbands move in)`
        )
    for (const row of transfer?.adviserRows ?? [])
        parts.push(`the adviser ${adviserRowText(gameState, giverId, row)}`)
    return parts.length > 0 ? parts.join(', ') : 'nothing'
}
