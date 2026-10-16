import { assert, assertExists } from '@tabletop/common'
import { burnFavor } from './burn.js'
import { gainFavorFromBank, giveFavor, spendFavor, usableFavor } from './favor.js'
import { HydratedOathGameState, discardRegionFor } from '../model/gameState.js'
import { SearchPlay } from '../model/oathEnums.js'
import { PowerQuestionKind, RerolledRollKind } from '../model/question.js'
import { offerReroll, settleRoll } from './reroll.js'
import { CONSPIRACY_ID } from '../data/cardRegistry.js'
import { cardPowers, type CardPower, type PowerUseKey } from '../data/cardPowers.js'
import { payPowerCost, reasonCannotPayPowerCost } from './powerCost.js'
import { regionOfPawn } from './pawn.js'
import { rollDefenseShields } from '../data/dice.js'
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
    reasonExchangeInvalid,
    reasonTermsOutsideCard
} from './exchange.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { returnWarbandsOnCardToBanks } from './force.js'
import { reasonCannotTravelByPower, travelByPower } from './powerTravel.js'
import { reasonWoodPickRefused, settleWoodPick, shroudedWoodDestinations } from './shroudedWood.js'
import { settleBanishedVictory } from './campaignVictory.js'
import {
    askPowerMoveToll,
    canPayPowerMoveToll,
    powerMoveToll,
    settlePowerMoveToll
} from './powerMoveTolls.js'
import { payToll } from './tolls.js'
import { gainFromDrum, reasonDrumBankEmpty } from './dragonskinDrum.js'
import { PowerMoveKind, PowerMoveTollOutcome } from '../model/powerMoveToll.js'
import { forgoFreeActionNow } from './freeActions.js'
import {
    endStepOutOfTurn,
    endTravelOutOfTurn,
    holdTurnForSkippedFreeAction
} from './sneakAttack.js'
import { ActionType } from '../definition/actions.js'

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
        // R-2.11-H1 — each binding exchange is its own moment for the title.
        titleMoment: true,
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
            return {
                summary: `accepted ${proposerPlayerId}'s exchange`,
                disclosed: applied.disclosed
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
            const { relicCardId } = matched.question
            if (matched.answer.keep) {
                return `took ${relicCardId}${takeNotes(takeRelics(state, asked.playerId, [relicCardId]))}`
            }
            return {
                summary: 'put the relic on the bottom of the relic deck',
                relicToDeckBottom: relicCardId
            }
        }
    },
    [PowerQuestionKind.BottomRelic]: {
        reasonCannotAnswer: (state, playerId, matched) => {
            const held = matched.answer.heldRelicCardId
            if (held === undefined || heldRelicsToBottom(state, playerId).includes(held)) {
                return undefined
            }
            return held === GRAND_SCEPTER_ID
                ? 'the Grand Scepter cannot go to the bottom'
                : `you do not hold ${held}`
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
            returnWarbandsOnCardToBanks(state, held)
            return {
                summary: `took ${relicCardId} and put ${held} on the bottom of the relic deck${takeNotes(notes)}`,
                relicToDeckBottom: held
            }
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
            const siteId = matched.answer.siteId
            // R-11.7 — the traveller's own Travel goes only where they can pay.
            if (travel) return reasonWoodPickRefused(state, travelerPlayerId, siteId, travel.free)
            return shroudedWoodDestinations(state, travelerPlayerId, fromSiteId).includes(siteId)
                ? undefined
                : `${siteId} is not a site ${travelerPlayerId} can be sent to`
        },
        apply: (state, playerId, matched, _asked, askingPlayerId) => {
            const { travelerPlayerId, travel } = matched.question
            const siteId = matched.answer.siteId
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
                const { pick, revealed } = settleWoodPick(
                    state,
                    travelerPlayerId,
                    siteId,
                    travel.free
                )
                const notes = pick.notes ?? []
                const summary = `sent ${travelerPlayerId} to ${siteId}, who paid ${pick.supplySpent} Supply${notes.length ? ` (${notes.join('; ')})` : ''}`
                // Second Wind out of turn — the pawn has landed, so the free Campaign is judged from here.
                const landed = endTravelOutOfTurn(state, travelerPlayerId)
                return revealed
                    ? { summary, woodPick: pick, disclosed: true, ...landed }
                    : { summary, woodPick: pick, ...landed }
            }
            if (toll) {
                const move = {
                    move: PowerMoveKind.ShroudedWood,
                    moverPlayerId: playerId,
                    movedPlayerId: travelerPlayerId,
                    toSiteId: siteId
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
            const summary = `sent ${travelerPlayerId} to ${siteId}${notes.length ? ` (${notes.join('; ')})` : ''}`
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
            return reasonCannotTravelByPower(state, playerId, siteId)
        },
        apply: (state, playerId, matched, _asked, askingPlayerId) => {
            const siteId = matched.answer.siteId
            // Toll Roads — Brass Horse's user travels, so they pay as they go.
            const toll = powerMoveToll(state, playerId, siteId)
            if (toll) payToll(state, playerId, toll)
            const { notes } = travelByPower(state, playerId, siteId, {
                playerId: askingPlayerId,
                next: true
            })
            const after = notes.length ? ` (${notes.join('; ')})` : ''
            if (!toll) return `travelled to ${siteId} for no Supply${after}`
            // The History's form for a toll inside a row: what was paid, then the card.
            const paid = toll.payeeId ? `paid ${toll.payeeId}` : 'burned'
            return `travelled to ${siteId} for no Supply; ${paid} 1 favor (${toll.cardId})${after}`
        }
    },
    [PowerQuestionKind.RerollDice]: {
        reasonCannotAnswer: (state, playerId, matched) => {
            if (!matched.answer.reroll) return undefined
            return reasonCannotUsePowerToReroll(state, playerId, matched.question)
        },
        apply: (state, playerId, matched) => {
            const { roll } = matched.question
            if (roll.kind !== RerolledRollKind.Campaign) {
                if (!matched.answer.reroll)
                    return `kept the roll; ${settleRoll(state, playerId, roll)}`
                payPowerCost(state, playerId, powerForQuestion(state, matched.question))
                const dice =
                    roll.kind === RerolledRollKind.GamblingHall ? 4 : roll.relicCardIds.length
                const shields = rollDefenseShields(state.getProtectedPrng(), dice)
                return {
                    summary: `Jinx: rerolled — ${settleRoll(state, playerId, { ...roll, shields })}`,
                    rolled: true
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
        // Its Q&A: the title is checked "at each moment that relics change hands".
        titleMoment: true,
        reasonCannotAnswer: (state, playerId, matched) => {
            if (!matched.answer.roll) return undefined
            return reasonCannotUsePowerToReroll(state, playerId, matched.question)
        },
        apply: (state, playerId, matched) => {
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
            // Jinx — the take waits on the reroll's answer, asked next.
            if (offerReroll(state, playerId, playerId, roll, true)) {
                return {
                    summary: `Relic Thief: rolled ${shields} shields; Jinx may reroll them`,
                    rolled: true
                }
            }
            return { summary: settleRoll(state, playerId, roll), rolled: true }
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
        apply: (state, _playerId, matched) => {
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
            // R-11.7 — the toll paid, the Travel pays the Wood's Supply folded for the site, then Tyrant and the site's powers.
            const { pick, revealed } = settleWoodPick(
                state,
                question.askedPlayerId,
                question.siteId,
                question.travel.free
            )
            assert(
                revealed === undefined,
                'Toll Roads asks only for a site its ruler rules, and a ruled site is faceup'
            )
            return {
                summary: `${paid}, paying ${pick.supplySpent} Supply`,
                tollMove,
                woodPick: pick,
                ...endTravelOutOfTurn(state, question.askedPlayerId)
            }
        }
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
    }
}
