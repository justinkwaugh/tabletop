import {
    ActionType,
    ConsentRequestKind,
    LetPeekSubjectKind,
    PowerQuestionKind,
    RecoverTargetKind,
    SearchPlay,
    SearchSource,
    WarbandMoveKind,
    isAnswerConsent,
    isAnswerQuestion,
    isCampaign,
    isCampaignDefeatKills,
    isCampaignAttackPlans,
    isCampaignDefend,
    isCampaignResolveVictory,
    isCampaignSacrifice,
    isCampaignSkullLosses,
    isCompleteRest,
    isEndActPhase,
    isForgoFreeAction,
    isExileCitizen,
    isMoveWarbands,
    isMuster,
    isOfferCitizenship,
    isPeek,
    isLetPeek,
    isPlayFacedownAdviser,
    isRecover,
    isResolveCitizenshipOffer,
    isResolveOathkeeper,
    isResolveWake,
    isRollEndDie,
    isSearch,
    isSearchResolve,
    isSelfExile,
    isSetupChoice,
    isTrade,
    isTransferOathkeeper,
    isTravel,
    isUseActionPower,
    isUseRestPower,
    cardDefinition,
    cardDefinitions,
    cardPower,
    PowerChoiceKind,
    RELIQUARY_MODIFIERS,
    TradeOption,
    soleOwner,
    PowerMoveTollOutcome,
    IMPERIAL_WARBANDS,
    type AnswerConsentMetadata,
    type Banner,
    type CitizenshipTransfer,
    type ExchangeTerms,
    type ExchangeTransfer,
    type CampaignBattleMetadata,
    type CampaignPlacement,
    type CampaignResolveVictory,
    type CampaignTarget,
    type WarbandGroup,
    Suit,
    type LetPeek,
    type PaidToll,
    type ShroudedWoodPick,
    type WarbandGain,
    type Search,
    type UseActionPower,
    type ResolveWake,
    type UseRestPower,
    type WarbandMove,
    type WarbandOwner
} from '@tabletop/oath'
import { assertExists, type GameAction } from '@tabletop/common'
import {
    bannerName,
    bannerTokenKind,
    campaignTargetText,
    cardName,
    listed,
    nameSeats,
    plural,
    regionName,
    reliquaryLabel,
    nameIds,
    stripRules,
    suitName,
    warbandsOf,
    type NameOf,
    type Seats
} from '$lib/model/names.js'
import {
    actorOnlyOutcome,
    mergedPilesOf,
    pileDepositsOf,
    type PileDeposit
} from '$lib/model/actionOutcomes.js'
import type { WarbandWhose } from '$lib/model/tokenText.js'
import {
    paidTollClause,
    tollMoveText,
    tollStoryText,
    tollsGivenText
} from '$lib/model/tollMoveText.js'

// Past tense with no leading capital or possessive about the actor: `PlayerName` renders "You" first.
// R-9.4 — a card is named only where the game showed it, recorded as `playedCardId`.

/** How a history line names a player and a site; a site by its printed name once faceup. */
export type HistoryNames = Seats & {
    site: (slotId: string) => string
}

function shownCard(cardId: string | undefined): string {
    return cardId ? cardName(cardId) : 'a card'
}

export const UNDESCRIBED = 'took an action'

// R-9.4, R-6.6.1 — an adviser is seen by its holder and the one shown; a relic by the Exile alone.
function describeLetPeek(action: LetPeek, nameOf: NameOf, viewerId: string | undefined): string {
    const shownTo = nameOf(action.toPlayerId)
    const isRecipient = viewerId !== undefined && viewerId === action.toPlayerId
    if (action.subject.kind === LetPeekSubjectKind.Adviser) {
        const sawIt = isRecipient || (viewerId !== undefined && viewerId === action.playerId)
        const cardId = sawIt && 'cardId' in action.subject ? action.subject.cardId : undefined
        return `let ${shownTo} peek at ${cardId ? cardName(cardId) : 'a facedown adviser'}`
    }
    const seen = isRecipient ? action.metadata?.relicCardId : undefined
    return `let ${shownTo} peek at the relic on ${reliquaryLabel(action.subject.slotId)}${seen ? ` (${cardName(seen)})` : ''}`
}

export function rowActorOf(action: GameAction): string | undefined {
    if (isTransferOathkeeper(action)) return action.toPlayerId ?? action.fromPlayerId
    return woodTravelerOf(action) ?? tollMoverOf(action) ?? action.playerId
}

/** R-11.7 — the ruler's pick settles the traveller's Travel, so the row is the traveller's. */
function woodTravelerOf(action: GameAction): string | undefined {
    return isAnswerQuestion(action) ? action.metadata?.woodPick?.travelerPlayerId : undefined
}

/** Toll Roads — the moved player's answer tells the mover's story, so it starts with the mover. */
function tollMoverOf(action: GameAction): string | undefined {
    return isAnswerQuestion(action) ? action.metadata?.tollMove?.moverPlayerId : undefined
}

/**
 * R-10.13 — whose warbands a row counts, from the record alone so the row never changes: those a
 * move names, the owner a Muster (R-5.2.2: a Citizen's are Imperial), an Action power, a
 * sacrifice or a choice of losses recorded, the ones an exile leaves Imperial (R-9.3), the seat a
 * power acted on, else the actor's own.
 */
export function rowWarbandOwner(
    action: GameAction,
    ownWarbandsOf: (playerId: string) => WarbandOwner
): WarbandOwner | undefined {
    const recorded = recordedWarbandOwner(action)
    if (recorded !== undefined) return recorded
    const seat =
        (isUseActionPower(action) || isUseRestPower(action)
            ? action.metadata?.targetPlayerId
            : undefined) ??
        woodTravelerOf(action) ??
        action.playerId
    return seat === undefined ? undefined : ownWarbandsOf(seat)
}

/**
 * R-10.13 — a counted phrase's warbands: the owner its own words name ("Imperial", a seat, the
 * viewer's "your", the actor's "their own"), else the row's. A seat this reader cannot name
 * leaves them the row's, as every phrase was before.
 */
export function phraseWarbandOwner(
    whose: WarbandWhose,
    action: GameAction,
    reader: { names: Seats; viewerId: string | undefined },
    ownWarbandsOf: (playerId: string) => WarbandOwner
): WarbandOwner | undefined {
    switch (whose.kind) {
        case 'imperial':
            return IMPERIAL_WARBANDS
        case 'viewer':
            assertExists(reader.viewerId, 'only a seated viewer reads "your" in a History row')
            return reader.viewerId
        case 'actor':
            assertExists(action.playerId, 'only an actor’s row reads "their own"')
            return action.playerId
        case 'seat':
            return (
                reader.names.seats.find(
                    (playerId) => reader.names.player(playerId) === whose.name
                ) ?? rowWarbandOwner(action, ownWarbandsOf)
            )
        case 'row':
            return rowWarbandOwner(action, ownWarbandsOf)
    }
}

function recordedWarbandOwner(action: GameAction): WarbandOwner | undefined {
    if (isMoveWarbands(action)) return action.owner
    if (isMuster(action)) return action.metadata?.warbandOwner
    if (isUseActionPower(action)) return action.metadata?.warbandOwner
    if (isSelfExile(action) || isExileCitizen(action)) return IMPERIAL_WARBANDS
    if (isCampaignSacrifice(action)) {
        return action.metadata?.sacrificedOwner ?? soleOwner(action.sacrificeKills ?? [])
    }
    if (isCampaignDefeatKills(action)) return soleOwner(action.kills)
    if (isAnswerQuestion(action)) {
        return action.metadata?.woodPick?.warbandOwner ?? action.metadata?.warbandGain?.owner
    }
    return undefined
}

/** Dragonskin Drum on a power's move — what it added, then its name; a skip adds nothing to the move. */
function drumText(cardId: string, gain: WarbandGain | undefined): string {
    return gain && gain.count > 0
        ? `+${plural(gain.count, 'warband')} (${cardName(cardId)})`
        : `skipped the ${cardName(cardId)}`
}

export function describeAction(action: GameAction, names: HistoryNames, viewerId?: string): string {
    // The row starts with this seat's chip, so a note about them needs no subject.
    const actorId = rowActorOf(action)
    const notes = recordedNotes(action).flatMap((note) => {
        const clause = noteClause(note, actorId)
        return clause ? [clause] : []
    })
    const named = new Set(notes.flatMap((clause) => (clause.card ? [clause.card] : [])))
    return historyWords(
        nameIds(
            stripRules(
                describeActionCited(action, names, viewerId, named) +
                    secondWhenPlayedClause(action) +
                    notes
                        .map((clause) => `; ${namedNote(clause.text, actorId, names, viewerId)}`)
                        .join('') +
                    outcomeClauses(action, viewerId)
            ),
            names.site
        )
    )
}

// "1 warbands" and "the top 1 cards" in engine summaries; the Law's spelling.
const ONE_OF_MANY = new RegExp(
    String.raw`\b1 ((?:[A-Za-z]+ )?)(warband|secret|card|relic|shield|skull|sword|adviser|denizen|site|banner)s\b`,
    'g'
)

/** Every row's words as the History says them: one of a thing is singular; "traveled", "defense". */
function historyWords(text: string): string {
    return text
        .replace(ONE_OF_MANY, '1 $1$2')
        .replace(/\btravelled\b/g, 'traveled')
        .replace(/\bdefence\b/g, 'defense')
}

/**
 * R-7.3.3, R-7.1.4, R-11.2, R-7.4, R-5.5.8 — what a triggered power, a Homeland, a modifier or a
 * battle plan did, as the row that set it off recorded it.
 */
function recordedNotes(action: GameAction): readonly string[] {
    if (isSearchResolve(action)) {
        const meta = action.metadata
        return [
            ...(meta?.triggered ?? []),
            ...(meta?.sitePower ? [meta.sitePower] : []),
            ...(meta?.modifierNotes ?? [])
        ]
    }
    if (isPlayFacedownAdviser(action)) {
        const meta = action.metadata
        return [...(meta?.sitePower ? [meta.sitePower] : []), ...(meta?.modifierNotes ?? [])]
    }
    if (isTravel(action) || isMuster(action) || isTrade(action) || isRecover(action)) {
        return action.metadata?.modifierNotes ?? []
    }
    if (isCampaign(action) || isCampaignAttackPlans(action) || isAnswerConsent(action)) {
        return action.metadata?.battle?.planNotes ?? []
    }
    if (isCampaignDefend(action) || isCampaignSacrifice(action) || isCampaignDefeatKills(action)) {
        return action.metadata?.planNotes ?? []
    }
    if (isCampaignResolveVictory(action)) return action.metadata?.triggered ?? []
    // R-5.5.8 — the plans and the end that waited on a banish's answer (Toll Roads, the Shrouded Wood).
    if (isAnswerQuestion(action)) return action.metadata?.triggered ?? []
    return []
}

/** Land Warden — the second card's When Played, under that card's name once, as the kept card's is. */
function secondWhenPlayedClause(action: GameAction): string {
    if (!isSearchResolve(action)) return ''
    const second = action.metadata?.secondWhenPlayed
    if (!second) return ''
    const cardId = action.metadata?.secondPlayedCardId
    return `; ${cardId ? `${cardName(cardId)}: ${withoutCardName(second, cardId)}` : second}`
}

/** A stored note as a clause: what happened, then the card that did it in brackets. */
type NoteClause = { text: string; card?: string }

const CARD_NAMES: ReadonlySet<string> = new Set([
    ...cardDefinitions().map((card) => card.name),
    ...RELIQUARY_MODIFIERS.map((trait) => trait.name)
])
const CARD_NOTE = /^([^:]+): ([\s\S]+)$/
const HOMELAND = /^(.+) \(Homeland\)$/
const SPECIAL_ENVOY = /^Special Envoy ends \S+'s Act Phase$/
const TYRANT = /^Tyrant killed a warband at (\S+)$/
const AWAITED_RETURN = /^sacrificed a warband from your board \(Awaited Return\)$/
const CARELESS = /^Careless: (.+)$/
// A note recorded with the reader's "you" read wrong for every other seat; the engine names the seat now.
const SAYS_YOU = /\byour?\b/i

/**
 * What a card did inside another row: "gained 1 warband (Dragonskin Drum)". A note whose subject
 * is the row's own player drops it; a note that names its card in another shape is reworded from
 * what it always means; an older note that says "you" is not shown.
 */
function noteClause(note: string, actorId: string | undefined): NoteClause | undefined {
    // R-4.2 — Special Envoy's end of the Act Phase is named after the Travel's cost.
    if (SPECIAL_ENVOY.test(note)) return undefined
    // Tyrant kills one warband at the destination, the site the note names.
    const tyrant = TYRANT.exec(note)
    if (tyrant) return { text: `killed 1 warband at ${tyrant[1]} (Tyrant)`, card: 'Tyrant' }
    // Awaited Return sacrifices from the trader's own board.
    if (AWAITED_RETURN.test(note)) {
        return { text: 'sacrificed 1 warband (Awaited Return)', card: 'Awaited Return' }
    }
    // Careless gains one favor or, from an empty bank or under Vow of Poverty, none.
    const careless = CARELESS.exec(note)
    if (careless) {
        const gained = careless[1] === 'gained 1 favor' ? 1 : 0
        return { text: `gained ${gained} favor (Careless)`, card: 'Careless' }
    }
    if (SAYS_YOU.test(note)) return undefined
    const carded = CARD_NOTE.exec(note)
    const card = carded ? noteCard(carded[1]) : undefined
    if (!carded || card === undefined) return { text: note }
    const subject = actorId === undefined ? undefined : `${actorId} `
    const rest =
        subject && carded[2].startsWith(subject) ? carded[2].slice(subject.length) : carded[2]
    return { text: `${rest} (${card})`, card }
}

/** A note's prefix as the card it names: a card, a Reliquary trait, or a site's Homeland. */
function noteCard(prefix: string): string | undefined {
    if (CARD_NAMES.has(prefix)) return prefix
    const homeland = HOMELAND.exec(prefix)
    return homeland && CARD_NAMES.has(homeland[1]) ? `${homeland[1]}, Homeland` : undefined
}

/** R-7.4 — each modifier the row used and shows nothing for, once, in brackets after the cost. */
function cardsInBrackets(
    modifiers: readonly string[] | undefined,
    named: ReadonlySet<string>
): string {
    const cards = [
        ...new Set(
            (modifiers ?? []).map((modifier) => cardName(modifier.replace(/ \(must\)$/, '')))
        )
    ].filter((card) => !named.has(card))
    return cards.length > 0 ? ` (${cards.join(', ')})` : ''
}

/**
 * R-7.4 — the cards whose part of a row is its count: each is named once, after the gain it
 * changed ("mustered 3 warbands (Rowdy Pub) at Rowdy Pub"), not after the cost. Read from the
 * row's recorded `modifiers`, so an older record reads them too.
 */
const MUSTER_GAIN_CARDS: ReadonlySet<string> = new Set([
    'denizen.hearth.rowdy-pub',
    'denizen.discord.downtrodden',
    'denizen.beast.vow-of-beastkin'
])
const TRADE_GAIN_CARDS: Readonly<Record<TradeOption, ReadonlySet<string>>> = {
    [TradeOption.ForFavor]: new Set(['denizen.arcane.secret-signal', 'reliquary.careless']),
    [TradeOption.ForSecrets]: new Set(['denizen.beast.the-old-oak'])
}

/** The names of the row's cards that changed its gain, those not already named by a note. */
function gainCards(
    modifiers: readonly string[] | undefined,
    changers: ReadonlySet<string>,
    named: ReadonlySet<string>
): string[] {
    const ids = (modifiers ?? []).map((modifier) => modifier.replace(/ \(must\)$/, ''))
    return [...new Set(ids.filter((id) => changers.has(id)).map((id) => cardName(id)))].filter(
        (card) => !named.has(card)
    )
}

function inBrackets(cards: readonly string[]): string {
    return cards.length > 0 ? ` (${cards.join(', ')})` : ''
}

/** The Supply a row spent, and the cards that changed it; "spending 0 Supply (Special Envoy)". */
function costWith(spent: number | undefined, cards: string): string {
    return cards ? `, spending ${spent ?? 0} Supply${cards}` : supply(spent)
}

/** R-7.3.3 — the kept card's When Played follows it: "…: gained 4 Imperial warbands". */
function whenPlayedClause(
    whenPlayed: string | undefined,
    cardId: string | undefined,
    actorId: string,
    names: HistoryNames,
    viewerId: string | undefined
): string {
    if (!whenPlayed) return ''
    const shown = cardId ? withoutCardName(whenPlayed, cardId) : whenPlayed
    return `: ${namedNote(shown, actorId, names, viewerId)}`
}

/** R-5.5.7.I — each placement names its owner, so its piece takes that owner's colour. */
function placementsClause(
    placements: readonly CampaignPlacement[],
    actorId: string,
    names: HistoryNames
): string | undefined {
    const placed = placements
        .filter((placement) => placement.count > 0)
        .map(
            (placement) =>
                `${warbandsOf(placement.count, placement.owner, names.player, actorId)} at ${names.site(placement.siteId)}`
        )
    return placed.length > 0 ? `placed ${placed.join(' and ')}` : undefined
}

// R-9.4 — a pile's region is public; the cards and what was seen are the actor's alone.
function outcomeClauses(action: GameAction, viewerId: string | undefined): string {
    const isActor = viewerId !== undefined && action.playerId === viewerId
    const parts = pileDepositsOf(action).map((deposit) => describeDeposit(deposit, isActor))
    const searchDiscards = describeSearchDiscards(action, isActor)
    if (searchDiscards) parts.unshift(searchDiscards)
    const merged = mergedPilesOf(action)
    if (merged) parts.push(`the ${merged.from} discard pile went onto the ${merged.to} pile`)
    const seen = actorOnlyOutcome(action, viewerId)
    if (seen?.peeked) parts.push(`you saw ${seen.peeked.map(cardName).join(', ')}`)
    if (seen?.relicToDeckBottom !== undefined) {
        parts.push(`you put ${cardName(seen.relicToDeckBottom)} on the bottom of the relic deck`)
    }
    return parts.length > 0 ? `; ${parts.join('; ')}` : ''
}

function describeDeposit(deposit: PileDeposit, isActor: boolean): string {
    const where = `${deposit.bottom ? 'the bottom of ' : ''}the ${deposit.region} discard pile`
    return isActor
        ? `${deposit.cardIds.map(cardName).join(', ')} went to ${where}`
        : `cards went to ${where}`
}

// R-5.1.4, R-10.5 — how many and where are public; which cards, the searcher's alone.
function describeSearchDiscards(action: GameAction, isActor: boolean): string | undefined {
    if (!isSearchResolve(action) || !action.metadata) return undefined
    const meta = action.metadata
    if (meta.discardedCount === 0) return undefined
    const where = meta.discardToWorldDeck
        ? 'the bottom of the world deck'
        : `${meta.discardToBottom ? 'the bottom of ' : ''}the ${meta.discardPileRegion} discard pile`
    const what = isActor
        ? meta.discardedCardIds.map(cardName).join(', ')
        : plural(meta.discardedCount, 'card')
    return `${what} went to ${where}`
}

function supply(spent: number | undefined): string {
    return spent !== undefined && spent > 0 ? `, spending ${spent} Supply` : ''
}

/** Second Wind out of turn — the card whose free action this was, in brackets. */
function freeActionClause(cardId: string | undefined): string {
    return cardId ? ` (free, ${cardName(cardId)})` : ''
}

const TOLL_GIVEN = /^(.+): gave a favor to (.+)$/
const TOLL_BURNED = /^(.+): burned a favor for the bandits$/

/**
 * R-7.1.4 — each toll the record says was paid, as its own clause, what was paid then the card
 * that asked it: "paid Rhys 1 favor (Toll Roads)", or the favor burned for the bandits. A note in
 * another form is skipped, and a record from before the field prints no clause.
 */
export function tollClauses(notes: readonly string[] | undefined, nameOf: NameOf): string {
    return (notes ?? [])
        .map((note) => {
            const given = TOLL_GIVEN.exec(note)
            if (given) return `; paid ${nameOf(given[2])} 1 favor (${cardName(given[1])})`
            const burned = TOLL_BURNED.exec(note)
            return burned ? `; burned 1 favor (${cardName(burned[1])})` : ''
        })
        .join('')
}

/** R-2.5 — a count of a banner's own token: favor for the People's Favor, secrets for the Darkest Secret. */
function bannerTokens(count: number, banner: Banner): string {
    return bannerTokenKind(banner) === 'favor' ? `${count} favor` : plural(count, 'secret')
}

/** "used Field Promotion", "used no battle plans": the plans a side used, by name. */
function usedPlans(planIds: readonly string[]): string {
    return planIds.length > 0 ? `used ${listed(planIds.map(planName))}` : 'used no battle plans'
}

// A record names a plan by its id; an older one by its name.
function planName(plan: string): string {
    return cardDefinition(plan) ? cardName(plan) : plan
}

function describeActionCited(
    action: GameAction,
    names: HistoryNames,
    viewerId: string | undefined,
    named: ReadonlySet<string>
): string {
    const nameOf = names.player
    if (isSetupChoice(action)) {
        // R-1.23.2 keeps the adviser facedown, so it is never named.
        const pile = action.metadata?.discardPileRegion
        // R-1.16 — the Chancellor's split of a bank too short for every site, sent only then.
        const split = action.siteFavor ?? []
        const placed = split.reduce((total, site) => total + site.favor, 0)
        return (
            `started at ${names.site(action.siteId)} and kept a card facedown` +
            (pile ? `, discarding 2 to the ${regionName(pile)} pile` : '') +
            (split.length > 0
                ? `; placed ${placed} favor: ${split.map((site) => `${cardName(site.siteCardId)} ${site.favor}`).join(', ')}`
                : '')
        )
    }
    if (isTravel(action)) {
        const meta = action.metadata
        // R-11.7 — the Shrouded Wood's ruler names the site in their answer.
        if (action.siteId === undefined) {
            const chooser = meta?.destinationChooser
            const ruler = chooser ? nameOf(chooser) : 'its ruler'
            if (meta?.paysAtPick) {
                return `set out from Shrouded Wood${freeActionClause(meta.freeActionOf)}; ${ruler} picks where`
            }
            return `left Shrouded Wood${supply(meta?.supplySpent)}; ${ruler} picks where`
        }
        const revealed = meta?.revealedSiteCardId
            ? `; revealed ${cardName(meta.revealedSiteCardId)}` +
              ((meta.relicsRevealed ?? 0) > 0
                  ? ` and ${plural(meta.relicsRevealed ?? 0, 'facedown relic')}`
                  : '')
            : ''
        return (
            `traveled to ${names.site(action.siteId)}` +
            costWith(meta?.supplySpent, cardsInBrackets(meta?.modifiers, named)) +
            tollClauses(meta?.tollsPaid, nameOf) +
            (meta?.secretFlipped ? '; flipped 1 secret' : '') +
            revealed +
            freeActionClause(meta?.freeActionOf)
        )
    }
    if (isMuster(action)) {
        const meta = action.metadata
        const gainedBy = gainCards(meta?.modifiers, MUSTER_GAIN_CARDS, named)
        return (
            `mustered ${meta ? `${plural(meta.warbandsGained, 'warband')}${inBrackets(gainedBy)} ` : ''}at ${cardName(action.cardId)}` +
            costWith(
                meta?.supplySpent,
                cardsInBrackets(meta?.modifiers, new Set([...named, ...gainedBy]))
            )
        )
    }
    if (isTrade(action)) {
        // The token traded for is the option's, whatever came beside it (Careless).
        const meta = action.metadata
        const gained =
            action.option === TradeOption.ForFavor
                ? `${meta?.favorGained ?? 0} favor`
                : plural(meta?.secretsGained ?? 0, 'secret')
        const gainedBy = gainCards(meta?.modifiers, TRADE_GAIN_CARDS[action.option], named)
        return (
            `traded at ${cardName(action.cardId)} for ${gained}${inBrackets(gainedBy)}` +
            costWith(
                meta?.supplySpent,
                cardsInBrackets(meta?.modifiers, new Set([...named, ...gainedBy]))
            ) +
            tollClauses(meta?.tollsPaid, nameOf)
        )
    }
    if (isSearch(action)) {
        const from =
            action.drawFrom === SearchSource.WorldDeck
                ? 'the world deck'
                : 'their region’s discard pile'
        const meta = action.metadata
        const shown = meta?.revealedDraw
        const shownBy = shown ? new Set([...named, cardName(TRUTHFUL_HARP)]) : named
        return (
            `searched ${from}` +
            costWith(meta?.supplySpent, cardsInBrackets(meta?.modifiers, shownBy)) +
            tollClauses(meta?.tollsPaid, nameOf) +
            (shown ? `; showed ${shown.map(cardName).join(', ')} (Truthful Harp)` : '') +
            (searchStoppedOnVision(action) ? '; the draw stopped on a Vision' : '')
        )
    }
    if (isSearchResolve(action)) {
        const meta = action.metadata
        const kept = meta?.playedCardId ?? meta?.revealedKeptCardId
        // R-5.1.4.II — an adviser is facedown unless played faceup, which shows it.
        const facedown =
            action.play === SearchPlay.Adviser &&
            action.faceUp !== true &&
            meta?.playedCardId === undefined
        return (
            `kept ${shownCard(kept)} and ${describePlay(action.play)}` +
            (facedown ? ', facedown' : '') +
            gaining(meta?.secretsGained ?? 0, meta?.favorGained ?? 0) +
            whenPlayedClause(meta?.whenPlayed, kept, action.playerId, names, viewerId)
        )
    }
    if (isRecover(action)) {
        if (action.target.kind === RecoverTargetKind.Banner) {
            const paid = action.amountPaid ?? action.metadata?.amountPaid
            return (
                `recovered the ${bannerName(action.target.banner)}` +
                (paid === undefined ? '' : ` for ${bannerTokens(paid, action.target.banner)}`)
            )
        }
        const relic = action.metadata?.relicCardId
        return (
            (relic ? `recovered ${cardName(relic)}` : 'recovered a relic at their site') +
            supply(action.metadata?.supplySpent)
        )
    }
    if (isCampaign(action)) {
        const meta = action.metadata
        const against =
            action.defender.kind === 'bandits' ? 'the bandits' : nameOf(action.defender.playerId)
        const targets = listed(action.targets.map((target) => describeTarget(target, names.site)))
        // R-5.5.3 — the attacker's own plans, as declared; the bandits' compelled ones are the defense's.
        const plans = (action.plans ?? []).map((plan) => plan.cardId)
        const declared =
            `campaigned against ${against}${targets ? ` for ${targets}` : ''}` +
            freeActionClause(meta?.freeActionOf) +
            supply(meta?.supplySpent) +
            (plans.length > 0 ? `, using ${listed(plans.map(planName))}` : '')
        // R-5.5.2.a — nothing is rolled until the Citizens asked have answered.
        if (meta?.awaitingAllies) return `${declared}; Citizens may join the defense`
        return meta?.battle ? `${declared}; ${describeBattle(meta.battle, true)}` : declared
    }
    if (isCampaignAttackPlans(action)) {
        const battle = action.metadata?.battle
        return (
            usedPlans((action.plans ?? []).map((plan) => plan.cardId)) +
            (battle ? `; ${describeBattle(battle, true)}` : '')
        )
    }
    if (isUseRestPower(action)) {
        return `rested with ${cardName(action.cardId)}${powerEffect(action, names, viewerId)}`
    }
    if (isCampaignDefend(action)) {
        const meta = action.metadata
        if (!meta) return usedPlans([])
        // R-5.5.3.a — while another defender still chooses, nothing is rolled.
        const pools =
            (meta.awaitingMore ?? []).length > 0
                ? `${meta.attackPool} attack dice against ${meta.defensePool} defense dice`
                : `${meta.swords} swords against ${meta.defense} defense`
        return `${usedPlans(meta.plansUsed)}; ${pools}`
    }
    if (isCampaignSacrifice(action)) {
        const chooser = action.metadata?.awaitingLossesOf
        return (
            `sacrificed ${plural(action.metadata?.sacrificed ?? action.sacrifice, 'warband')} and ` +
            (action.metadata?.attackerVictorious ? 'won the battle' : 'lost the battle') +
            (chooser ? `; ${nameOf(chooser)} picks the defense's losses` : '')
        )
    }
    if (isCampaignSkullLosses(action)) {
        return describeSkullLosses(action.metadata?.killed ?? action.kills, names.site)
    }
    if (isCampaignDefeatKills(action)) {
        return `picked the defense's losses: ${plural(action.metadata?.defeatKilled ?? 0, 'warband')} killed`
    }
    if (isCampaignResolveVictory(action)) {
        return describeSpoils(action, names, viewerId)
    }
    if (isPlayFacedownAdviser(action)) {
        // R-6.1 plays the adviser faceup, which shows it, or discards it, which does not.
        const meta = action.metadata
        // R-7.4 — a card that chose where the play went is named after the place it chose.
        const usedFor = (cardId: string, did: boolean) =>
            did ? gainCards(meta?.modifiers, new Set([cardId]), named) : []
        const elsewhere = action.toSiteId
        const grew = usedFor(NEW_GROWTH, elsewhere !== undefined)
        const first = action.discardFirstCardId
        const rotated = usedFor(CROP_ROTATION, first !== undefined)
        const horn = usedFor(CRACKED_HORN, meta?.discardToWorldDeck === true)
        const played = shownCard(meta?.playedCardId)
        return (
            (action.play === SearchPlay.Site && elsewhere !== undefined
                ? `played ${played} to ${names.site(elsewhere)}${inBrackets(grew)}`
                : describeAdviserPlay(action.play, played)) +
            (meta?.discardToWorldDeck ? ` under the world deck${inBrackets(horn)}` : '') +
            (first ? `, discarding ${cardName(first)} first${inBrackets(rotated)}` : '') +
            gaining(meta?.secretsGained ?? 0, meta?.favorGained ?? 0) +
            cardsInBrackets(meta?.modifiers, new Set([...named, ...grew, ...rotated, ...horn])) +
            whenPlayedClause(
                meta?.whenPlayed,
                meta?.playedCardId,
                action.playerId,
                names,
                viewerId
            ) +
            tollClauses(meta?.tollsPaid, nameOf)
        )
    }
    if (isUseActionPower(action)) {
        const cost = printedCost(action.cardId, action.powerIndex)
        const toll = action.metadata?.tollMove
        if (toll) return tollMoveText(toll, names, viewerId, cost)
        // Forced Labor on Oracle — what the power did, then the toll with its card.
        const tolls = action.metadata?.tollsGiven ?? []
        const paying =
            tolls.length > 0 ? `; ${tollsGivenText(tolls, names, viewerId, action.playerId)}` : ''
        const effect =
            exchangeOffer(action, names) ??
            messengerMoves(action, names) ??
            powerEffect(action, names, viewerId)
        return `used ${cardName(action.cardId)}${cost}${effect}${paying}`
    }
    if (isPeek(action)) {
        return 'peeked at a relic at their site'
    }
    if (isLetPeek(action)) {
        return describeLetPeek(action, nameOf, viewerId)
    }
    if (isMoveWarbands(action)) {
        const warbands = `${warbandsOf(action.count, action.owner, nameOf, action.playerId)} ${describeMove(action.move, nameOf)}`
        const asked = action.metadata?.awaitingConsentOf
        return asked
            ? `asked ${nameOf(asked)}'s permission to move ${warbands}`
            : `moved ${warbands}`
    }
    if (isAnswerConsent(action)) {
        return describeConsentAnswer(action.metadata, action.granted, nameOf)
    }
    if (isOfferCitizenship(action)) {
        // R-6.6.1 — the offer's terms, from its own record.
        const gives = transferParts(action.terms?.fromScepterHolder)
        const asks = transferParts(action.terms?.fromExile)
        return (
            `offered ${nameOf(action.exilePlayerId)} Citizenship, ` +
            listed([`the relic on ${reliquaryLabel(action.reliquarySlotId)}`, ...gives]) +
            (asks.length > 0 ? `, for ${listed(asks)}` : '')
        )
    }
    if (isResolveCitizenshipOffer(action)) {
        const unreplaced = action.metadata?.outcome?.unreplacedCount ?? 0
        return action.granted
            ? 'accepted Citizenship' +
                  (unreplaced > 0
                      ? `, removing ${plural(unreplaced, 'warband')} for want of Imperial ones`
                      : '')
            : 'refused Citizenship'
    }
    if (isAnswerQuestion(action)) {
        const meta = action.metadata
        // R-11.7 — the pick, or the toll's answer that settled it (the ruler is then the mover).
        if (meta?.woodPick) {
            const toll = meta.tollMove
            const rulerId = toll?.moverPlayerId ?? action.playerId
            return describeWoodPick(meta.woodPick, rulerId, names, viewerId, toll?.toll)
        }
        if (meta?.tollMove) return tollMoveText(meta.tollMove, names, viewerId)
        if (!meta) return 'answered a question'
        if (meta.kind === PowerQuestionKind.DragonskinDrum) return drumText(meta.cardId, meta.warbandGain)
        const answer = action.answer
        // The Gathering — the proposal's terms, from the answer's own record.
        if (answer.kind === PowerQuestionKind.GatheringFloor && answer.proposal) {
            const { withPlayerId, terms } = answer.proposal
            return `${cardName(meta.cardId)}: ${offerText(withPlayerId, terms, action.playerId, names)}`
        }
        // False Prophet — its warband on the Vision died, then the Vision was played or discarded.
        const vision = PROPHESIED.exec(meta.summary)?.[0]
        if (answer.kind === PowerQuestionKind.PlayOrDiscardVision && vision) {
            const play =
                answer.play === SearchPlay.Adviser
                    ? `${describePlay(answer.play)}, facedown`
                    : describePlay(answer.play)
            return `${cardName(meta.cardId)}: 1 warband on ${cardName(vision)} died; ${play}`
        }
        return `${cardName(meta.cardId)}: ${namedSummary(meta.summary, meta.cardId, action.playerId, names, viewerId)}`
    }
    if (isExileCitizen(action)) {
        // R-6.7 — the exiler pays the Citizen they throw out; R-9.3's leftover Imperial warbands are worth a clause.
        const meta = action.metadata
        return (
            `exiled ${nameOf(action.citizenPlayerId)}` +
            ((meta?.favorGiven ?? 0) > 0 ? `, giving them ${meta?.favorGiven} favor` : '') +
            unreplacedClause(meta?.unreplacedCount ?? 0, meta?.unreplacedReturned === true)
        )
    }
    if (isSelfExile(action)) {
        // R-6.8, R-10.11 — the favor goes to the Grand Scepter's holder, named once the record keeps them.
        const meta = action.metadata
        const holderId = meta?.scepterHolderId
        return (
            'went into exile' +
            ((meta?.favorGiven ?? 0) > 0
                ? `, giving ${meta?.favorGiven} favor to ${holderId ? nameOf(holderId) : 'the Grand Scepter’s holder'}`
                : '') +
            unreplacedClause(meta?.unreplacedCount ?? 0, meta?.unreplacedReturned === true)
        )
    }
    if (isResolveWake(action)) {
        // R-4.1.3's Usurper flip decides R-3.1 at the next Wake.
        return [
            'began the turn',
            ...wakeDone(action),
            ...(action.metadata?.flippedToUsurper
                ? ['the Oathkeeper title flipped to Usurper']
                : []),
            ...(action.metadata?.flippedToMob ? ['the People’s Favor flipped to Mob'] : [])
        ].join('; ')
    }
    if (isEndActPhase(action)) return 'ended the Act Phase'
    if (isForgoFreeAction(action)) {
        assertExists(action.metadata, 'a free action given up records which')
        return action.metadata.forgone === ActionType.Campaign
            ? 'gave up the free Campaign'
            : 'gave up the free Travel'
    }
    if (isCompleteRest(action)) {
        const roll = action.metadata?.endDieRoll
        return (
            'rested' +
            (roll !== undefined ? `, rolling ${roll} on the end die` : '') +
            (action.metadata?.endedRound ? '; the round ended' : '')
        )
    }
    if (isRollEndDie(action)) {
        const roll = action.metadata?.roll
        return roll === undefined ? 'rolled the end die' : `rolled the end die: ${roll}`
    }
    if (isResolveOathkeeper(action)) {
        return `gave the Oathkeeper title to ${nameOf(action.chosenPlayerId)}`
    }
    if (isTransferOathkeeper(action)) {
        if (action.toPlayerId === undefined) return 'lost the Oathkeeper title; nobody holds it'
        return action.fromPlayerId === undefined
            ? 'took the Oathkeeper title'
            : `took the Oathkeeper title from ${nameOf(action.fromPlayerId)}`
    }
    return UNDESCRIBED
}

const TRUTHFUL_HARP = 'relic.truthful-harp'
const NEW_GROWTH = 'denizen.beast.new-growth'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const CRACKED_HORN = 'relic.cracked-horn'
// False Prophet's answer names the Vision it played or discarded.
const PROPHESIED = /\bvision\.[a-z0-9-]+/

/** What a play gained: "gaining 1 secret", "gaining 2 favor". */
function gaining(secrets: number, favor: number): string {
    const gained = [
        ...(secrets > 0 ? [plural(secrets, 'secret')] : []),
        ...(favor > 0 ? [`${favor} favor`] : [])
    ]
    return gained.length > 0 ? `, gaining ${listed(gained)}` : ''
}

/**
 * R-5.5.7 — the spoils one step at a time: the placements (I), the relics taken and the banners
 * seized with what their seizing burned (II), the banish and the defender's burn (III), then a
 * toll the banish met. A record without the defender names them by their role.
 */
function describeSpoils(
    action: CampaignResolveVictory,
    names: HistoryNames,
    viewerId: string | undefined
): string {
    const meta = action.metadata
    const defender = meta?.defenderPlayerId ? names.player(meta.defenderPlayerId) : 'the defender'
    const banners = meta?.bannersSeized ?? []
    const seizeBurned = meta?.seizeBurned ?? 0
    const [only] = banners
    const burning =
        seizeBurned <= 0
            ? ''
            : banners.length === 1 && only !== undefined
              ? `, burning ${bannerTokens(seizeBurned, only)} from it`
              : `, burning ${seizeBurned} from them`
    const taken = meta?.relicsTaken ?? []
    const toll = meta?.tollMove
    const parts = [
        placementsClause(action.placements, action.playerId, names),
        taken.length > 0 ? `took ${listed(taken)}` : undefined,
        banners.length > 0
            ? `seized ${listed(banners.map((banner) => `the ${bannerName(banner)}`))}${burning}`
            : undefined,
        meta?.banishedToSiteId
            ? `banished ${defender} to ${names.site(meta.banishedToSiteId)}`
            : undefined,
        (meta?.favorBurned ?? 0) > 0
            ? `burned ${meta?.favorBurned} favor from ${defender}`
            : undefined,
        toll && toll.outcome !== PowerMoveTollOutcome.Asked
            ? tollStoryText(toll, names, viewerId)
            : undefined
    ].flatMap((part) => (part === undefined ? [] : [part]))
    return parts.length > 0 ? `took the spoils: ${parts.join('; ')}` : 'took the spoils'
}

/** R-10.8 — an exchange offered, from its own record: "offered Rhys 2 favor for Plains (…)". */
function offerText(
    withPlayerId: string,
    terms: ExchangeTerms,
    proposerId: string,
    names: HistoryNames
): string {
    const gives = transferParts(terms.fromProposer, { receiverId: withPlayerId, proposerId, names })
    const asks = transferParts(terms.fromCounterparty, {
        receiverId: proposerId,
        proposerId,
        names
    })
    return `offered ${names.player(withPlayerId)} ${gives.length > 0 ? listed(gives) : 'nothing'} for ${asks.length > 0 ? listed(asks) : 'nothing'}`
}

/** Deed Writer, Tinker's Fair, The Tribunal — the binding exchange its choices proposed. */
function exchangeOffer(action: UseActionPower, names: HistoryNames): string | undefined {
    const exchange = (action.choices ?? []).find(
        (choice) => choice.kind === PowerChoiceKind.Exchange
    )
    if (exchange?.kind !== PowerChoiceKind.Exchange) return undefined
    return `: ${offerText(exchange.withPlayerId, exchange.terms, action.playerId, names)}`
}

/**
 * One side of an exchange or a Citizenship offer from the record alone: never today's board, so an
 * adviser is "an adviser" (R-9.4) and a site's warbands are the receiver's who move in.
 */
function transferParts(
    transfer: (ExchangeTransfer & CitizenshipTransfer) | undefined,
    site?: { receiverId: string; proposerId: string; names: HistoryNames }
): string[] {
    if (!transfer) return []
    return [
        ...((transfer.favor ?? 0) > 0 ? [`${transfer.favor} favor`] : []),
        ...((transfer.secrets ?? 0) > 0 ? [plural(transfer.secrets ?? 0, 'secret')] : []),
        ...(transfer.relicCardIds ?? []).map(cardName),
        ...(transfer.banners ?? []).map((banner) => `the ${bannerName(banner)}`),
        ...(site
            ? (transfer.sites ?? []).map(
                  (given) =>
                      `${site.names.site(given.siteId)} (${warbandsOf(given.warbands, site.receiverId, site.names.player, site.proposerId)} move in)`
              )
            : []),
        ...(transfer.adviserRows ?? []).map(() => 'an adviser')
    ]
}

/** R-11.7 — the traveller's row: where the ruler sent them, what they paid, and what fired there. */
function describeWoodPick(
    pick: ShroudedWoodPick,
    rulerId: string,
    names: HistoryNames,
    viewerId: string | undefined,
    toll?: PaidToll
): string {
    // Toll Roads, paid before the Supply, then what fired at the site.
    const tollClause = toll ? `; ${paidTollClause(toll)}` : ''
    const notes = (pick.notes ?? [])
        .flatMap((note) => {
            const clause = noteClause(note, pick.travelerPlayerId)
            return clause ? [`; ${clause.text}`] : []
        })
        .join('')
    return nameSeats(
        `traveled from Shrouded Wood to ${names.site(pick.siteId)} (${rulerId}'s pick)${supply(pick.supplySpent)}${tollClause}${notes}`,
        names,
        viewerId,
        pick.travelerPlayerId
    )
}

/** R-5.1.2 — public from the record's own flag; a Search recorded before it shows its stop to the drawer alone. */
export function searchStoppedOnVision(action: Search): boolean {
    return (
        action.metadata?.stoppedOnVision === true || action.metadata?.draw?.stoppedOnVision === true
    )
}

/** R-7.1.2 — the cost printed on the card, as the History says it was paid. */
function printedCost(cardId: string, powerIndex: number): string {
    const cost = cardPower(cardId, powerIndex)?.cost
    if (!cost) return ''
    const counted = (count: number, noun: string) =>
        count === 1 ? `a ${noun}` : `${count} ${noun}${noun === 'secret' ? 's' : ''}`
    const placed = [
        ...(cost.placeFavor > 0 ? [counted(cost.placeFavor, 'favor')] : []),
        ...(cost.placeSecret > 0 ? [counted(cost.placeSecret, 'secret')] : [])
    ]
    const burned = [
        ...(cost.burnFavor > 0 ? [counted(cost.burnFavor, 'favor')] : []),
        ...(cost.burnSecret > 0 ? [counted(cost.burnSecret, 'secret')] : [])
    ]
    const clauses = [
        ...(placed.length > 0 ? [`placing ${placed.join(' and ')} on it`] : []),
        ...(burned.length > 0 ? [`burning ${burned.join(' and ')}`] : [])
    ]
    return clauses.length > 0 ? `, ${clauses.join(' and ')}` : ''
}

function powerEffect(
    action: UseActionPower | UseRestPower,
    names: HistoryNames,
    viewerId: string | undefined
): string {
    const summary = action.metadata?.summary
    if (!summary) return ''
    return `: ${namedSummary(summary, action.cardId, action.playerId, names, viewerId)}`
}

const MESSENGER = 'denizen.order.messenger'

/**
 * Messenger's moves from the action's own choices, as the engine pairs them (warbands, then the
 * site they go to, else the board): the sites as printed, in older games too.
 */
function messengerMoves(action: UseActionPower, names: HistoryNames): string | undefined {
    if (action.cardId !== MESSENGER) return undefined
    const choices = action.choices ?? []
    const moves = choices.flatMap((choice, i) => {
        if (choice.kind !== PowerChoiceKind.Warbands) return []
        const next = choices[i + 1]
        const { at, owner, count } = choice.group
        const from = at.kind === 'board' ? 'board' : names.site(at.siteId)
        const to = next?.kind === PowerChoiceKind.Site ? names.site(next.siteId) : 'board'
        return [`${warbandsOf(count, owner, names.player, action.playerId)} ${from} → ${to}`]
    })
    return moves.length > 0 ? `: ${moves.join('; ')}` : undefined
}

/** An engine summary as a History row reads it: every seat named, "you" for the viewer alone. */
function namedSummary(
    summary: string,
    cardId: string,
    actorId: string,
    names: HistoryNames,
    viewerId: string | undefined
): string {
    return namedNote(withoutCardName(summary, cardId), actorId, names, viewerId)
}

function namedNote(
    note: string,
    actorId: string | undefined,
    names: HistoryNames,
    viewerId: string | undefined
): string {
    return namedBanks(nameSeats(note, names, viewerId, actorId))
}

/** R-4.1.1, R-4.1.4 — the People's Favor steps and the site's take; R-4.1.2's win ends the Wake before the take. */
function wakeDone(action: ResolveWake): string[] {
    const steps = action.favorSteps.map((step) =>
        step.kind === 'place'
            ? 'placed 1 favor on the People’s Favor'
            : `returned 1 favor to the ${suitName(step.toSuit)} bank`
    )
    const took =
        action.sitePowerTake && !action.metadata?.wonBy
            ? [`took 1 ${action.sitePowerTake} from their site`]
            : []
    return [...steps, ...took]
}

function withoutCardName(summary: string, cardId: string): string {
    const prefix = `${cardName(cardId)}: `
    return summary.startsWith(prefix) ? summary.slice(prefix.length) : summary
}

function namedBanks(text: string): string {
    return Object.values(Suit).reduce(
        (named, suit) => named.replaceAll(`the ${suit} bank`, `the ${suitName(suit)} bank`),
        text
    )
}

/** R-9.3, R-6.7-H1 — an exile's own warbands ran short: the rest stayed Imperial, or went back. */
function unreplacedClause(count: number, returned: boolean): string {
    if (count <= 0) return ''
    return returned
        ? `, returning ${plural(count, 'Imperial warband')} to the Chancellor’s bank`
        : `, with ${plural(count, 'warband')} left Imperial`
}

function describeAdviserPlay(play: SearchPlay, card: string): string {
    switch (play) {
        case SearchPlay.Site:
            return `played ${card} to their site`
        case SearchPlay.Adviser:
            return `turned ${card} faceup as an adviser`
        case SearchPlay.RevealedVision:
            return `revealed ${card} as their Vision`
        case SearchPlay.Conspiracy:
            return 'played the Conspiracy'
        case SearchPlay.Discard:
            return `discarded ${card}`
    }
}

function describePlay(play: SearchPlay): string {
    switch (play) {
        case SearchPlay.Site:
            return 'played it to their site'
        case SearchPlay.Adviser:
            return 'played it as an adviser'
        case SearchPlay.RevealedVision:
            return 'revealed it as a Vision'
        case SearchPlay.Conspiracy:
            return 'played the Conspiracy'
        case SearchPlay.Discard:
            return 'discarded it'
    }
}

function describeTarget(target: CampaignTarget, site: HistoryNames['site']): string {
    return campaignTargetText(target, { site, relicSlot: () => 'a site' })
}

/** R-5.5.5 — where the skulls killed, as the attacker picked: the board is always their own. */
function describeSkullLosses(killed: readonly WarbandGroup[], site: HistoryNames['site']): string {
    const places = killed
        .filter((group) => group.count > 0)
        .map((group) => ({
            count: group.count,
            where: group.at.kind === 'board' ? 'on their board' : `at ${site(group.at.siteId)}`
        }))
    const total = places.reduce((sum, place) => sum + place.count, 0)
    const [only, ...more] = places
    if (!only) return `lost ${total} to skulls`
    if (more.length === 0) return `lost ${total} to skulls, ${only.where}`
    return `lost ${total} to skulls: ${places.map(({ count, where }) => `${count} ${where}`).join(', ')}`
}

/**
 * R-5.5.4, R-5.5.5 — the roll and what the skulls killed, the dice while the defending side
 * still chooses its plans. The skulls kill the attacker's warbands: on another seat's row the
 * attacker is named, with no piece in that seat's colour.
 */
function describeBattle(battle: CampaignBattleMetadata, attackersRow: boolean): string {
    if (battle.awaitingDefender) {
        return `${battle.attackPool} attack dice against ${battle.defensePool} defense dice`
    }
    const skulls = battle.skullsKilled
    const lost =
        skulls <= 0
            ? ''
            : attackersRow
              ? `; lost ${plural(skulls, 'warband')} to skulls`
              : `; the attacker lost ${skulls} to skulls`
    return `${battle.swords} swords against ${battle.defense} defense${lost}`
}

// R-6.5.a, R-6.5.b, R-5.5.2.a — the answer names what was asked of the answering player.
function describeConsentAnswer(
    meta: AnswerConsentMetadata | undefined,
    granted: boolean,
    nameOf: NameOf
): string {
    const asker = meta ? nameOf(meta.askingPlayerId) : 'the asking player'
    const battle = meta?.battle ? `; ${describeBattle(meta.battle, false)}` : ''
    switch (meta?.kind) {
        case ConsentRequestKind.JoinDefence:
            return (granted ? 'asked to join the defense' : 'stayed out of the battle') + battle
        case ConsentRequestKind.AdmitAlly:
            return (
                (granted
                    ? `admitted ${asker} to the defense`
                    : `kept ${asker} out of the defense`) + battle
            )
        case ConsentRequestKind.WarbandMove:
            return granted ? `let ${asker} move the warbands` : `refused ${asker}'s warband move`
        default:
            return granted ? 'gave permission' : 'refused permission'
    }
}

function describeMove(move: WarbandMove, nameOf: NameOf): string {
    switch (move.kind) {
        case WarbandMoveKind.SiteToBoard:
            return 'from site to board'
        case WarbandMoveKind.BoardToSite:
            return 'from board to site'
        case WarbandMoveKind.GiveToImperial:
            return `to ${nameOf(move.otherPlayerId)}`
        case WarbandMoveKind.TakeFromImperial:
            return `from ${nameOf(move.otherPlayerId)}`
    }
}
