import {
    ActionType,
    ConsentRequestKind,
    LetPeekSubjectKind,
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
    cardPower,
    type AnswerConsentMetadata,
    type CampaignBattleMetadata,
    type CampaignTarget,
    Suit,
    type LetPeek,
    type Search,
    type UseActionPower,
    type UseRestPower,
    type WarbandMove,
    type WarbandOwner
} from '@tabletop/oath'
import { assertExists, type GameAction } from '@tabletop/common'
import {
    bannerName,
    campaignTargetText,
    cardName,
    plural,
    reliquaryLabel,
    nameIds,
    stripRules,
    suitName,
    warbandsOf
} from '$lib/model/names.js'
import {
    actorOnlyOutcome,
    mergedPilesOf,
    pileDepositsOf,
    type PileDeposit
} from '$lib/model/actionOutcomes.js'

// Past tense with no leading capital or possessive about the actor: `PlayerName` renders "You" first.
// R-9.4 — a card is named only where the game showed it, recorded as `playedCardId`.

export type NameOf = (playerId: string) => string

/** How a history line names a player and a site; a site by its printed name once faceup. */
export type HistoryNames = { player: NameOf; site: (slotId: string) => string }

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

/** The seat a row is about: the actor, or for the title's move the seat that took or lost it. */
export function rowActorOf(action: GameAction): string | undefined {
    if (isTransferOathkeeper(action)) return action.toPlayerId ?? action.fromPlayerId
    return action.playerId
}

/** R-10.13 — whose warbands a row counts: those a move names, the seat a power acted on, else the actor's own. */
export function rowWarbandOwner(
    action: GameAction,
    ownWarbandsOf: (playerId: string) => WarbandOwner
): WarbandOwner | undefined {
    if (isMoveWarbands(action)) return action.owner
    const seat =
        (isUseActionPower(action) || isUseRestPower(action)
            ? action.metadata?.targetPlayerId
            : undefined) ?? action.playerId
    return seat === undefined ? undefined : ownWarbandsOf(seat)
}

export function describeAction(action: GameAction, names: HistoryNames, viewerId?: string): string {
    return nameIds(
        stripRules(describeActionCited(action, names, viewerId) + outcomeClauses(action, viewerId)),
        names.site
    )
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

function describeActionCited(
    action: GameAction,
    names: HistoryNames,
    viewerId: string | undefined
): string {
    const nameOf = names.player
    if (isSetupChoice(action)) {
        // R-1.23.2 keeps the adviser facedown, so it is never named.
        const pile = action.metadata?.discardPileRegion
        return (
            `placed a pawn at ${names.site(action.siteId)} and kept one card facedown` +
            (pile ? `, discarding two to the ${pile} pile` : '')
        )
    }
    if (isTravel(action)) {
        const meta = action.metadata
        const revealed = meta?.revealedSiteCardId
            ? ` — revealing ${cardName(meta.revealedSiteCardId)}` +
              ((meta.relicsRevealed ?? 0) > 0
                  ? ` and ${plural(meta.relicsRevealed ?? 0, 'facedown relic')}`
                  : '')
            : ''
        // R-11.7 — the Shrouded Wood's ruler names the site in their answer.
        if (action.siteId === undefined) {
            const chooser = meta?.destinationChooser
            return `left the Shrouded Wood${supply(meta?.supplySpent)} — ${chooser ? nameOf(chooser) : 'its ruler'} chooses where`
        }
        return `travelled to ${names.site(action.siteId)}${supply(meta?.supplySpent)}${revealed}`
    }
    if (isMuster(action)) {
        const meta = action.metadata
        return (
            `mustered at ${cardName(action.cardId)}` +
            (meta ? `, gaining ${meta.warbandsGained} warbands` : '') +
            supply(meta?.supplySpent)
        )
    }
    if (isTrade(action)) {
        const meta = action.metadata
        const gained =
            (meta?.favorGained ?? 0) > 0
                ? `${meta?.favorGained} favor`
                : `${meta?.secretsGained ?? 0} secrets`
        return `traded at ${cardName(action.cardId)} for ${gained}${supply(meta?.supplySpent)}`
    }
    if (isSearch(action)) {
        const from =
            action.drawFrom === SearchSource.WorldDeck ? 'the world deck' : 'their region’s discard'
        const shown = action.metadata?.revealedDraw
        return (
            `searched ${from}${supply(action.metadata?.supplySpent)}` +
            (shown ? `, showing ${shown.map(cardName).join(', ')} (Truthful Harp)` : '') +
            (searchStoppedOnVision(action) ? '; the draw stopped on a Vision' : '')
        )
    }
    if (isSearchResolve(action)) {
        const kept = action.metadata?.playedCardId ?? action.metadata?.revealedKeptCardId
        return `kept ${shownCard(kept)} and ${describePlay(action.play)}`
    }
    if (isRecover(action)) {
        return action.target.kind === RecoverTargetKind.Banner
            ? `recovered the ${bannerName(action.target.banner)} for ${action.amountPaid}`
            : `recovered a relic at their site${supply(action.metadata?.supplySpent)}`
    }
    if (isCampaign(action)) {
        const against =
            action.defender.kind === 'bandits' ? 'the bandits' : nameOf(action.defender.playerId)
        const targets = action.targets
            .map((target) => describeTarget(target, names.site))
            .join(', ')
        const declared = `campaigned against ${against}${targets ? ` for ${targets}` : ''}`
        // R-5.5.2.a — nothing is rolled until the Citizens asked have answered.
        if (action.metadata?.awaitingAllies)
            return `${declared} — Citizens are asked to join the defence`
        return `${declared} — ${describeBattle(action.metadata?.battle)}`
    }
    if (isCampaignAttackPlans(action)) {
        return `chose the attacking battle plans — ${describeBattle(action.metadata?.battle)}`
    }
    if (isUseRestPower(action)) {
        return `rested with ${cardName(action.cardId)}${powerEffect(action, nameOf, viewerId)}`
    }
    if (isCampaignDefend(action)) {
        const meta = action.metadata
        const used = meta?.plansUsed ?? []
        return (
            (used.length > 0
                ? `used ${used.join(', ')} and rolled`
                : 'used no battle plans and rolled') +
            ` — ${meta?.swords ?? 0} swords against ${meta?.defense ?? 0} defence`
        )
    }
    if (isCampaignSacrifice(action)) {
        const chooser = action.metadata?.awaitingLossesOf
        return (
            `sacrificed ${action.metadata?.sacrificed ?? action.sacrifice} warbands and ` +
            (action.metadata?.attackerVictorious ? 'won the battle' : 'lost the battle') +
            (chooser ? ` — ${nameOf(chooser)} chooses the defending side's losses` : '')
        )
    }
    if (isCampaignDefeatKills(action)) {
        return `chose the defending side's losses, ${plural(action.metadata?.defeatKilled ?? 0, 'warband')} killed`
    }
    if (isCampaignResolveVictory(action)) {
        const meta = action.metadata
        const taken = meta?.relicsTaken ?? []
        const seized = (meta?.bannersSeized ?? []).map((banner) => `the ${bannerName(banner)}`)
        const gains = [
            ...(taken.length > 0 ? [`taking ${taken.join(', ')}`] : []),
            ...(seized.length > 0 ? [`seizing ${seized.join(' and ')}`] : [])
        ]
        return (
            'took the spoils' +
            (gains.length > 0 ? `, ${gains.join(' and ')}` : '') +
            ((meta?.favorBurned ?? 0) > 0 ? `, burning ${meta?.favorBurned} favor` : '')
        )
    }
    if (isPlayFacedownAdviser(action)) {
        // R-6.1 plays the adviser faceup, which shows it, or discards it, which does not.
        return describeAdviserPlay(action.play, shownCard(action.metadata?.playedCardId))
    }
    if (isUseActionPower(action)) {
        return (
            `used ${cardName(action.cardId)}` +
            printedCost(action.cardId, action.powerIndex) +
            powerEffect(action, nameOf, viewerId)
        )
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
        return `offered ${nameOf(action.exilePlayerId)} Citizenship for the relic on ${reliquaryLabel(action.reliquarySlotId)}`
    }
    if (isResolveCitizenshipOffer(action)) {
        const unreplaced = action.metadata?.outcome?.unreplacedCount ?? 0
        return action.granted
            ? 'accepted Citizenship' +
                  (unreplaced > 0
                      ? `, removing ${unreplaced} warbands for want of Imperial ones`
                      : '')
            : 'refused Citizenship'
    }
    if (isAnswerQuestion(action)) {
        const meta = action.metadata
        return meta ? `${cardName(meta.cardId)}: ${meta.summary}` : 'answered a question'
    }
    if (isExileCitizen(action)) {
        // R-6.7 — the exiler pays the Citizen they throw out; R-9.3's leftover Imperial warbands are worth a clause.
        const meta = action.metadata
        return (
            `exiled ${nameOf(action.citizenPlayerId)}` +
            ((meta?.favorGiven ?? 0) > 0 ? `, giving them ${meta?.favorGiven} favor` : '') +
            ((meta?.unreplacedCount ?? 0) > 0
                ? `, with ${meta?.unreplacedCount} warbands left Imperial`
                : '')
        )
    }
    if (isSelfExile(action)) {
        const meta = action.metadata
        return (
            'went into exile' +
            ((meta?.favorGiven ?? 0) > 0
                ? `, giving ${meta?.favorGiven} favor to the Grand Scepter’s holder`
                : '') +
            ((meta?.unreplacedCount ?? 0) > 0
                ? `, with ${meta?.unreplacedCount} warbands left Imperial`
                : '')
        )
    }
    if (isResolveWake(action)) {
        // R-4.1.3's Usurper flip decides R-3.1 at the next Wake.
        return (
            'began the turn' +
            (action.metadata?.flippedToUsurper
                ? ' — the Oathkeeper title flipped to Usurper'
                : '') +
            (action.metadata?.flippedToMob ? ' — the People’s Favor flipped to Mob' : '')
        )
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
            (action.metadata?.endedRound ? ' — the round ended' : '')
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

/** The engine's summary, without the card's name it repeats, with seats and banks named. */
function powerEffect(
    action: UseActionPower | UseRestPower,
    nameOf: NameOf,
    viewerId: string | undefined
): string {
    const summary = action.metadata?.summary
    if (!summary) return ''
    const prefix = `${cardName(action.cardId)}: `
    const effect = summary.startsWith(prefix) ? summary.slice(prefix.length) : summary
    const seats = [action.metadata?.targetPlayerId, action.playerId].filter(
        (playerId): playerId is string => playerId !== undefined
    )
    const named = seats.reduce(
        (text, playerId) => nameSeat(text, playerId, action.playerId, viewerId, nameOf),
        effect
    )
    return `: ${namedBanks(named)}`
}

function nameSeat(
    text: string,
    playerId: string,
    actorId: string,
    viewerId: string | undefined,
    nameOf: NameOf
): string {
    const id = playerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const possessive = new RegExp(`(?<![\\w-])${id}['’]s(?![\\w-])`, 'g')
    const bare = new RegExp(`(?<![\\w-])${id}(?![\\w-])`, 'g')
    const own = playerId === actorId
    const isViewer = playerId === viewerId
    const whose = own
        ? isViewer
            ? 'your own'
            : 'their own'
        : isViewer
          ? 'your'
          : `${nameOf(playerId)}'s`
    return text.replace(possessive, whose).replace(bare, isViewer ? 'you' : nameOf(playerId))
}

function namedBanks(text: string): string {
    return Object.values(Suit).reduce(
        (named, suit) => named.replaceAll(`the ${suit} bank`, `the ${suitName(suit)} bank`),
        text
    )
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

function describeBattle(battle: CampaignBattleMetadata | undefined): string {
    return (
        `${battle?.swords ?? 0} swords against ${battle?.defense ?? 0} defence` +
        ((battle?.skullsKilled ?? 0) > 0 ? `, losing ${battle?.skullsKilled} to skulls` : '')
    )
}

// R-6.5.a, R-6.5.b, R-5.5.2.a — the answer names what was asked of the answering player.
function describeConsentAnswer(
    meta: AnswerConsentMetadata | undefined,
    granted: boolean,
    nameOf: NameOf
): string {
    const asker = meta ? nameOf(meta.askingPlayerId) : 'the asking player'
    const battle = meta?.battle ? ` — ${describeBattle(meta.battle)}` : ''
    switch (meta?.kind) {
        case ConsentRequestKind.JoinDefence:
            return (granted ? 'asked to join the defence' : 'stayed out of the battle') + battle
        case ConsentRequestKind.AdmitAlly:
            return (
                (granted
                    ? `admitted ${asker} to the defence`
                    : `kept ${asker} out of the defence`) + battle
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
