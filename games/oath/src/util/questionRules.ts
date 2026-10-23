import { assert, assertExists } from '@tabletop/common'
import { burnFavor } from './burn.js'
import { gainFavorFromBank, giveFavor, spendFavor, usableFavor } from './favor.js'
import { HydratedOathGameState, discardRegionFor } from '../model/gameState.js'
import { SearchPlay } from '../model/oathEnums.js'
import {
    PowerQuestionKind,
    RerolledRollKind,
    type RerolledRoll,
    type ShroudedWoodPick,
    type ShroudedWoodTravel
} from '../model/question.js'
import { offerReroll, settleRoll } from './reroll.js'
import { CONSPIRACY_ID } from '../data/cardRegistry.js'
import { cardPowers, type CardPower, type PowerUseKey } from '../data/cardPowers.js'
import { payPowerCost, reasonCannotPayPowerCost } from './powerCost.js'
import { pawnSiteId, regionOfPawn } from './pawn.js'
import type { SiteFlip } from './hiddenInputs.js'
import { defenseShieldsFromFaces, rollDefenseShields } from '../data/dice.js'
import {
    playCard,
    playConspiracy,
    reasonCannotPlayCard,
    reasonCannotPlayConspiracy
} from './cardPlay.js'
import { discardCards, isInPlay } from './discard.js'
import { discardFromPlayInChosenOrder } from './orderedDiscard.js'
import { rulesCard } from './access.js'
import { applyAttackRoll, applyDefenseRoll } from './campaignRoll.js'
import { rollAttackDice, rollDefenseDice } from '../data/dice.js'
import {
    takeNotes,
    takeRelics,
    takeRelicsFrom,
    releaseRelic,
    clearReliquarySlot
} from './relics.js'
import { askQuestion } from './questions.js'
import type { QuestionRules } from './questionAnswers.js'
import {
    discardAdvisersToMeetLimit,
    reasonAdviserLimitDiscardsInvalid,
    settleAdviserLimitsAfterExchange
} from './adviserLimit.js'
import {
    GATHERING_ALLOWS,
    applyExchange,
    openDealFrom,
    reasonExchangeInvalid,
    reasonTermsOutsideCard
} from './exchange.js'
import { answerDealKept, reasonDealKeptInvalid } from './deals.js'
import { GRAND_SCEPTER_ID, OBSIDIAN_CAGE_ID } from '../data/relics.js'
import { returnWarbandsOnCardToBanks } from './force.js'
import {
    cagedGroupsToBoards,
    cageReturnsToBoards,
    cageWentBackSummary,
    reasonCagePlacementInvalid,
    returnCagedWarbands
} from './obsidianCage.js'
import { powerTravelFlipsNeeded, reasonCannotTravelByPower, travelByPower } from './powerTravel.js'
import {
    gainOnArrival,
    reasonWoodPickRefused,
    reasonWoodStayRefused,
    settleWoodPick,
    shroudedWoodDestinations,
    wayStationChoiceAt,
    type WoodSettle,
    type WoodTravel
} from './shroudedWood.js'
import { settleBanishedVictory } from './campaignVictory.js'
import {
    askPowerMoveToll,
    canPayPowerMoveToll,
    giveWhistleSecret,
    powerMoveToll,
    settlePowerMoveFlip,
    settlePowerMoveToll,
    whistleUserOnArrival
} from './powerMoveTolls.js'
import { payToll } from './tolls.js'
import { payFromHomeBank, reasonCannotPayFromHomeBank } from './homeBankPayment.js'
import { flipSecretFacedown, reasonFlipInvalid, secretsFlipped } from './siteTravel.js'
import { gainFromDrum, reasonDrumBankEmpty } from './dragonskinDrum.js'
import { PowerMoveKind, PowerMoveTollOutcome } from '../model/powerMoveToll.js'
import { forgoFreeActionNow } from './freeActions.js'
import {
    endStepOutOfTurn,
    endTravelOutOfTurn,
    holdTurnForSkippedFreeAction
} from './sneakAttack.js'
import { relicKnownToOthers } from './knowledge.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'

/**
 * The Travel out of a Shrouded Wood has landed. Second Wind out of turn judges its free Campaign
 * from here and ends nothing else; in the traveller's own turn a declared Special Envoy ends their
 * Act Phase (R-11.7-H2), as on any Travel.
 */
function woodTravelLanded(
    state: HydratedOathGameState,
    travelerId: string,
    endsActPhase: boolean
): { resumeMachineState?: MachineState } {
    if (state.heldTurn !== undefined) return endTravelOutOfTurn(state, travelerId)
    if (!endsActPhase) return {}
    if (state.pendingQuestions) state.pendingQuestions.resumeMachineState = MachineState.RestPhase
    return { resumeMachineState: MachineState.RestPhase }
}

interface WoodArrival {
    travelerId: string
    siteId: string
    travel: ShroudedWoodTravel
    /** The Shrouded Wood's ruler, who picked the site. */
    chooserId: string
    askingPlayerId: string
}

/** The pick has landed the traveller: what it records, and how the step goes on. */
interface WoodLanding {
    pick: ShroudedWoodPick
    revealed?: SiteFlip
    landed: { resumeMachineState?: MachineState }
}

/**
 * R-11.7, R-11.7-H2 — the traveller pays and arrives (`settleWoodPick`); then a declared
 * Hospitality's bank: one is gained unasked (the question's forced outcome, noted with the pick),
 * and with two or more the traveller is asked, and the Travel lands with their answer.
 */
function landFromWood(
    state: HydratedOathGameState,
    travelerId: string,
    siteId: string,
    travel: WoodTravel,
    settle: WoodSettle,
    askingPlayerId: string
): WoodLanding {
    const settled = settleWoodPick(state, travelerId, siteId, travel, settle)
    const { revealed, endsActPhase, bankOnArrival } = settled
    let pick = settled.pick
    if (bankOnArrival) {
        const forced = askQuestion(
            state,
            askingPlayerId,
            {
                kind: PowerQuestionKind.HospitalityBank,
                ...bankOnArrival.card,
                askedPlayerId: travelerId,
                siteId,
                banks: bankOnArrival.banks,
                ...(endsActPhase ? { endsActPhase: true as const } : {})
            },
            true
        )
        if (forced === undefined) return { pick, revealed, landed: {} }
        pick = { ...pick, notes: [...(pick.notes ?? []), forced] }
    }
    return { pick, revealed, landed: woodTravelLanded(state, travelerId, endsActPhase) }
}

/**
 * R-11.7, R-11.7-H3 — the ruler's pick for the traveller's own Travel lands, any Toll Roads toll
 * paid: Way Station's favor is asked when the traveller could pay either way, given unasked when
 * only it is open, and otherwise the Supply is paid. Undefined: the Way Station question waits.
 */
function arriveFromWood(
    state: HydratedOathGameState,
    { travelerId, siteId, travel, chooserId, askingPlayerId }: WoodArrival
): WoodLanding | undefined {
    const station = wayStationChoiceAt(state, travelerId, siteId, travel)
    if (station?.supplyPayable) {
        const forced = askQuestion(
            state,
            askingPlayerId,
            {
                kind: PowerQuestionKind.WayStationFavor,
                cardId: station.toll.cardId,
                askedPlayerId: travelerId,
                payeeId: station.toll.payeeId,
                chooserPlayerId: chooserId,
                fromSiteId: pawnSiteId(state, travelerId),
                siteId,
                supplyCost: station.supplyCost,
                travel
            },
            true
        )
        assert(
            forced === undefined,
            'Way Station is asked only of a traveller who can give the favor'
        )
        return undefined
    }
    return landFromWood(
        state,
        travelerId,
        siteId,
        travel,
        { favorInstead: station?.toll },
        askingPlayerId
    )
}

function listOf(id: string | undefined): string[] {
    return id === undefined ? [] : [id]
}

/** Fae Merchant — "any relic you hold except the Grand Scepter", besides the one drawn. */
export function heldRelicsToBottom(state: HydratedOathGameState, playerId: string): string[] {
    return state.getPlayerState(playerId).relicIds.filter((id) => id !== GRAND_SCEPTER_ID)
}

function isPermutationOf(order: readonly number[], count: number): boolean {
    const seen = new Set(order)
    return (
        order.length === count &&
        seen.size === count &&
        order.every((position) => Number.isInteger(position) && position >= 0 && position < count)
    )
}

function reasonCannotUsePowerToReroll(
    state: HydratedOathGameState,
    playerId: string,
    question: PowerUseKey
): string | undefined {
    const power = cardPowers(question.cardId)[question.powerIndex]
    return power ? reasonCannotPayPowerCost(state, playerId, power) : 'the power is not in play'
}

/** Jinx — "reroll all those dice once": the same dice, rolled again (the doubling faces multiply anew). */
function rerollStanding(
    state: HydratedOathGameState,
    roll: Exclude<RerolledRoll, { kind: RerolledRollKind.Campaign }>
): Exclude<RerolledRoll, { kind: RerolledRollKind.Campaign }> {
    const prng = state.getProtectedPrng()
    if (roll.kind === RerolledRollKind.GamblingHallDice) {
        const faces = rollDefenseDice(prng, roll.faces.length)
        return { ...roll, faces, shields: defenseShieldsFromFaces(faces) }
    }
    const dice = roll.kind === RerolledRollKind.GamblingHall ? 4 : roll.relicCardIds.length
    return { ...roll, shields: rollDefenseShields(prng, dice) }
}

function powerForQuestion(state: HydratedOathGameState, question: PowerUseKey): CardPower {
    const power = cardPowers(question.cardId)[question.powerIndex]
    assertExists(power, `${question.cardId} power ${question.powerIndex} is not in play`)
    return power
}

export const QUESTION_RULES: { [K in PowerQuestionKind]: QuestionRules<K> } = {
    [PowerQuestionKind.BurnFavorForSecrets]: {
        reasonCannotAnswer: (state, playerId, matched) => {
            const favor = matched.answer.favor
            if (!Number.isInteger(favor) || favor < 0)
                return 'the favor to burn must be a whole number'
            const usable = usableFavor(state, playerId)
            if (favor > usable) return `you have ${usable} favor, not ${favor}`
            return undefined
        },
        apply: (state, playerId, matched, asked) => {
            const favor = matched.answer.favor
            // R-10.4, R-9.3 — secrets are unlimited.
            spendFavor(state, playerId, favor)
            burnFavor(state, favor)
            asked.secrets += favor
            return favor > 0 ? `burned ${favor} favor for ${favor} secrets` : 'burned no favor'
        }
    },
    [PowerQuestionKind.PayOrLoseRelic]: {
        reasonCannotAnswer: (state, playerId, matched) => {
            const usable = usableFavor(state, playerId)
            if (matched.answer.pay && usable < matched.question.price) {
                return `paying takes ${matched.question.price} favor and you have ${usable}`
            }
            return undefined
        },
        apply: (state, playerId, matched) => {
            const { price, takerPlayerId, relicCardId } = matched.question
            if (matched.answer.pay) {
                giveFavor(state, playerId, takerPlayerId, price)
                return `paid ${price} favor to keep ${relicCardId}`
            }
            const notes = takeRelicsFrom(state, playerId, takerPlayerId, [relicCardId])
            return `let ${takerPlayerId} take ${relicCardId}${takeNotes(notes)}`
        }
    },
    [PowerQuestionKind.PickFavorBank]: {
        reasonCannotAnswer: (state, _playerId, matched) => {
            const suit = matched.answer.suit
            if (state.favorBank[suit] <= 0) return `the ${suit} bank has no favor`
            return undefined
        },
        apply: (state, playerId, matched) => {
            const suit = matched.answer.suit
            const gained = gainFavorFromBank(state, playerId, suit, matched.question.amount)
            return `gained ${gained} favor from the ${suit} bank`
        }
    },
    [PowerQuestionKind.Exchange]: {
        reasonCannotAnswer: (state, _playerId, matched) => {
            if (!matched.answer.accept) return undefined
            const { proposerPlayerId, askedPlayerId, terms } = matched.question
            return reasonExchangeInvalid(state, proposerPlayerId, askedPlayerId, terms)
        },
        apply: (state, playerId, matched) => {
            const { cardId, proposerPlayerId, terms } = matched.question
            if (!matched.answer.accept) return `refused ${proposerPlayerId}'s exchange`
            const applied = applyExchange(state, proposerPlayerId, playerId, terms)
            settleAdviserLimitsAfterExchange(state, proposerPlayerId, cardId, applied.advisersMoved)
            // R-7.6.3-H1 — a promise accepted opens a public deal; the summary quotes none.
            const openedDeal = openDealFrom(state, proposerPlayerId, playerId, terms)
            if (openedDeal) state.openDeals = [...(state.openDeals ?? []), openedDeal]
            return {
                summary: `accepted ${proposerPlayerId}'s exchange`,
                disclosed: applied.disclosed,
                // R-2.11-H1 — each binding exchange is its own moment for the title.
                titleMoment: true,
                openedDeal
            }
        }
    },
    [PowerQuestionKind.JoinSite]: {
        reasonCannotAnswer: () => undefined,
        apply: (_state, _playerId, matched, asked) => {
            const { siteId } = matched.question
            if (!matched.answer.join) return `stayed away from ${siteId}`
            asked.siteId = siteId
            return `put their pawn at ${siteId}`
        }
    },
    [PowerQuestionKind.GatheringFloor]: {
        reasonCannotAnswer: (state, playerId, matched) => {
            const proposal = matched.answer.proposal
            if (!proposal) return undefined
            if (proposal.withPlayerId === playerId) return 'you cannot exchange with yourself'
            if (state.findPlayerState(proposal.withPlayerId)?.siteId !== matched.question.siteId) {
                return `${proposal.withPlayerId} is not at ${matched.question.siteId}`
            }
            return (
                reasonTermsOutsideCard(proposal.terms, GATHERING_ALLOWS) ??
                reasonExchangeInvalid(state, playerId, proposal.withPlayerId, proposal.terms)
            )
        },
        apply: (state, playerId, matched, _asked, askingPlayerId) => {
            const proposal = matched.answer.proposal
            if (!proposal) return 'proposed nothing'
            askQuestion(
                state,
                askingPlayerId,
                {
                    kind: PowerQuestionKind.Exchange,
                    cardId: matched.question.cardId,
                    askedPlayerId: proposal.withPlayerId,
                    proposerPlayerId: playerId,
                    terms: proposal.terms
                },
                true
            )
            return `proposed an exchange to ${proposal.withPlayerId}`
        }
    },
    [PowerQuestionKind.KeepOrBottomRelic]: {
        reasonCannotAnswer: () => undefined,
        apply: (state, _playerId, matched, asked) => {
            const { relicCardId, seenBy } = matched.question
            if (matched.answer.keep) {
                const summary = `took ${relicCardId}${takeNotes(takeRelics(state, asked.playerId, [relicCardId]))}`
                // R-X.3(c) — the kept relic is shown to the table: from revision 17 the keep
                // reveals it, unless every other player knew it already.
                const disclosed =
                    isAtLeastOathRevision(state, OathRevision.EngineFixes13) &&
                    !relicKnownToOthers(state, seenBy, asked.playerId)
                return disclosed ? { summary, disclosed } : summary
            }
            return {
                summary: 'put the relic on the bottom of the relic deck',
                relicToDeckBottom: relicCardId
            }
        }
    },
    [PowerQuestionKind.BottomRelic]: {
        reasonCannotAnswer: (state, playerId, matched) => {
            const { heldRelicCardId: held, cagePlacement } = matched.answer
            if (held !== undefined && !heldRelicsToBottom(state, playerId).includes(held)) {
                return held === GRAND_SCEPTER_ID
                    ? 'the Grand Scepter cannot go to the bottom'
                    : `you do not hold ${held}`
            }
            if (held === OBSIDIAN_CAGE_ID) return reasonCagePlacementInvalid(state, cagePlacement)
            return cagePlacement === undefined
                ? undefined
                : 'only the Obsidian Cage sent down places warbands'
        },
        apply: (state, _playerId, matched, asked) => {
            const { relicCardId } = matched.question
            const held = matched.answer.heldRelicCardId
            // R-9.4 — a relic sent down unkept was never shown; a held one was public already.
            if (held === undefined) {
                return {
                    summary: 'put the drawn relic on the bottom of the relic deck',
                    relicToDeckBottom: relicCardId
                }
            }
            const notes = takeRelics(state, asked.playerId, [relicCardId])
            releaseRelic(state, asked.playerId, held)
            const summary = `took ${relicCardId} and put ${held} on the bottom of the relic deck${takeNotes(notes)}`
            // R-10.13-H1 — from revision 17 (R-X.4) the Cage's warbands go back to boards, as its
            // Action moves them (its Q&A); before it, as every card leaving play, to their banks.
            if (held === OBSIDIAN_CAGE_ID && cageReturnsToBoards(state)) {
                const groups = cagedGroupsToBoards(state, matched.answer.cagePlacement)
                const wentBack = cageWentBackSummary(returnCagedWarbands(state, groups))
                return {
                    summary: wentBack ? `${summary}; ${wentBack}` : summary,
                    relicToDeckBottom: held
                }
            }
            returnWarbandsOnCardToBanks(state, held)
            return { summary, relicToDeckBottom: held }
        }
    },
    [PowerQuestionKind.TakeOrLeaveRelic]: {
        reasonCannotAnswer: () => undefined,
        apply: (state, _playerId, matched, asked) => {
            const { relicCardId, slotId } = matched.question
            if (!matched.answer.take) return 'left the relic in the Reliquary'
            clearReliquarySlot(state, slotId)
            const notes = takeRelics(state, asked.playerId, [relicCardId])
            return {
                summary: `took ${relicCardId} from the Reliquary${takeNotes(notes)}`,
                relicTakenFromSlotId: slotId
            }
        }
    },
    [PowerQuestionKind.PlayOrDiscardConspiracy]: {
        reasonCannotAnswer: (state, playerId, matched) => {
            const { play, conspiracy, facedown, discardedAdviserCardId } = matched.answer
            if (facedown) {
                if (!play) return 'played facedown, the Conspiracy is played, not discarded'
                if (conspiracy)
                    return 'the take comes only with the Conspiracy played faceup (R-5.1.4.IV)'
                // R-5.1.4-H1 — a facedown adviser, judged as a Search's kept card would be.
                return reasonCannotPlayCard(state, playerId, CONSPIRACY_ID, SearchPlay.Adviser, {
                    faceUp: false,
                    discardedAdviserCardIds: listOf(discardedAdviserCardId)
                })
            }
            if (discardedAdviserCardId !== undefined)
                return 'an adviser is discarded only to play the Conspiracy facedown'
            if (!play) return undefined
            return reasonCannotPlayConspiracy(state, playerId, {
                keptCardId: CONSPIRACY_ID,
                conspiracy
            })
        },
        apply: (state, playerId, matched) => {
            const { play, conspiracy, facedown, discardedAdviserCardId } = matched.answer
            const holder = state.getPlayerState(matched.question.holderPlayerId)
            holder.removeAdviser(CONSPIRACY_ID)
            if (facedown) {
                // R-5.1.4-H1 — to the finder's advisers, facedown; the table saw which card it is.
                const region = regionOfPawn(state, playerId)
                const played = playCard(
                    state,
                    playerId,
                    CONSPIRACY_ID,
                    SearchPlay.Adviser,
                    region,
                    {
                        faceUp: false,
                        seen: true,
                        discardedAdviserCardIds: listOf(discardedAdviserCardId)
                    }
                )
                const summary = 'played the Conspiracy as an adviser, facedown'
                if (played.discarded.length === 0) return summary
                return {
                    summary,
                    discardedCardIds: played.discarded,
                    discardPileRegion: discardRegionFor(region)
                }
            }
            if (play) {
                // R-5.1.4.IV — played faceup by the finder, then to the box.
                playConspiracy(state, playerId, CONSPIRACY_ID, conspiracy)
                return `played the Conspiracy${conspiracy ? ` and took from ${conspiracy.targetPlayerId}` : ''}`
            }
            const region = regionOfPawn(state, playerId)
            discardCards(state, playerId, [CONSPIRACY_ID], region)
            return {
                summary: 'discarded the Conspiracy',
                discardedCardIds: [CONSPIRACY_ID],
                discardPileRegion: discardRegionFor(region)
            }
        }
    },
    [PowerQuestionKind.ShroudedWoodDestination]: {
        reasonCannotAnswer: (state, _playerId, matched) => {
            const { travelerPlayerId, fromSiteId, travel } = matched.question
            const { siteId, stay } = matched.answer
            if (stay && siteId !== undefined) {
                return `name a site or keep ${travelerPlayerId} in place, not both`
            }
            // R-11.7-H2 — kept in place only when nothing is payable without the declared cards.
            if (stay) return reasonWoodStayRefused(state, travelerPlayerId, travel)
            if (siteId === undefined) return `name the site ${travelerPlayerId} travels to`
            // R-11.7 — the traveller's own Travel goes only where they can pay.
            if (travel) return reasonWoodPickRefused(state, travelerPlayerId, siteId, travel)
            // R-11.7-H1 — after the Brass Horse, only among the sites its suit allows (its Q&A).
            const allowed = matched.question.power?.siteIds
            if (allowed && !allowed.includes(siteId)) {
                return `${siteId} is not one of the sites the Brass Horse named`
            }
            return shroudedWoodDestinations(state, travelerPlayerId, fromSiteId).includes(siteId)
                ? undefined
                : `${siteId} is not a site ${travelerPlayerId} can be sent to`
        },
        apply: (state, playerId, matched, _asked, askingPlayerId) => {
            const { travelerPlayerId, fromSiteId, travel, power } = matched.question
            const siteId = matched.answer.siteId
            if (siteId === undefined) {
                // R-11.7-H2 — the Travel is spent and its cards stay paid; no Supply is spent.
                return {
                    summary: `kept ${travelerPlayerId} at ${fromSiteId}`,
                    woodStay: { travelerPlayerId, siteId: fromSiteId },
                    ...endTravelOutOfTurn(state, travelerPlayerId)
                }
            }
            const toll = powerMoveToll(state, travelerPlayerId, siteId)
            if (travel && toll) {
                // R-11.7, Toll Roads — the toll is asked before any Supply: paid, the Travel settles.
                const move = {
                    move: PowerMoveKind.ShroudedWood,
                    moverPlayerId: playerId,
                    movedPlayerId: travelerPlayerId,
                    toSiteId: siteId,
                    travel
                }
                const tollMove = askPowerMoveToll(state, move, toll, askingPlayerId, true)
                assert(
                    tollMove.outcome === PowerMoveTollOutcome.Asked,
                    'The ruler picks only a site whose toll the traveller can pay'
                )
                return { summary: `chose ${siteId} for ${travelerPlayerId}`, tollMove }
            }
            if (travel) {
                const arrived = arriveFromWood(state, {
                    travelerId: travelerPlayerId,
                    siteId,
                    travel,
                    chooserId: playerId,
                    askingPlayerId
                })
                if (arrived === undefined) return `chose ${siteId} for ${travelerPlayerId}`
                const { pick, revealed, landed } = arrived
                const notes = pick.notes ?? []
                const summary = `sent ${travelerPlayerId} to ${siteId}, who paid ${pick.supplySpent} Supply${notes.length ? ` (${notes.join('; ')})` : ''}`
                return revealed
                    ? { summary, woodPick: pick, disclosed: true, ...landed }
                    : { summary, woodPick: pick, ...landed }
            }
            if (toll) {
                const move = {
                    move: PowerMoveKind.ShroudedWood,
                    powerCardId: power?.powerCardId,
                    moverPlayerId: playerId,
                    movedPlayerId: travelerPlayerId,
                    toSiteId: siteId,
                    power
                }
                const tollMove = askPowerMoveToll(state, move, toll, askingPlayerId, true)
                const summary = `chose ${siteId} for ${travelerPlayerId}`
                // A banish waits on the toll's answer; with no favor to ask for, it settles here.
                return tollMove.outcome === PowerMoveTollOutcome.Asked
                    ? { summary, tollMove }
                    : { summary, tollMove, ...settleBanishedVictory(state) }
            }
            const { notes, revealed } = travelByPower(state, travelerPlayerId, siteId, {
                playerId: askingPlayerId,
                next: true
            })
            // Whistle — its secret only for a pawn the pick brought to its user's site.
            const whistler = whistleUserOnArrival(state, {
                move: PowerMoveKind.ShroudedWood,
                moverPlayerId: playerId,
                siteId,
                power
            })
            const given =
                whistler === undefined ? 0 : giveWhistleSecret(state, whistler, travelerPlayerId)
            const secret =
                given > 0 ? `; ${travelerPlayerId} took ${given} secret from the Whistle` : ''
            const summary = `sent ${travelerPlayerId} to ${siteId}${notes.length ? ` (${notes.join('; ')})` : ''}${secret}`
            // R-5.5.7.III, R-5.5.8 — a banish's burn, plans and end follow the move.
            return {
                summary,
                disclosed: revealed ? true : undefined,
                ...settleBanishedVictory(state)
            }
        }
    },
    [PowerQuestionKind.TravelFreeTo]: {
        reasonCannotAnswer: (state, playerId, matched) => {
            const siteId = matched.answer.siteId
            if (!matched.question.siteIds.includes(siteId)) {
                return `${siteId} is not one of the sites the Brass Horse named`
            }
            if (!canPayPowerMoveToll(state, playerId, siteId)) {
                return `travelling to ${siteId} takes a favor for its toll and you have none`
            }
            const unable = reasonCannotTravelByPower(state, playerId, siteId)
            if (unable) return unable
            // R-11.13-H1 — the user's own flip rides the answer, for a site that asks for one only;
            // R-11.13-H2 — two where each site's power takes its own.
            const needed = powerTravelFlipsNeeded(state, playerId, siteId)
            const flips = secretsFlipped(matched.answer.flipSecret)
            if (needed > 0 && flips !== needed) {
                return needed === 1
                    ? `travelling to ${siteId} takes a faceup secret flipped facedown`
                    : `travelling to ${siteId} takes ${needed} faceup secrets flipped facedown`
            }
            return reasonFlipInvalid(state, playerId, needed, flips)
        },
        apply: (state, playerId, matched, _asked, askingPlayerId) => {
            const siteId = matched.answer.siteId
            // Toll Roads — Brass Horse's user travels, so they pay as they go.
            const toll = powerMoveToll(state, playerId, siteId)
            if (toll) payToll(state, playerId, toll)
            const flips = secretsFlipped(matched.answer.flipSecret)
            if (flips > 0) flipSecretFacedown(state, playerId, flips)
            const { notes } = travelByPower(state, playerId, siteId, {
                playerId: askingPlayerId,
                next: true
            })
            const after = notes.length ? ` (${notes.join('; ')})` : ''
            const travelled = `${flips > 0 ? `flipped ${secretsWord(flips)} facedown and travelled` : 'travelled'} to ${siteId} for no Supply`
            if (!toll) return `${travelled}${after}`
            // The History's form for a toll inside a row: what was paid, then the card.
            const paid = toll.payeeId ? `paid ${toll.payeeId}` : 'burned'
            return `${travelled}; ${paid} 1 favor (${toll.cardId})${after}`
        }
    },
    [PowerQuestionKind.RerollDice]: {
        reasonCannotAnswer: (state, playerId, matched) => {
            if (!matched.answer.reroll) return undefined
            return reasonCannotUsePowerToReroll(state, playerId, matched.question)
        },
        apply: (state, playerId, matched, _asked, askingPlayerId) => {
            const { roll } = matched.question
            if (roll.kind !== RerolledRollKind.Campaign) {
                // What the roll postponed (Gambling Hall's favor or bank, Relic Thief's take) lands
                // now; a take is a title moment (its Q&A: "at each moment that relics change hands").
                if (!matched.answer.reroll) {
                    const kept = settleRoll(state, askingPlayerId, playerId, roll)
                    return {
                        summary: `kept the roll; ${kept.summary}`,
                        titleMoment: kept.relicsTaken
                    }
                }
                payPowerCost(state, playerId, powerForQuestion(state, matched.question))
                const rerolled = settleRoll(
                    state,
                    askingPlayerId,
                    playerId,
                    rerollStanding(state, roll)
                )
                return {
                    summary: `Jinx: rerolled — ${rerolled.summary}`,
                    rolled: true,
                    titleMoment: rerolled.relicsTaken
                }
            }
            if (!matched.answer.reroll) return 'kept the roll'
            const campaign = state.campaign
            assertExists(campaign, 'Jinx rerolled with no Campaign under way')
            payPowerCost(state, playerId, powerForQuestion(state, matched.question))
            const prng = state.getProtectedPrng()
            if (roll.side === 'attack') {
                applyAttackRoll(campaign, rollAttackDice(prng, campaign.attackRoll.length))
                return {
                    summary: `Jinx: rerolled the attack — ${campaign.swords} swords`,
                    rolled: true
                }
            }
            applyDefenseRoll(campaign, rollDefenseDice(prng, campaign.defenseRoll.length))
            return {
                summary: `Jinx: rerolled the defense — ${campaign.defense} defense`,
                rolled: true
            }
        }
    },
    [PowerQuestionKind.RelicThiefRoll]: {
        reasonCannotAnswer: (state, playerId, matched) => {
            if (!matched.answer.roll) return undefined
            return reasonCannotUsePowerToReroll(state, playerId, matched.question)
        },
        apply: (state, playerId, matched, _asked, askingPlayerId) => {
            const { takerPlayerId, relicCardIds } = matched.question
            if (!matched.answer.roll) return 'let the relics go'
            payPowerCost(state, playerId, powerForQuestion(state, matched.question))
            const taker = state.getPlayerState(takerPlayerId)
            const relics = relicCardIds.filter((id) => taker.relicIds.includes(id))
            const shields = rollDefenseShields(state.getProtectedPrng(), relics.length)
            const roll = {
                kind: RerolledRollKind.RelicThief as const,
                takerPlayerId,
                relicCardIds: relics,
                shields
            }
            // Jinx — the take waits on the reroll's answer, asked next, so this one moves nothing.
            if (offerReroll(state, playerId, playerId, roll, true)) {
                return {
                    summary: `Relic Thief: rolled ${shields} shields; Jinx may reroll them`,
                    rolled: true
                }
            }
            const settled = settleRoll(state, askingPlayerId, playerId, roll)
            return { summary: settled.summary, rolled: true, titleMoment: settled.relicsTaken }
        }
    },
    [PowerQuestionKind.PlayOrDiscardVision]: {
        reasonCannotAnswer: (state, playerId, matched) => {
            return reasonCannotPlayCard(
                state,
                playerId,
                matched.question.visionCardId,
                matched.answer.play,
                {
                    faceUp: false,
                    discardedAdviserCardIds: listOf(matched.answer.discardedAdviserCardId)
                }
            )
        },
        apply: (state, playerId, matched) => {
            const { visionCardId } = matched.question
            const { play, discardedAdviserCardId } = matched.answer
            const region = regionOfPawn(state, playerId)
            // R-5.1.4 — "as if you had searched": the same play a Search's kept card gets.
            const played = playCard(state, playerId, visionCardId, play, region, {
                faceUp: false,
                // The Vision was revealed; played facedown, the table still knows it.
                seen: true,
                discardedAdviserCardIds: listOf(discardedAdviserCardId)
            })
            const summary =
                play === SearchPlay.Discard
                    ? `discarded ${visionCardId}`
                    : `played ${visionCardId} (${play})`
            if (played.discarded.length === 0) return summary
            return {
                summary,
                discardedCardIds: played.discarded,
                discardPileRegion: discardRegionFor(region)
            }
        }
    },
    [PowerQuestionKind.DiscardInstead]: {
        reasonCannotAnswer: (state, playerId, matched) => {
            const insteadCardId = matched.answer.insteadCardId
            if (insteadCardId === undefined) return undefined
            if (!matched.question.insteadCardIds.includes(insteadCardId))
                return `${insteadCardId} is not one of the cards you may discard instead`
            return rulesCard(state, playerId, insteadCardId)
                ? undefined
                : `you no longer rule ${insteadCardId}`
        },
        apply: (state, _playerId, matched) => {
            const { planCardIds, actingPlayerId, cardId } = matched.question
            const insteadCardId = matched.answer.insteadCardId
            if (insteadCardId !== undefined) {
                return {
                    summary: `discarded ${insteadCardId} instead of ${planCardIds.join(', ')}`,
                    pileDeposits: discardFromPlayInChosenOrder(
                        state,
                        actingPlayerId,
                        [insteadCardId],
                        cardId
                    )
                }
            }
            // R-5.5.8, Law Glossary "Discard" — the plans go as printed, in the order their discarder picks.
            const going = planCardIds.filter((planCardId) => isInPlay(state, planCardId))
            return {
                summary: `discarded ${going.join(', ')} as printed`,
                pileDeposits: discardFromPlayInChosenOrder(state, actingPlayerId, going)
            }
        }
    },
    [PowerQuestionKind.SneakAttack]: {
        reasonCannotAnswer: () => undefined,
        apply: (_state, _playerId, matched) =>
            `passed on a Sneak Attack against ${matched.question.defenderPlayerId}`
    },
    // Second Wind — "you may travel and then may campaign": skipping the Travel leaves the Campaign.
    [PowerQuestionKind.FreeActionOutOfTurn]: {
        reasonCannotAnswer: () => undefined,
        apply: (state, playerId) => {
            const skipped = forgoFreeActionNow(state, playerId)
            holdTurnForSkippedFreeAction(state)
            endStepOutOfTurn(state, playerId)
            return `skipped the free ${skipped === ActionType.Travel ? 'Travel' : 'Campaign'}`
        }
    },
    [PowerQuestionKind.OrderDiscards]: {
        reasonCannotAnswer: (_state, _playerId, matched) => {
            return isPermutationOf(matched.answer.order, matched.question.cardIds.length)
                ? undefined
                : `the order must name each of the ${matched.question.cardIds.length} cards once`
        },
        apply: (state, playerId, matched) => {
            const { cardIds, fromRegion } = matched.question
            const ordered = matched.answer.order.map((position) => cardIds[position])
            const pileDeposits = discardCards(state, playerId, ordered, fromRegion)
            return {
                summary: `discarded ${ordered.join(', ')} in that order`,
                pileDeposits
            }
        }
    },
    [PowerQuestionKind.PayTravelToll]: {
        reasonCannotAnswer: (state, playerId, matched) => {
            const usable = usableFavor(state, playerId)
            return matched.answer.pay && usable < 1
                ? `paying takes 1 favor and you have ${usable}`
                : undefined
        },
        apply: (state, _playerId, matched, _asked, askingPlayerId) => {
            const { question } = matched
            const tollMove = settlePowerMoveToll(state, question, matched.answer.pay)
            const paid = `${question.payeeId ? `paid ${question.payeeId}` : 'burned'} 1 favor and went to ${question.siteId}`
            // R-5.5.7.III, R-5.5.8 — a banish's burn, plans and end follow the answer, paid or refused.
            if (!matched.answer.pay) {
                return {
                    summary: `refused ${question.cardId} and stayed at ${question.fromSiteId}`,
                    tollMove,
                    ...settleBanishedVictory(state),
                    // A Travel out of turn whose toll is refused ends at the Wood, where the pawn stays.
                    ...(question.travel ? endTravelOutOfTurn(state, question.askedPlayerId) : {})
                }
            }
            if (!question.travel)
                return { summary: paid, tollMove, ...settleBanishedVictory(state) }
            // R-11.7 — the toll paid, the Travel pays the Wood's Supply folded for the site (or Way
            // Station's favor, R-11.7-H3), then Tyrant and the site's powers.
            const arrived = arriveFromWood(state, {
                travelerId: question.askedPlayerId,
                siteId: question.siteId,
                travel: question.travel,
                chooserId: question.moverPlayerId,
                askingPlayerId
            })
            if (arrived === undefined) {
                const toWhom = question.payeeId ? `paid ${question.payeeId}` : 'burned'
                return { summary: `${toWhom} 1 favor for ${question.cardId}`, tollMove }
            }
            const { pick, revealed, landed } = arrived
            assert(
                revealed === undefined,
                'Toll Roads asks only for a site its ruler rules, and a ruled site is faceup'
            )
            return {
                summary: `${paid}, paying ${pick.supplySpent} Supply`,
                tollMove,
                woodPick: pick,
                ...landed
            }
        }
    },
    [PowerQuestionKind.FlipToTravel]: {
        reasonCannotAnswer: (state, playerId, matched) =>
            matched.answer.flip
                ? reasonFlipInvalid(
                      state,
                      playerId,
                      matched.question.flips ?? 1,
                      matched.question.flips ?? 1
                  )
                : undefined,
        apply: (state, _playerId, matched, _asked, askingPlayerId) => {
            const { question } = matched
            // R-11.13-H1 — no flip, no travel: the pawn stays; a banish's burn, plans and end follow.
            if (!matched.answer.flip) {
                return {
                    summary: `kept their secrets and stayed at ${question.fromSiteId}`,
                    ...settleBanishedVictory(state)
                }
            }
            const settled = settlePowerMoveFlip(state, question, askingPlayerId)
            if ('tollMove' in settled) {
                // Toll Roads follows; the secret is flipped once the toll is paid.
                const summary = `chose to flip ${secretsWord(question.flips ?? 1)} to travel to ${question.siteId}`
                return settled.tollMove.outcome === PowerMoveTollOutcome.Asked
                    ? summary
                    : { summary, tollMove: settled.tollMove, ...settleBanishedVictory(state) }
            }
            const { notes, revealed, secretsTaken } = settled.arrived
            const secret = secretsTaken ? `, taking ${secretsTaken} secret from the Whistle` : ''
            const after = notes.length ? ` (${notes.join('; ')})` : ''
            return {
                summary: `flipped ${secretsWord(question.flips ?? 1)} facedown and travelled to ${question.siteId}${secret}${after}`,
                disclosed: revealed ? true : undefined,
                ...settleBanishedVictory(state)
            }
        }
    },
    [PowerQuestionKind.WayStationFavor]: {
        reasonCannotAnswer: (state, playerId, matched) => {
            if (matched.answer.give) {
                const usable = usableFavor(state, playerId)
                return usable < 1 ? `giving takes 1 favor and you have ${usable}` : undefined
            }
            const supply = state.getPlayerState(playerId).supply
            const cost = matched.question.supplyCost
            return supply < cost ? `paying takes ${cost} Supply and you have ${supply}` : undefined
        },
        apply: (state, playerId, matched, _asked, askingPlayerId) => {
            const { question } = matched
            // R-11.7-H3 — either answer travels: the favor and no Supply, or the Supply.
            const favorInstead = matched.answer.give
                ? { cardId: question.cardId, payeeId: question.payeeId }
                : undefined
            const { pick, revealed, landed } = landFromWood(
                state,
                playerId,
                question.siteId,
                question.travel,
                { favorInstead, chooserPlayerId: question.chooserPlayerId },
                askingPlayerId
            )
            assert(revealed === undefined, 'Way Station stands at a faceup site')
            const how = favorInstead
                ? `${question.payeeId ? `paid ${question.payeeId}` : 'burned'} 1 favor`
                : `paid ${pick.supplySpent} Supply`
            return { summary: `${how} and went to ${question.siteId}`, woodPick: pick, ...landed }
        }
    },
    [PowerQuestionKind.HospitalityBank]: {
        reasonCannotAnswer: (_state, _playerId, matched) => {
            const { banks, siteId } = matched.question
            return banks.includes(matched.answer.suit)
                ? undefined
                : `${matched.answer.suit} is not a bank Hospitality matches at ${siteId}: choose ${banks.join(' or ')}`
        },
        apply: (state, playerId, matched) => {
            const { question } = matched
            const card = { cardId: question.cardId, powerIndex: question.powerIndex }
            // R-11.7-H2 — "gain [favor] from one favor bank": the one the traveller chose.
            const notes = gainOnArrival(state, playerId, card, matched.answer.suit, question.siteId)
            return {
                summary: notes.join('; '),
                ...woodTravelLanded(state, playerId, question.endsActPhase === true)
            }
        }
    },
    [PowerQuestionKind.GamblingHallBank]: {
        reasonCannotAnswer: (_state, _playerId, matched) => {
            const { banks } = matched.question
            return banks.includes(matched.answer.suit)
                ? undefined
                : `the ${matched.answer.suit} bank had no favor when the roll stood: choose ${banks.join(' or ')}`
        },
        // R-7.1.3-H2, R-9.3 — the total, or what the chosen bank holds.
        apply: (state, playerId, matched) => {
            const { suit } = matched.answer
            const gained = gainFavorFromBank(state, playerId, suit, matched.question.shields)
            return `gained ${gained} favor from the ${suit} bank`
        }
    },
    [PowerQuestionKind.PayFromHomeBank]: {
        reasonCannotAnswer: (state, _playerId, matched) =>
            reasonCannotPayFromHomeBank(state, matched.question, matched.answer.favor),
        apply: (state, _playerId, matched) =>
            payFromHomeBank(state, matched.question, matched.answer.favor)
    },
    [PowerQuestionKind.DragonskinDrum]: {
        reasonCannotAnswer: (state, playerId, matched) =>
            matched.answer.gain ? reasonDrumBankEmpty(state, playerId) : undefined,
        apply: (state, playerId, matched) =>
            matched.answer.gain ? gainFromDrum(state, playerId) : 'skipped'
    },
    [PowerQuestionKind.DiscardAdvisers]: {
        reasonCannotAnswer: (state, playerId, matched) =>
            reasonAdviserLimitDiscardsInvalid(
                state,
                playerId,
                matched.question,
                matched.answer.discardedAdviserCardIds
            ),
        apply: (state, playerId, matched) =>
            discardAdvisersToMeetLimit(
                state,
                playerId,
                matched.question,
                matched.answer.discardedAdviserCardIds
            )
    },
    [PowerQuestionKind.OrderDrawnCards]: {
        reasonCannotAnswer: (_state, _playerId, matched) => {
            return isPermutationOf(matched.answer.order, matched.question.cardIds.length)
                ? undefined
                : `the order must name each of the ${matched.question.cardIds.length} cards once`
        },
        apply: (state, playerId, matched) => {
            const { cardIds, region } = matched.question
            const stacked = matched.answer.order.map((position) => cardIds[position])
            // R-10.30 — the card names the pawn's own region, not R-10.5's next one.
            const pileDeposits = discardCards(state, playerId, stacked, region, {
                region,
                bottom: false
            })
            return {
                summary: `stacked ${stacked.length} cards on the ${region} discard pile`,
                pileDeposits
            }
        }
    },
    [PowerQuestionKind.DealKept]: {
        reasonCannotAnswer: (state, _playerId, matched) =>
            reasonDealKeptInvalid(state, matched.question),
        // R-7.6.3-H1 — the asked party's word closes the deal, or leaves it open.
        apply: (state, _playerId, matched) =>
            answerDealKept(state, matched.question, matched.answer.kept)
    }
}

/** R-11.13-H2 — the History names each flipped secret: "a secret", "2 secrets". */
function secretsWord(flips: number): string {
    return flips === 1 ? 'a secret' : `${flips} secrets`
}
