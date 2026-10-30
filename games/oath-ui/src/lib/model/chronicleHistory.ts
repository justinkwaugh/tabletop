import type { GameAction } from '@tabletop/common'
import {
    BoardSide,
    ChronicleKeptFor,
    OpeningChancellor,
    Goal,
    OATHKEEPER_GOALS,
    OathType,
    edificeName,
    isAnswerChronicleCitizenship,
    isBuildOrRepairEdifice,
    isChooseChronicleSuit,
    isChooseHealStack,
    isChooseOath,
    isChronicleAddCards,
    isChronicleDispossess,
    isChronicleFlipCitizens,
    isChronicleForcedVow,
    isChronicleHeal,
    isChronicleMap,
    isChronicleRebuild,
    isChronicleRelics,
    isChronicleSettleSuit,
    isChronicleStart,
    isOfferChronicleCitizenship,
    isSkipChronicleStory,
    isWriteChronicleStory,
    type ChronicleAdded,
    type ChronicleEntry,
    type ChronicleMapMetadata,
    type ChronicleRelicsMetadata,
    type HydratedOathGameState,
    type Suit,
    type WinRule
} from '@tabletop/oath'
import {
    ageName,
    cardName,
    listed,
    oathName,
    plural,
    regionName,
    suitName
} from '$lib/model/names.js'
import { endingParts } from '$lib/model/endings.js'

// R-8 — the chronicle as the History tells it, each row from its own action's record: a player's
// choice, or the System Action that ran a step the rules settle alone. Seats are named by id, for
// their chips; hidden cards are counted, never named.

/** R-2.11 — what the Oathkeeper does under each Oath, as the goal tile's top half says it. */
const OATHKEEPER_DOES: Record<Goal, string> = {
    [Goal.MostSites]: 'rules the most sites',
    [Goal.PeoplesFavor]: 'holds the People’s Favor',
    [Goal.MostRelicsAndBanners]: 'holds the most relics and banners',
    [Goal.DarkestSecret]: 'holds the Darkest Secret'
}

/** "the Oathkeeper holds the most relics and banners" */
export function oathkeeperGoalWords(oathType: OathType): string {
    return `the Oathkeeper ${OATHKEEPER_DOES[OATHKEEPER_GOALS[oathType]]}`
}

/** "swore the Oath of Protection: the Oathkeeper holds the most relics and banners." */
function sworeWords(oathType: OathType, visionId?: string): string {
    const by = visionId ? `, by the ${cardName(visionId)}` : ''
    return `swore the Oath of ${oathName(oathType)}${by}: ${oathkeeperGoalWords(oathType)}.`
}

/** How the game was won, as the ending names it: "won as Usurper". */
export function wonWords(rule: WinRule): string {
    return `won ${endingParts(rule).how}`
}

/** This game's number: the record's last entry once the chronicle is written, else the next one. */
export function gameNumberOf(state: HydratedOathGameState): number {
    const record = state.chronicleRecord ?? []
    return chronicleWritten(state) ? record.length : record.length + 1
}

function chronicleWritten(state: HydratedOathGameState): boolean {
    return state.chronicle !== undefined && state.chronicle.step === undefined
}

/** R-8.4 — "3 Beast cards, 2 Nomad cards and 1 Discord card": the suit's symbol before "cards". */
function addedSuitsWords(suits: readonly Suit[]): string {
    const counts = [3, 2, 1]
    return listed(suits.map((suit, k) => plural(counts[k], `${suitName(suit)} card`)))
}

function healWords(heal: NonNullable<ChronicleAdded['heal']>): string {
    return `${plural(heal.count, `${suitName(heal.suit)} card`)} from the Dispossessed went into the world deck`
}

/**
 * A chronicle action's sentence after the actor's chip, read from its own input and metadata: the
 * eight choices', and a System Action's rows joined. Undefined for any other action.
 */
export function chronicleActionWords(action: GameAction): string | undefined {
    if (isChooseOath(action)) return sworeWords(action.oathType)
    if (isOfferChronicleCitizenship(action)) {
        return action.exilePlayerIds.length === 0
            ? 'made no offer of Citizenship.'
            : `offered ${listed(action.exilePlayerIds)} Citizenship.`
    }
    if (isAnswerChronicleCitizenship(action)) {
        if (!action.accept) return 'refused Citizenship.'
        const metadata = action.metadata
        const replaced =
            metadata && metadata.siteCardIds.length > 0
                ? `; their warbands at ${listed(metadata.siteCardIds)} became ${metadata.winnerPlayerId}’s`
                : ''
        return `accepted Citizenship${replaced}.`
    }
    if (isBuildOrRepairEdifice(action)) {
        const metadata = action.metadata
        if (!action.choice || !metadata) return 'built no edifice.'
        const edifice = edificeName(metadata.edificeId, false)
        if (metadata.repaired) return `repaired the ${edifice} at ${metadata.siteCardId}.`
        const returned = metadata.returnedDenizenId
            ? `; ${metadata.returnedDenizenId} went into the world deck`
            : ''
        return `built ${edifice} at ${metadata.siteCardId}${returned}.`
    }
    if (isChooseChronicleSuit(action)) {
        // R-8.4 — the choice and what it adds are one row.
        const suits = action.metadata?.added?.suits
        const added = suits ? `: ${addedSuitsWords(suits)} went into the world deck` : ''
        return `chose ${suitName(action.suit)} cards${added}.`
    }
    if (isChooseHealStack(action)) {
        const heal = action.metadata?.added.heal
        return `chose the stack of ${suitName(action.suit)} cards${heal ? `: ${healWords(heal)}` : ''}.`
    }
    if (isWriteChronicleStory(action)) {
        const gameNumber = action.metadata?.gameNumber
        return gameNumber !== undefined
            ? `wrote the story of ${ageName(gameNumber)}.`
            : 'wrote the story.'
    }
    if (isSkipChronicleStory(action)) return 'skipped the story.'
    return chronicleRowsOf(action)
        ?.map((row) => row.text)
        .join(' ')
}

/** A skipped story has no row. */
export function shownInHistory(action: GameAction): boolean {
    return !isSkipChronicleStory(action)
}

/** A row the chronicle adds to the History: framed as the game's turn, or a step the rules settled. */
export type ChronicleRow =
    { kind: 'begins'; text: string } | { kind: 'step'; text: string; actorId?: string }

// ---------------------------------------------------------------------------------------------
// R-8.3.2 to R-8.3.5

const KEPT_WORDS: Record<ChronicleKeptFor, (winnerId: string, count: number) => string> = {
    [ChronicleKeptFor.Ruled]: (winnerId) => `ruled by ${winnerId}`,
    [ChronicleKeptFor.Edifice]: (_, count) =>
        count === 1 ? 'for its edifice' : 'for their edifices',
    [ChronicleKeptFor.ForestTemple]: () => 'by Forest Temple'
}

/** "Kept Plains and Steppe, ruled by <Dana>; Deep Woods, by Forest Temple." */
function keptWords(map: ChronicleMapMetadata, winnerId: string): string {
    if (map.kept.length === 0) return 'Kept no site.'
    const keptFor = map.keptFor
    if (!keptFor) return `Kept ${listed(map.kept)}.`
    const groups = Object.values(ChronicleKeptFor).flatMap((reason) => {
        const sites = map.kept.filter((siteCardId) => keptFor[siteCardId] === reason)
        return sites.length > 0 ? [{ reason, sites }] : []
    })
    const [first, ...rest] = groups.map(
        ({ reason, sites }) => `${listed(sites)}, ${KEPT_WORDS[reason](winnerId, sites.length)}`
    )
    return `Kept ${[first, ...rest].join('; ')}.`
}

/** "River, Wastes and 1 facedown site went back to the site deck; 2 denizens to the discards." */
function discardedWords(map: ChronicleMapMetadata): string | undefined {
    const sites = [
        ...map.discarded,
        ...(map.discardedFacedown > 0 ? [plural(map.discardedFacedown, 'facedown site')] : [])
    ]
    if (sites.length === 0) return undefined
    const denizens =
        map.denizensDiscarded > 0
            ? `; ${plural(map.denizensDiscarded, 'denizen')} to the discards`
            : ''
    return `${listed(sites)} went back to the site deck${denizens}.`
}

/** R-8.3.3 — "Festival District at Ancient City became a ruin; 1 denizen to the discards." */
function ruinsWords(map: ChronicleMapMetadata): string | undefined {
    if (map.ruins.length === 0) return undefined
    const ruins = map.ruins.map(
        (ruin) =>
            `${edificeName(ruin.edificeId, false)} at ${ruin.siteCardId} became a ruin; ` +
            `${plural(ruin.denizensDiscarded, 'denizen')} to the discards`
    )
    return `${ruins.join('; ')}.`
}

function slotIndex(slotId: string): number {
    return Number(slotId.split('.').at(-1))
}

/** "Cleared the map; moved Steppe and Deep Woods up the Provinces; dealt 4 facedown sites; flipped Mountain." */
function clearedWords(map: ChronicleMapMetadata): string {
    const ways = new Map<string, string[]>()
    for (const move of map.moved) {
        const from = move.fromRegion
        const to = move.toRegion
        const way =
            from !== to
                ? `to the ${regionName(to)}`
                : slotIndex(move.to) < slotIndex(move.from)
                  ? `up the ${regionName(to)}`
                  : `down the ${regionName(to)}`
        ways.set(way, [...(ways.get(way) ?? []), move.siteCardId])
    }
    const clauses = [
        'Cleared the map',
        ...[...ways].map(([way, sites]) => `moved ${listed(sites)} ${way}`),
        ...(map.dealt.length > 0 ? [`dealt ${plural(map.dealt.length, 'facedown site')}`] : []),
        ...(map.flipped.length > 0
            ? [`flipped ${listed(map.flipped.map((flip) => flip.siteCardId))}`]
            : [])
    ]
    return `${clauses.join('; ')}.`
}

function mapRows(map: ChronicleMapMetadata): ChronicleRow[] {
    const kept = [keptWords(map, map.winnerPlayerId), discardedWords(map)].filter(Boolean).join(' ')
    return steps(kept, ruinsWords(map), clearedWords(map))
}

/** Rows the rules settled, with no chip; an absent sentence is no row. */
function steps(...texts: (string | undefined)[]): ChronicleRow[] {
    return texts.flatMap((text) => (text ? [{ kind: 'step' as const, text }] : []))
}

// ---------------------------------------------------------------------------------------------
// R-8.4 to R-8.8

/**
 * R-8.4, R-8.4.a — the cards added, unless the winner's choice of suit already says so; a tie for
 * the largest stack adds nothing yet, and the winner's pick says what it took (R-8.4.a-H1).
 */
function addRows(added: ChronicleAdded | undefined, suitChosen: boolean): ChronicleRow[] {
    if (added?.suits) {
        return suitChosen ? [] : steps(`${addedSuitsWords(added.suits)} went into the world deck.`)
    }
    return added?.heal ? steps(`The Archive was short: ${healWords(added.heal)}.`) : []
}

function relicCount(count: number): string {
    return count === 1 ? 'relic' : `${count} relics`
}

/** "<Rhys>’s relic and <Ann>’s": a later holder of as many as the first needs no noun. */
function holdersWords(holders: readonly { name: string; count: number }[]): string {
    const [first] = holders
    return listed(
        holders.map(({ name, count }, k) =>
            k > 0 && count === first.count ? `${name}’s` : `${name}’s ${relicCount(count)}`
        )
    )
}

/** R-8.6 — counts only (R-9.4); the Grand Scepter's row reads the same wherever it was. */
function relicsWords(relics: ChronicleRelicsMetadata): string {
    const winnerId = relics.winnerPlayerId
    const returned = relics.returned.filter((entry) => entry.count > 0)
    const placedBy = new Map<number, string[]>()
    for (const { siteCardId, count } of relics.placed) {
        placedBy.set(count, [...(placedBy.get(count) ?? []), siteCardId])
    }
    const placed = [...placedBy].map(
        ([count, sites]) =>
            `${count === 1 ? 'a facedown relic' : `${count} facedown relics`} at ${listed(sites)}`
    )
    const { winner, reliquary } = relics.stacked
    const stacked = [
        ...(winner > 0 ? [{ name: winnerId, count: winner }] : []),
        ...(reliquary > 0 ? [{ name: 'the Reliquary', count: reliquary }] : [])
    ]
    return (
        [
            'The Grand Scepter went to the box',
            ...(returned.length > 0
                ? [
                      `${holdersWords(returned.map(({ playerId, count }) => ({ name: playerId, count })))} went back to the relic deck`
                  ]
                : []),
            ...(placed.length > 0 ? [`placed ${listed(placed)}`] : []),
            ...(stacked.length > 0
                ? [`${holdersWords(stacked)} went on top of the relic deck`]
                : [])
        ].join('; ') + '.'
    )
}

// ---------------------------------------------------------------------------------------------
// Each System Action's rows

/**
 * The rows a chronicle System Action adds to the History, oldest first, from its own record: none
 * for a step that shows nothing on its own (the flip, a single leading suit, a chosen stack's draw,
 * which the winner's own row tells). Undefined for any other action.
 */
export function chronicleRowsOf(action: GameAction): ChronicleRow[] | undefined {
    if (isChronicleStart(action)) {
        return [
            {
                kind: 'begins',
                text: `${action.winnerPlayerId} ${wonWords(action.rule)}. The Chronicle begins.`
            }
        ]
    }
    if (isChronicleForcedVow(action)) {
        const metadata = action.metadata
        if (!metadata) return []
        return [
            {
                kind: 'step',
                text: sworeWords(metadata.oathType, metadata.visionId),
                actorId: metadata.winnerPlayerId
            }
        ]
    }
    if (isChronicleMap(action)) return action.metadata ? mapRows(action.metadata) : []
    if (isChronicleAddCards(action)) {
        return addRows(action.metadata?.added, action.metadata?.chosen === true)
    }
    if (isChronicleDispossess(action)) {
        const count = action.metadata?.count
        return count !== undefined
            ? steps(`Set ${plural(count, 'card')} aside as the Dispossessed, unseen.`)
            : []
    }
    if (isChronicleRelics(action)) return action.metadata ? steps(relicsWords(action.metadata)) : []
    if (isChronicleRebuild(action)) return steps('Rebuilt the world deck.')
    if (
        isChronicleFlipCitizens(action) ||
        isChronicleSettleSuit(action) ||
        isChronicleHeal(action)
    ) {
        return []
    }
    return undefined
}

/**
 * The record's entries this game carried in, newest first: every entry but this game's own, which
 * is the last once its chronicle is written.
 */
export function carriedEntries(state: HydratedOathGameState): ChronicleEntry[] {
    const record = state.chronicleRecord ?? []
    return (chronicleWritten(state) ? record.slice(0, -1) : record).toReversed()
}

/** A row saying how a continued game's seats were settled: the seat's id, for its chip, and words. */
export interface OpeningRow {
    playerId: string
    text: string
}

/** The words after a seat's chip; the viewer's chip reads "you", so they agree with it. */
interface SeatWords {
    is: string
    was: string
    their: string
}

/** Each way the Chancellor was chosen, given the game before this one and the seat's words. */
const CHANCELLOR_WORDS: Record<
    OpeningChancellor,
    (previousGame: number, words: SeatWords) => string
> = {
    [OpeningChancellor.Winner]: (previousGame, { is }) =>
        `${is} the Chancellor, as the winner of ${ageName(previousGame)}.`,
    [OpeningChancellor.Citizen]: (_, { is, their }) =>
        `${is} the Chancellor: ${their} board was on its Citizen side.`,
    [OpeningChancellor.Random]: (_, { is }) => `${is} the Chancellor, chosen at random.`
}

const SIDE_WORDS: Record<BoardSide, string> = {
    [BoardSide.Exile]: 'Exile side up',
    [BoardSide.Citizen]: 'Citizen side up'
}

/**
 * R-1.7-H1, R-1.9-H1 — a continued game's seats as it opened, oldest first: the Chancellor, then
 * each other seat in turn order. Each row's text starts with its seat's id, for its chip. None in a
 * first game.
 */
export function openingRows(state: HydratedOathGameState, viewerId?: string): OpeningRow[] {
    const seats = state.openingSeats
    if (!seats) return []
    const wordsFor = (playerId: string): SeatWords =>
        playerId === viewerId
            ? { is: 'are', was: 'were', their: 'your' }
            : { is: 'is', was: 'was', their: 'their' }
    const { chancellor } = seats
    // R-1.7-H1 — the last winner won the game before this one: the record's last entry as it opened.
    const previousGame = gameNumberOf(state) - 1
    return [
        {
            playerId: chancellor.playerId,
            text: `${chancellor.playerId} ${CHANCELLOR_WORDS[chancellor.chosen](previousGame, wordsFor(chancellor.playerId))}`
        },
        ...seats.boards.map((board) => ({
            playerId: board.playerId,
            text: `${board.playerId} ${board.kept ? 'kept' : `${wordsFor(board.playerId).was} dealt`} the ${board.color} board, ${SIDE_WORDS[board.side]}.`
        }))
    ]
}

/** "won as Usurper, under the Oath of Supremacy." — a record row's words after its chip. */
export function recordRowWords(entry: ChronicleEntry): string {
    return `${wonWords(entry.rule)}, under the Oath of ${oathName(entry.startingOath)}.`
}
