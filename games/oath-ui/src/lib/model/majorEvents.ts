import {
    Banner,
    CardKind,
    OATHKEEPER_GOALS,
    SearchPlay,
    VISION_GOALS,
    VISIONS_DRAWN_GATE,
    VISIONS_DRAWN_SUPPLY_COST,
    endDieThreshold,
    isCampaign,
    isCampaignResolveVictory,
    isCampaignSacrifice,
    isCompleteRest,
    isExileCitizen,
    isPlayFacedownAdviser,
    isResolveCitizenshipOffer,
    isResolveOathkeeper,
    isResolveWake,
    isRollEndDie,
    isSearch,
    isSearchResolve,
    isSelfExile,
    isTransferOathkeeper,
    isUseActionPower,
    kindOf,
    worldDeckSearchCost,
    type Campaign,
    type OathType,
    type WinRule
} from '@tabletop/oath'
import type { GameAction } from '@tabletop/common'
import { bannerName, cardName, goalText, oathName } from '$lib/model/names.js'
import { searchStoppedOnVision, type NameOf } from '$lib/model/actionDescription.js'
import { ENDINGS, isWinRule } from '$lib/model/endings.js'
import { endDieRollWords } from '$lib/model/endOfRound.js'

export enum MajorEventKind {
    VisionDrawn = 'visionDrawn',
    VisionRevealed = 'visionRevealed',
    Oathkeeper = 'oathkeeper',
    Usurper = 'usurper',
    CitizenshipTaken = 'citizenshipTaken',
    CitizenshipLost = 'citizenshipLost',
    CampaignWon = 'campaignWon',
    CampaignLost = 'campaignLost',
    EndDie = 'endDie',
    GameEnd = 'gameEnd'
}

/** Only what the table may see: a card's face where it is public, else its back. */
export type EventPicture =
    | { kind: 'card'; cardId: string }
    | { kind: 'back'; cardKind: CardKind }
    | { kind: 'title'; usurper: boolean }
    | { kind: 'banner'; banner: Banner }
    | { kind: 'die'; value: number }

export interface MajorEvent {
    kind: MajorEventKind
    heading: string
    aside?: string
    tone: 'heading' | 'danger'
    pictures: EventPicture[]
    consequence?: string
}

export interface MajorEventContext {
    viewerId: string | undefined
    nameOf: NameOf
    oathType: OathType
    campaign?: Campaign
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th']
const TRACK_LAST = VISIONS_DRAWN_SUPPLY_COST.length - 1

function seat(playerId: string, context: MajorEventContext): string {
    return playerId === context.viewerId ? 'you' : context.nameOf(playerId)
}

function capitalized(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
}

function opponentOf(context: MajorEventContext): string | undefined {
    const defender = context.campaign?.defender
    if (!defender) return undefined
    return defender.kind === 'bandits' ? 'the bandits' : seat(defender.playerId, context)
}

/** R-2.1.6, R-3.2 — the world deck's cost steps at the first and third Vision, the third opening Vision wins. */
function searchCostLine(visionsDrawn: number): string | undefined {
    if (visionsDrawn < 1) return undefined
    const cost = worldDeckSearchCost(visionsDrawn)
    if (cost === worldDeckSearchCost(visionsDrawn - 1)) return undefined
    const gate = visionsDrawn === VISIONS_DRAWN_GATE ? ' · Visions can now win' : ''
    return `Search cost up: the world deck now costs ${cost} Supply${gate}`
}

/** R-9.4 — the drawer sees which Vision; everyone else sees its back. */
function drawnVisionPicture(cardId: string | undefined): EventPicture {
    return cardId ? { kind: 'card', cardId } : { kind: 'back', cardKind: CardKind.Vision }
}

function visionDrawnEvent(
    aside: string | undefined,
    seenCardId: string | undefined,
    consequence: string | undefined
): MajorEvent {
    return {
        kind: MajorEventKind.VisionDrawn,
        heading: 'Vision drawn',
        aside,
        tone: 'heading',
        pictures: [drawnVisionPicture(seenCardId)],
        consequence
    }
}

function oathLine(context: MajorEventContext): string {
    return `Oath of ${oathName(context.oathType)}: ${goalText(OATHKEEPER_GOALS[context.oathType])}`
}

function endDieEvent(
    roll: number,
    round: number | undefined,
    wonBy: string | undefined
): MajorEvent {
    const threshold = round === undefined ? undefined : endDieThreshold(round)
    const passes = threshold === undefined ? '' : `a ${endDieRollWords(threshold)}`
    const where = round === undefined ? '' : ` in round ${round}`
    const consequence =
        threshold === undefined || round === undefined
            ? wonBy
                ? 'The game ends'
                : undefined
            : `${passes} ends the game${where} · ${wonBy ? 'the game ends' : `play goes on to round ${round + 1}`}`
    return {
        kind: MajorEventKind.EndDie,
        heading: 'End die',
        aside: round === undefined ? undefined : `end of round ${round}`,
        tone: 'danger',
        pictures: [{ kind: 'die', value: roll }],
        consequence
    }
}

/** The major-event class (Vision, the title, Citizenship, a Campaign decided, the end die), from the record alone. */
export function majorEventOf(
    action: GameAction,
    context: MajorEventContext
): MajorEvent | undefined {
    const isActor = action.playerId !== undefined && action.playerId === context.viewerId
    if (isSearch(action) && searchStoppedOnVision(action)) {
        const visionsDrawn = action.metadata?.visionsDrawn ?? 0
        const drawn = action.metadata?.draw?.drawnCardIds
        const seen = isActor ? drawn?.at(-1) : undefined
        return visionDrawnEvent(
            `${ORDINALS[visionsDrawn - 1]} of ${TRACK_LAST}`,
            seen,
            searchCostLine(visionsDrawn)
        )
    }
    if (isUseActionPower(action) && action.metadata?.visionDrawn) {
        const reveal = action.metadata.reveal
        const seen = isActor && reveal?.kind === 'vision' ? reveal.cardId : undefined
        return visionDrawnEvent(undefined, seen, undefined)
    }
    if (
        (isSearchResolve(action) || isPlayFacedownAdviser(action)) &&
        action.play === SearchPlay.RevealedVision
    ) {
        const cardId =
            action.metadata?.playedCardId ??
            (isSearchResolve(action) ? action.metadata?.revealedKeptCardId : undefined)
        const goal = cardId ? VISION_GOALS[cardId] : undefined
        return {
            kind: MajorEventKind.VisionRevealed,
            heading: 'Vision revealed',
            tone: 'heading',
            pictures:
                cardId && kindOf(cardId) === CardKind.Vision ? [{ kind: 'card', cardId }] : [],
            consequence: goal ? `Goal: ${goalText(goal)}` : undefined
        }
    }
    if (isTransferOathkeeper(action) || isResolveOathkeeper(action)) {
        const vacated = isTransferOathkeeper(action) && action.toPlayerId === undefined
        return {
            kind: MajorEventKind.Oathkeeper,
            heading: 'Oathkeeper',
            tone: 'heading',
            pictures: [{ kind: 'title', usurper: false }],
            consequence: vacated ? 'Nobody holds the title' : oathLine(context)
        }
    }
    if (isResolveWake(action) && action.metadata?.flippedToUsurper) {
        const who = seat(action.playerId, context)
        const yours = isActor
        return {
            kind: MajorEventKind.Usurper,
            heading: 'Usurper',
            tone: 'heading',
            pictures: [{ kind: 'title', usurper: true }],
            consequence: `If ${who} still ${yours ? 'hold' : 'holds'} it at ${yours ? 'your' : 'their'} next Wake, ${who} ${yours ? 'win' : 'wins'}`
        }
    }
    if (isResolveCitizenshipOffer(action) && action.granted) {
        return {
            kind: MajorEventKind.CitizenshipTaken,
            heading: 'Citizenship taken',
            tone: 'heading',
            pictures: [],
            consequence: `${capitalized(seat(action.playerId, context))} ${isActor ? 'are' : 'is'} a Citizen of the Empire`
        }
    }
    if (isExileCitizen(action) || isSelfExile(action)) {
        const exiled = isExileCitizen(action) ? action.citizenPlayerId : action.playerId
        const isViewer = exiled === context.viewerId
        return {
            kind: MajorEventKind.CitizenshipLost,
            heading: 'Citizenship lost',
            tone: 'heading',
            pictures: [],
            consequence: `${capitalized(seat(exiled, context))} ${isViewer ? 'are' : 'is'} an Exile again`
        }
    }
    if (isCampaignResolveVictory(action)) {
        const meta = action.metadata
        const relics = meta?.relicsTaken ?? []
        const banners = meta?.bannersSeized ?? []
        const opponent = opponentOf(context)
        const gained = [...relics.map(cardName), ...banners.map((b) => `the ${bannerName(b)}`)]
        return {
            kind: MajorEventKind.CampaignWon,
            heading: 'Campaign won',
            aside: opponent ? `against ${opponent}` : undefined,
            tone: 'heading',
            pictures: [
                ...relics.map((cardId): EventPicture => ({ kind: 'card', cardId })),
                ...banners.map((banner): EventPicture => ({ kind: 'banner', banner }))
            ],
            consequence:
                gained.length === 0
                    ? undefined
                    : `${opponent ? `From ${opponent}` : 'Taken'}: ${gained.join(', ')}`
        }
    }
    if (isCampaignSacrifice(action) && action.metadata?.attackerVictorious === false) {
        const opponent = opponentOf(context)
        return {
            kind: MajorEventKind.CampaignLost,
            heading: 'Campaign lost',
            aside: opponent ? `against ${opponent}` : undefined,
            tone: 'danger',
            pictures: [],
            consequence: 'Nothing changed hands'
        }
    }
    if (isRollEndDie(action) && action.metadata) {
        return endDieEvent(action.metadata.roll, action.metadata.round, action.metadata.wonBy)
    }
    if (isCompleteRest(action) && action.metadata?.endDieRoll !== undefined) {
        const next = action.metadata.round
        return endDieEvent(
            action.metadata.endDieRoll,
            next === undefined ? undefined : next - 1,
            action.metadata.wonBy
        )
    }
    return undefined
}

export function campaignsBefore(actions: readonly GameAction[]): (Campaign | undefined)[] {
    let current: Campaign | undefined
    return actions.map((action) => {
        if (isCampaign(action)) current = action
        return current
    })
}

export interface HistoryRow {
    action: GameAction
    event?: MajorEvent
}

export function historyRows(
    actions: readonly GameAction[],
    context: Omit<MajorEventContext, 'campaign'>
): HistoryRow[] {
    const campaigns = campaignsBefore(actions)
    return actions
        .map((action, i) => ({
            action,
            event: majorEventOf(action, { ...context, campaign: campaigns[i] })
        }))
        .toReversed()
}

/** R-3 — the ending action's rule: the one action that recorded a win. */
export function endingRule(actions: readonly GameAction[]): WinRule | undefined {
    for (const action of actions.toReversed()) {
        const wonBy =
            isResolveWake(action) || isCompleteRest(action) || isRollEndDie(action)
                ? action.metadata?.wonBy
                : undefined
        if (wonBy !== undefined && isWinRule(wonBy)) return wonBy
    }
    return undefined
}

const VISION_ENDINGS: ReadonlySet<WinRule> = new Set(['R-3.2', 'R-3.4.3'])
const USURPER_ENDINGS: ReadonlySet<WinRule> = new Set(['R-3.1', 'R-3.4.2'])

export function gameEndEvent(
    winnerId: string,
    rule: WinRule,
    round: number,
    revealedVisionId: string | undefined,
    context: MajorEventContext
): MajorEvent & { sentence: string } {
    const picture: EventPicture =
        VISION_ENDINGS.has(rule) && revealedVisionId
            ? { kind: 'card', cardId: revealedVisionId }
            : { kind: 'title', usurper: USURPER_ENDINGS.has(rule) }
    const [how, why] = ENDINGS[rule].split(' — ')
    return {
        kind: MajorEventKind.GameEnd,
        heading: 'Game end',
        aside: `round ${round}`,
        tone: 'heading',
        pictures: [picture],
        sentence: `${capitalized(seat(winnerId, context))} won ${how}`,
        consequence: why ? capitalized(why) : undefined
    }
}
