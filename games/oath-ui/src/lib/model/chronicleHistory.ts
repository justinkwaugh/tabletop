import type { GameAction } from '@tabletop/common'
import {
    ChronicleKeptFor,
    Goal,
    OATHKEEPER_GOALS,
    OathType,
    edificeName,
    isAnswerChronicleCitizenship,
    isBuildOrRepairEdifice,
    isChooseChronicleSuit,
    isChooseHealStack,
    isChooseOath,
    isOfferChronicleCitizenship,
    isSkipChronicleStory,
    isWriteChronicleStory,
    type Chronicle,
    type ChronicleAdded,
    type ChronicleEntry,
    type ChronicleMapRecord,
    type ChronicleRelicsRecord,
    type HydratedOathGameState,
    type Suit,
    type WinRule
} from '@tabletop/oath'
import { cardName, listed, oathName, plural, regionName, suitName } from '$lib/model/names.js'
import { endingParts } from '$lib/model/endings.js'

// R-8 — the chronicle as the History tells it. Every fact is read from the public `chronicle` of
// the state being viewed: a system step runs inside whichever action reaches it, so its rows are
// placed by the Law's order after that action. Seats are named by id, for their chips; hidden cards
// are counted, never named.

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

/** What the History needs of the chronicle being viewed, for a chronicle action's sentence. */
export interface ChronicleWords {
    chronicle: Chronicle
    /** This game's number in the record. */
    gameNumber: number
    /** The site card in a slot as the chronicle's choices saw it, before R-8.3.5 moved any. */
    siteBeforeMap: (slotId: string) => string | undefined
}

/** This game's number: the record's last entry once the chronicle is written, else the next one. */
export function gameNumberOf(state: HydratedOathGameState): number {
    const record = state.chronicleRecord ?? []
    return chronicleWritten(state) ? record.length : record.length + 1
}

function chronicleWritten(state: HydratedOathGameState): boolean {
    return state.chronicle !== undefined && state.chronicle.step === undefined
}

export function chronicleWordsOf(state: HydratedOathGameState): ChronicleWords | undefined {
    const chronicle = state.chronicle
    if (!chronicle) return undefined
    return {
        chronicle,
        gameNumber: gameNumberOf(state),
        siteBeforeMap: (slotId) =>
            chronicle.map?.moved.find((move) => move.from === slotId)?.siteCardId ??
            state.siteCards[slotId]
    }
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
 * The eight chronicle actions' sentences, after the actor's chip; `words` is the chronicle as the
 * viewed state holds it, absent where a row is read without one. Undefined for any other action.
 */
export function chronicleActionWords(
    action: GameAction,
    words: ChronicleWords | undefined
): string | undefined {
    if (isChooseOath(action)) return sworeWords(action.oathType)
    if (isOfferChronicleCitizenship(action)) {
        return action.exilePlayerIds.length === 0
            ? 'made no offer of Citizenship.'
            : `offered ${listed(action.exilePlayerIds)} Citizenship.`
    }
    if (isAnswerChronicleCitizenship(action)) {
        if (!action.accept) return 'refused Citizenship.'
        const sites = (action.metadata?.siteIds ?? []).map(
            (slotId) => words?.siteBeforeMap(slotId) ?? slotId
        )
        const winnerId = words?.chronicle.ending.winnerPlayerId
        const replaced =
            sites.length > 0
                ? `; their warbands at ${listed(sites)} became ${winnerId ? `${winnerId}’s` : 'the winner’s'}`
                : ''
        return `accepted Citizenship${replaced}.`
    }
    if (isBuildOrRepairEdifice(action)) {
        const choice = action.choice
        const metadata = action.metadata
        if (!choice || !metadata) return 'built no edifice.'
        const site = words?.siteBeforeMap(choice.siteId) ?? choice.siteId
        const edifice = edificeName(metadata.edificeId, false)
        if (metadata.repaired) return `repaired the ${edifice} at ${site}.`
        const returned = metadata.returnedDenizenId
            ? `; ${metadata.returnedDenizenId} went into the world deck`
            : ''
        return `built ${edifice} at ${site}${returned}.`
    }
    if (isChooseChronicleSuit(action)) {
        // R-8.4 — the choice and what it added are one row.
        const suits = words?.chronicle.added?.suits
        const added = suits ? `: ${addedSuitsWords(suits)} went into the world deck` : ''
        return `chose ${suitName(action.suit)} cards${added}.`
    }
    if (isChooseHealStack(action)) {
        const heal = words?.chronicle.added?.heal
        return `chose the stack of ${suitName(action.suit)} cards${heal ? `: ${healWords(heal)}` : ''}.`
    }
    if (isWriteChronicleStory(action)) {
        return words ? `wrote the story of game ${words.gameNumber}.` : 'wrote the story.'
    }
    if (isSkipChronicleStory(action)) return 'skipped the story.'
    return undefined
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
function keptWords(map: ChronicleMapRecord, winnerId: string): string {
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
function discardedWords(map: ChronicleMapRecord): string | undefined {
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
function ruinsWords(map: ChronicleMapRecord): string | undefined {
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
function clearedWords(map: ChronicleMapRecord, state: HydratedOathGameState): string {
    const ways = new Map<string, string[]>()
    for (const move of map.moved) {
        const from = state.regionOf(move.from)
        const to = state.regionOf(move.to)
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

function mapRows(chronicle: Chronicle, state: HydratedOathGameState): ChronicleRow[] {
    const map = chronicle.map
    if (!map) return []
    const winnerId = chronicle.ending.winnerPlayerId
    const kept = [keptWords(map, winnerId), discardedWords(map)].filter(Boolean).join(' ')
    return [kept, ruinsWords(map), clearedWords(map, state)].flatMap((text) =>
        text ? [{ kind: 'step' as const, text }] : []
    )
}

// ---------------------------------------------------------------------------------------------
// R-8.4 to R-8.8

/** R-8.4, R-8.4.a — the cards added, unless the winner's choice of suit or stack already says so. */
function addRows(chronicle: Chronicle, suitChosen: boolean): ChronicleRow[] {
    const added = chronicle.added
    if (added?.suits && !suitChosen) {
        return [{ kind: 'step', text: `${addedSuitsWords(added.suits)} went into the world deck.` }]
    }
    // R-8.4.a-H1 — a tied heal is the winner's pick, and their row says what it took.
    if (added?.heal && !chronicle.healTie) {
        return [{ kind: 'step', text: `The Archive was short: ${healWords(added.heal)}.` }]
    }
    return []
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
function relicsWords(
    relics: ChronicleRelicsRecord,
    winnerId: string,
    state: HydratedOathGameState
): string {
    const returned = relics.returned.filter((entry) => entry.count > 0)
    const placedBy = new Map<number, string[]>()
    for (const { slotId, count } of relics.placed) {
        const site = state.siteCards[slotId] ?? slotId
        placedBy.set(count, [...(placedBy.get(count) ?? []), site])
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

function restRows(chronicle: Chronicle, state: HydratedOathGameState): ChronicleRow[] {
    const winnerId = chronicle.ending.winnerPlayerId
    return [
        chronicle.dispossessed !== undefined
            ? `Set ${plural(chronicle.dispossessed, 'card')} aside as the Dispossessed, unseen.`
            : undefined,
        chronicle.relics ? relicsWords(chronicle.relics, winnerId, state) : undefined,
        chronicle.rebuilt ? 'Rebuilt the world deck.' : undefined
    ].flatMap((text) => (text ? [{ kind: 'step' as const, text }] : []))
}

// ---------------------------------------------------------------------------------------------
// Where the rows go

/** The rows each action is followed by, oldest first, keyed by action id. */
export type ChronicleRowsAfter = ReadonlyMap<string, readonly ChronicleRow[]>

/**
 * R-8, in `writeChronicleFrom`'s order: the start and a forced Vow after the action that won; the
 * map after the last of the win, the Vow, the offers, the answers and the build; the cards added
 * after the suit's choice, else in the same place; the Dispossessed to the rebuild after the heal's
 * choice, else in the same place.
 */
export function chronicleRowsAfter(
    actions: readonly GameAction[],
    wonAt: number,
    state: HydratedOathGameState
): ChronicleRowsAfter {
    const chronicle = state.chronicle
    const rows = new Map<string, ChronicleRow[]>()
    if (!chronicle || wonAt < 0) return rows
    const lastOf = (from: number, matches: (action: GameAction) => boolean): number =>
        actions.findLastIndex((action, index) => index >= from && matches(action))
    const mapAt = Math.max(
        wonAt,
        lastOf(
            wonAt,
            (action) =>
                isChooseOath(action) ||
                isOfferChronicleCitizenship(action) ||
                isAnswerChronicleCitizenship(action) ||
                isBuildOrRepairEdifice(action)
        )
    )
    const suitAt = lastOf(wonAt, isChooseChronicleSuit)
    const addAt = suitAt >= 0 ? suitAt : mapAt
    const healAt = lastOf(wonAt, isChooseHealStack)
    const restAt = healAt >= 0 ? healAt : addAt

    const add = (at: number, more: readonly ChronicleRow[]) => {
        const id = actions[at].id
        rows.set(id, [...(rows.get(id) ?? []), ...more])
    }
    const { ending, vowedOath, vowedByVisionId } = chronicle
    add(wonAt, [
        {
            kind: 'begins',
            text: `${ending.winnerPlayerId} ${wonWords(ending.rule)}. The Chronicle begins.`
        }
    ])
    if (vowedOath !== undefined && vowedByVisionId !== undefined) {
        add(wonAt, [
            {
                kind: 'step',
                text: sworeWords(vowedOath, vowedByVisionId),
                actorId: ending.winnerPlayerId
            }
        ])
    }
    add(mapAt, mapRows(chronicle, state))
    add(addAt, addRows(chronicle, suitAt >= 0))
    add(restAt, restRows(chronicle, state))
    return rows
}

/**
 * The record's entries this game carried in, newest first: every entry but this game's own, which
 * is the last once its chronicle is written.
 */
export function carriedEntries(state: HydratedOathGameState): ChronicleEntry[] {
    const record = state.chronicleRecord ?? []
    return (chronicleWritten(state) ? record.slice(0, -1) : record).toReversed()
}

/** "won as Usurper, under the Oath of Supremacy." — a record row's words after its chip. */
export function recordRowWords(entry: ChronicleEntry): string {
    return `${wonWords(entry.rule)}, under the Oath of ${oathName(entry.startingOath)}.`
}
