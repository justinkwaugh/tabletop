import { assertExists } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'
import { CardKind, OathType, PlayerStatus, Suit } from '../model/oathEnums.js'
import { CHRONICLE_STORY_LIMIT, ChronicleStep, type Chronicle } from '../model/chronicle.js'
import { cardDefinition, kindOf } from '../data/cardRegistry.js'
import { EDIFICE_DEFINITIONS, edificeName } from '../data/edifices.js'
import { FAVOR_BANK_ORDER } from '../data/favorBanks.js'
import { OATHKEEPER_GOALS, VISION_GOALS } from './oathkeeper.js'
import { isImperialPlayer, ownWarbandOwner, rulesSite } from './rule.js'
import { siteHolding } from './access.js'
import { persistentsOfCard } from './heldPersistents.js'
import {
    addWarbandsToSite,
    killWarbands,
    removeWarbandsFrom,
    returnWarbandsOnCardToBanks
} from './force.js'
import { countOf } from './warbands.js'
import { returnTokensFrom } from './discard.js'

// Every offer here reads public state only: a player's projection computes the same offer.

/** The chronicle being written; a choice exists only after a win at the chronicle revision. */
export function chronicleOf(state: HydratedOathGameState): Chronicle {
    const chronicle = state.chronicle
    assertExists(chronicle, 'R-8 — the chronicle is written only after a win')
    return chronicle
}

/** Law 8 — "the winner performs these steps in order". */
export function chronicleWinnerOf(state: HydratedOathGameState): string {
    return chronicleOf(state).ending.winnerPlayerId
}

/** A seat's name as the table record holds it. */
export function seatNameOf(state: HydratedOathGameState, playerId: string): string {
    const name = state.table?.seatNames[playerId]
    assertExists(name, `The table record names every seat, not ${playerId}`)
    return name
}

/** Why `playerId` cannot make the winner's choice at `step` now. */
function reasonNotWinnersStep(
    state: HydratedOathGameState,
    playerId: string,
    step: ChronicleStep,
    what: string,
    verb: string
): string | undefined {
    if (state.chronicle?.step !== step) return `${what} only while the chronicle asks for it`
    const winnerId = chronicleWinnerOf(state)
    if (playerId === winnerId) return undefined
    return `${seatNameOf(state, winnerId)} ${verb}, not ${seatNameOf(state, playerId)}`
}

// ---------------------------------------------------------------------------------------------
// R-8.1 — the Vow

/** R-8.1, R-2.11, R-3.2.a — a win with a Vision alone vows the Oath whose goal is that Vision's. */
export function forcedVowOf(
    state: HydratedOathGameState
): { oathType: OathType; visionId: string } | undefined {
    const { usurper, visionIds, empire } = chronicleOf(state).ending.waysMet
    if (usurper || empire || visionIds.length !== 1) return undefined
    const [visionId] = visionIds
    const goal = VISION_GOALS[visionId]
    const oathType = Object.values(OathType).find((oath) => OATHKEEPER_GOALS[oath] === goal)
    assertExists(oathType, `R-3.2.a — ${visionId}'s goal is an Oathkeeper goal`)
    return { oathType, visionId }
}

/** R-8.1 — "any goal reference except the one used in the current game". */
export function vowableOaths(state: HydratedOathGameState): OathType[] {
    return Object.values(OathType).filter((oath) => oath !== state.oathType)
}

export function reasonCannotChooseOath(
    state: HydratedOathGameState,
    playerId: string,
    oathType: OathType
): string | undefined {
    const turn = reasonNotWinnersStep(
        state,
        playerId,
        ChronicleStep.Vow,
        'the Oath is chosen',
        'vows the Oath'
    )
    if (turn) return turn
    if (!Object.values(OathType).includes(oathType)) return `${oathType} is not an Oath`
    if (oathType === state.oathType) {
        return 'the next Oath cannot be the one this game was played under'
    }
    return undefined
}

// ---------------------------------------------------------------------------------------------
// R-8.2 — Citizenship

/** R-8.2 — "flip all Citizen boards (even in the box) to their Exile side", an Exile winner only. */
export function flipCitizenBoards(state: HydratedOathGameState): void {
    const flipped = state.players.filter((player) => player.status === PlayerStatus.Citizen)
    for (const player of flipped) player.status = PlayerStatus.Exile
    const flippedBoxColors = state.boxedCitizenColors ?? []
    delete state.boxedCitizenColors
    chronicleOf(state).citizenship = {
        flippedPlayerIds: flipped.map((player) => player.playerId),
        flippedBoxColors
    }
}

export function isExileWinner(state: HydratedOathGameState): boolean {
    return state.getPlayerState(chronicleWinnerOf(state)).status === PlayerStatus.Exile
}

/** R-8.2, R-8.2-H1 — every other Exile, except those whose boards just flipped. */
export function citizenshipEligible(state: HydratedOathGameState): string[] {
    return state.players
        .map((player) => player.playerId)
        .filter((playerId) => reasonNotEligible(state, playerId) === undefined)
}

function reasonNotEligible(state: HydratedOathGameState, playerId: string): string | undefined {
    const player = state.findPlayerState(playerId)
    if (!player) return `${playerId} is not seated in this game`
    const name = seatNameOf(state, playerId)
    if (playerId === chronicleWinnerOf(state)) {
        return `${name} cannot offer Citizenship to themselves`
    }
    if (chronicleOf(state).citizenship?.flippedPlayerIds.includes(playerId)) {
        return `${name}'s board just flipped to its Exile side`
    }
    if (player.status !== PlayerStatus.Exile) return `${name} is not an Exile`
    return undefined
}

export function reasonCannotOfferChronicleCitizenship(
    state: HydratedOathGameState,
    playerId: string,
    exilePlayerIds: readonly string[]
): string | undefined {
    const turn = reasonNotWinnersStep(
        state,
        playerId,
        ChronicleStep.Citizenship,
        'Citizenship is offered',
        'offers Citizenship'
    )
    if (turn) return turn
    if (!isExileWinner(state)) return 'only an Exile winner offers Citizenship'
    if (chronicleOf(state).citizenship?.offers) return 'the offers are already made'
    for (const [index, exileId] of exilePlayerIds.entries()) {
        const reason = reasonNotEligible(state, exileId)
        if (reason) return reason
        if (exilePlayerIds.indexOf(exileId) !== index) {
            return `${seatNameOf(state, exileId)} is named twice`
        }
    }
    return undefined
}

/** R-8.2-H1 — the offered Exiles who have not answered yet. */
export function unansweredOffers(state: HydratedOathGameState): string[] {
    return (state.chronicle?.citizenship?.offers ?? [])
        .filter((offer) => offer.accepted === undefined)
        .map((offer) => offer.playerId)
}

export function reasonCannotAnswerChronicleCitizenship(
    state: HydratedOathGameState,
    playerId: string
): string | undefined {
    const offer =
        state.chronicle?.step === ChronicleStep.Citizenship
            ? state.chronicle.citizenship?.offers?.find((open) => open.playerId === playerId)
            : undefined
    const name = state.findPlayerState(playerId) ? seatNameOf(state, playerId) : playerId
    if (!offer) return `no offer is open to ${name}`
    if (offer.accepted !== undefined) return `${name} has already answered`
    return undefined
}

/**
 * R-8.2 — the sites the accepting Exile rules as they accept (R-10.21, the Bandit Crown's
 * answer: "even sites they had no warbands on"). Each holds one of the winner's warbands after.
 */
export function sitesChangingHands(state: HydratedOathGameState, playerId: string): string[] {
    return state.allSiteIds().filter((siteId) => rulesSite(state, playerId, siteId))
}

/**
 * R-8.2 — the accepter's board flips to Citizen, and at each site they rule their warbands are
 * replaced with one of the winner's. "One of your warbands" names no source and the winner never
 * runs short (an Exile has 14, the map eight sites), so none is taken from a bank: R-8.3.4 clears
 * the map before anything counts warbands again. The accepter's go back to their bank.
 */
export function acceptChronicleCitizenship(
    state: HydratedOathGameState,
    playerId: string
): string[] {
    const siteIds = sitesChangingHands(state, playerId)
    const owner = ownWarbandOwner(state, playerId)
    const winnerOwner = ownWarbandOwner(state, chronicleWinnerOf(state))
    for (const siteId of siteIds) {
        const theirs = countOf(state.warbandsBySite[siteId] ?? {}, owner)
        removeWarbandsFrom(state, { kind: 'site', siteId }, owner, theirs)
        killWarbands(state, owner, theirs)
        addWarbandsToSite(state, siteId, winnerOwner, 1)
    }
    state.getPlayerState(playerId).status = PlayerStatus.Citizen
    return siteIds
}

// ---------------------------------------------------------------------------------------------
// R-8.3.1 — build or repair

/** R-8.3.1 — a legal build (a denizen replaced by the edifice of its suit) or repair (a ruin flipped). */
export interface EdificeChoice {
    siteId: string
    /** The denizen replaced, or the ruin repaired. */
    cardId: string
    edificeId: string
    repair: boolean
}

/** R-2.9 — one edifice per suit. */
function edificeOfSuit(suit: Suit): string {
    const edifice = EDIFICE_DEFINITIONS.find((definition) => definition.suit === suit)
    assertExists(edifice, `R-2.9 — the ${suit} edifice exists`)
    return edifice.id
}

function siteName(state: HydratedOathGameState, siteId: string): string {
    const siteCardId = state.siteCardAt(siteId)
    return (siteCardId && cardDefinition(siteCardId)?.name) ?? siteId
}

function cardName(state: HydratedOathGameState, cardId: string): string {
    if (state.isEdifice(cardId)) return edificeName(cardId, state.isRuined(cardId))
    return cardDefinition(cardId)?.name ?? cardId
}

function suitName(suit: Suit): string {
    return suit.charAt(0).toUpperCase() + suit.slice(1)
}

/** The winner may build or repair: the Chancellor or a Citizen (R-8.3.1). */
export function isImperialWinner(state: HydratedOathGameState): boolean {
    return isImperialPlayer(state, chronicleWinnerOf(state))
}

/** R-8.3.1 — every legal pair, at the sites the winner rules (R-6.6.3, the Bandit Crown's answers). */
export function edificeChoices(state: HydratedOathGameState): EdificeChoice[] {
    const winnerId = chronicleWinnerOf(state)
    const choices: EdificeChoice[] = []
    for (const siteId of state.allSiteIds()) {
        if (!rulesSite(state, winnerId, siteId)) continue
        for (const cardId of state.denizensAt(siteId)) {
            const choice = edificeChoiceAt(state, siteId, cardId)
            if (typeof choice !== 'string') choices.push(choice)
        }
    }
    return choices
}

/** The pair as a build or repair, or why it is neither. */
function edificeChoiceAt(
    state: HydratedOathGameState,
    siteId: string,
    cardId: string
): EdificeChoice | string {
    const site = siteName(state, siteId)
    if (!state.denizensAt(siteId).includes(cardId)) {
        return `${cardName(state, cardId)} is not at ${site}`
    }
    if (state.isEdifice(cardId)) {
        if (!state.isRuined(cardId)) return `${cardName(state, cardId)} is not a ruin`
        return { siteId, cardId, edificeId: cardId, repair: true }
    }
    if (kindOf(cardId) !== CardKind.Denizen) return `${cardName(state, cardId)} is not a denizen`
    if (state.denizensAt(siteId).some((id) => state.isEdifice(id))) {
        return `${site} already holds an edifice`
    }
    const suit = state.suitInPlay(cardId)
    assertExists(suit, `R-2.2.2 — ${cardId} shows a suit`)
    const edificeId = edificeOfSuit(suit)
    // R-8.3.1 — an edifice at any site, ruined or not, is not in the Archive, even one R-8.3.2 is
    // about to return there.
    if (siteHolding(state, edificeId) !== undefined) {
        return `the ${suitName(suit)} edifice is not in the Archive`
    }
    return { siteId, cardId, edificeId, repair: false }
}

export function reasonCannotBuildOrRepair(
    state: HydratedOathGameState,
    playerId: string,
    choice?: { siteId: string; cardId: string }
): string | undefined {
    const turn = reasonNotWinnersStep(
        state,
        playerId,
        ChronicleStep.BuildOrRepair,
        'an edifice is built or repaired',
        'builds'
    )
    if (turn) return turn
    if (!isImperialWinner(state)) return 'only the Chancellor or a Citizen builds or repairs'
    if (!choice) return undefined
    if (!state.allSiteIds().includes(choice.siteId)) return `${choice.siteId} is not a site`
    if (!rulesSite(state, playerId, choice.siteId)) {
        return `you do not rule ${siteName(state, choice.siteId)}`
    }
    const found = edificeChoiceAt(state, choice.siteId, choice.cardId)
    return typeof found === 'string' ? found : undefined
}

/**
 * R-8.3.1 — a build puts the intact edifice first in the site's row (R-2.8.1) in the denizen's
 * place, which leaves play as any card does (R-10.5's tokens); a repair flips the ruin intact.
 */
export function buildOrRepair(state: HydratedOathGameState, choice: EdificeChoice): void {
    const chronicle = chronicleOf(state)
    if (choice.repair) {
        state.setEdificeRuined(choice.edificeId, false)
    } else {
        returnTokensFrom(state, chronicle.ending.winnerPlayerId, choice.cardId)
        returnWarbandsOnCardToBanks(state, choice.cardId)
        const rest = state.denizensAt(choice.siteId).filter((id) => id !== choice.cardId)
        state.denizensBySite[choice.siteId] = [choice.edificeId, ...rest]
        chronicle.returnedDenizenId = choice.cardId
    }
    const siteCardId = state.siteCardAt(choice.siteId)
    assertExists(siteCardId, `R-8.3.1 — the winner rules ${choice.siteId}, so it is faceup`)
    chronicle.built = {
        edificeId: choice.edificeId,
        siteId: choice.siteId,
        siteCardId,
        repaired: choice.repair
    }
}

/** The legal pair named, as checked by `reasonCannotBuildOrRepair`. */
export function edificeChoiceNamed(
    state: HydratedOathGameState,
    choice: { siteId: string; cardId: string }
): EdificeChoice {
    const found = edificeChoiceAt(state, choice.siteId, choice.cardId)
    if (typeof found === 'string') throw Error(found)
    return found
}

// ---------------------------------------------------------------------------------------------
// R-8.4 — the suit, and R-8.4.a-H1's heal stack

/**
 * R-8.4 — the most common suits among the winner's advisers, in the clockwise order. Only faceup
 * advisers have a suit (R-10.14), and only the winner's own advisers count: a card at a site they
 * rule is not an adviser. An adviser that counts as more advisers counts so (R-2.2.2-H1: Marriage).
 * None at all ties all six.
 */
export function chronicleSuitLeaders(state: HydratedOathGameState): Suit[] {
    const winnerId = chronicleWinnerOf(state)
    const advisers = state.getPlayerState(winnerId).faceupAdviserIds()
    const counts = FAVOR_BANK_ORDER.map((suit) =>
        advisers.reduce((count, cardId) => count + advisersCountedBy(state, cardId, suit), 0)
    )
    const most = Math.max(...counts)
    return FAVOR_BANK_ORDER.filter((_, index) => counts[index] === most)
}

/** R-2.2.2-H1 — how many advisers of `suit` the winner's faceup adviser `cardId` is. */
function advisersCountedBy(state: HydratedOathGameState, cardId: string, suit: Suit): number {
    const winnerId = chronicleWinnerOf(state)
    const own = state.suitInPlay(cardId) === suit ? 1 : 0
    return persistentsOfCard(state, cardId, [winnerId]).reduce(
        (count, { ctx, hooks }) =>
            count + (hooks.extraMatchingAdvisers?.(ctx, winnerId, suit) ?? 0),
        own
    )
}

export function reasonCannotChooseChronicleSuit(
    state: HydratedOathGameState,
    playerId: string,
    suit: Suit
): string | undefined {
    const turn = reasonNotWinnersStep(
        state,
        playerId,
        ChronicleStep.Suit,
        'the suit is chosen',
        'chooses the suit'
    )
    if (turn) return turn
    if (!chronicleSuitLeaders(state).includes(suit)) {
        return `${suitName(suit)} is not among the most common suits in your advisers`
    }
    return undefined
}

export function reasonCannotChooseHealStack(
    state: HydratedOathGameState,
    playerId: string,
    suit: Suit
): string | undefined {
    const turn = reasonNotWinnersStep(
        state,
        playerId,
        ChronicleStep.HealStack,
        'the stack to heal from is chosen',
        'chooses the stack'
    )
    if (turn) return turn
    if (!state.chronicle?.healTie?.suits.includes(suit)) {
        return `${suitName(suit)} is not among the largest Dispossessed stacks`
    }
    return undefined
}

// ---------------------------------------------------------------------------------------------
// The winner's story

/** Plain text: line breaks as `\n`, trimmed. */
export function normalizedStory(text: string): string {
    return text.replace(/\r\n?/g, '\n').trim()
}

/** A control character (U+0000-U+001F, U+007F-U+009F) other than the line break. */
function isControl(ch: string): boolean {
    return ch !== '\n' && /\p{Cc}/u.test(ch)
}

export function reasonCannotWriteChronicleStory(
    state: HydratedOathGameState,
    playerId: string,
    text?: string
): string | undefined {
    const writtenThisGame =
        state.chronicle !== undefined &&
        state.chronicle.step === undefined &&
        state.chronicleRecord?.at(-1)?.story !== undefined
    if (writtenThisGame) return 'the story of this game is already written'
    const turn = reasonNotWinnersStep(
        state,
        playerId,
        ChronicleStep.Story,
        'the story is written',
        'writes the story'
    )
    if (turn || text === undefined) return turn
    const story = normalizedStory(text)
    if (story.length === 0) return 'the story is empty'
    if ([...story].length > CHRONICLE_STORY_LIMIT) {
        return `the story is longer than ${CHRONICLE_STORY_LIMIT.toLocaleString('en-US')} characters`
    }
    if ([...story].some(isControl)) return 'the story holds a character that is not plain text'
    return undefined
}
