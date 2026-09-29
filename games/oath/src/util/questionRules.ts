import { assertExists } from '@tabletop/common'
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
import { reasonPersistentForbidsRelicTake, reasonPersistentForbidsTravel } from './persistent.js'
import { applyAttackRoll, applyDefenseRoll } from './campaignRoll.js'
import { rollAttackDice, rollDefenseDice } from '../data/dice.js'
import {
    takeNotes,
    takeRelics,
    takeRelicsFrom,
    releaseRelic,
    clearReliquarySlot
} from './relics.js'
import { reliquarySlot } from './imperial.js'
import { askQuestion, banksWithFavor, playersAt } from './questions.js'
import type { QuestionRules } from './questions.js'
import {
    GATHERING_ALLOWS,
    applyExchange,
    reasonExchangeInvalid,
    reasonTermsOutsideCard
} from './exchange.js'
import { reasonCannotSneakAttack } from './sneakAttack.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { returnWarbandsOnCardToBanks } from './force.js'
import { reasonCannotTravelByPower, travelByPower } from './powerTravel.js'

function listOf(id: string | undefined): string[] {
    return id === undefined ? [] : [id]
}

/** R-11.7 — from a Shrouded Wood the Narrow Pass and The Hidden Place are ignored; any other site the traveler may go to. */
/** Fae Merchant — "any relic you hold except the Grand Scepter", besides the one drawn. */
export function heldRelicsToBottom(state: HydratedOathGameState, playerId: string): string[] {
    return state.getPlayerState(playerId).relicIds.filter((id) => id !== GRAND_SCEPTER_ID)
}

export function shroudedWoodDestinations(
    state: HydratedOathGameState,
    travelerId: string,
    fromSiteId: string
): string[] {
    return state
        .allSiteIds()
        .filter(
            (siteId) =>
                siteId !== fromSiteId &&
                reasonPersistentForbidsTravel(state, travelerId, fromSiteId, siteId) === undefined
        )
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
        forcedOutcome: (state, question) => {
            return usableFavor(state, question.askedPlayerId) <= 0
                ? `${question.askedPlayerId} has no favor to burn`
                : undefined
        },
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
        forcedOutcome: (state, question, asked) => {
            if (!asked.relicIds.includes(question.relicCardId)) {
                return `${question.askedPlayerId} no longer holds ${question.relicCardId}`
            }
            if (usableFavor(state, question.askedPlayerId) >= question.price) return undefined
            const notes = takeRelicsFrom(state, question.askedPlayerId, question.takerPlayerId, [
                question.relicCardId
            ])
            return `${question.askedPlayerId} could not pay ${question.price} favor, so ${question.takerPlayerId} took ${question.relicCardId}${takeNotes(notes)}`
        },
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
        forcedOutcome: (state, question) => {
            const banks = banksWithFavor(state)
            if (banks.length > 1) return undefined
            if (banks.length === 0) return 'no favor bank has any favor to gain'
            const gained = gainFavorFromBank(
                state,
                question.askedPlayerId,
                banks[0],
                question.amount
            )
            return `${question.askedPlayerId} gained ${gained} favor from the ${banks[0]} bank, the only one with favor`
        },
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
        forcedOutcome: (state, question) => {
            return reasonExchangeInvalid(
                state,
                question.proposerPlayerId,
                question.askedPlayerId,
                question.terms
            )
                ? `the proposed exchange can no longer be honoured: ${reasonExchangeInvalid(state, question.proposerPlayerId, question.askedPlayerId, question.terms)}`
                : undefined
        },
        reasonCannotAnswer: (state, _playerId, matched) => {
            if (!matched.answer.accept) return undefined
            const { proposerPlayerId, askedPlayerId, terms } = matched.question
            return reasonExchangeInvalid(state, proposerPlayerId, askedPlayerId, terms)
        },
        apply: (state, playerId, matched) => {
            const { proposerPlayerId, terms } = matched.question
            if (!matched.answer.accept) return `refused ${proposerPlayerId}'s exchange`
            const disclosed = applyExchange(state, proposerPlayerId, playerId, terms)
            return { summary: `accepted ${proposerPlayerId}'s exchange`, disclosed }
        }
    },
    [PowerQuestionKind.JoinSite]: {
        forcedOutcome: (_state, question, asked) => {
            return asked.siteId === question.siteId
                ? `${question.askedPlayerId} is already there`
                : undefined
        },
        reasonCannotAnswer: () => undefined,
        apply: (_state, _playerId, matched, asked) => {
            const { siteId } = matched.question
            if (!matched.answer.join) return `stayed away from ${siteId}`
            asked.siteId = siteId
            return `put their pawn at ${siteId}`
        }
    },
    [PowerQuestionKind.GatheringFloor]: {
        forcedOutcome: (state, question) => {
            return playersAt(state, question.siteId).filter((id) => id !== question.askedPlayerId)
                .length === 0
                ? 'nobody else is here to negotiate with'
                : undefined
        },
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
        forcedOutcome: () => undefined,
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
        forcedOutcome: () => undefined,
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
        forcedOutcome: (state, question) => {
            return reliquarySlot(state, question.slotId) !== undefined
                ? undefined
                : 'the Reliquary space is no longer occupied'
        },
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
        forcedOutcome: (state, question) => {
            return state.getPlayerState(question.holderPlayerId).hasAdviser(CONSPIRACY_ID)
                ? undefined
                : 'the Conspiracy is no longer there'
        },
        reasonCannotAnswer: (state, playerId, matched) => {
            if (!matched.answer.play) return undefined
            return reasonCannotPlayConspiracy(state, playerId, {
                keptCardId: CONSPIRACY_ID,
                conspiracy: matched.answer.conspiracy
            })
        },
        apply: (state, playerId, matched) => {
            const { play, conspiracy } = matched.answer
            const holder = state.getPlayerState(matched.question.holderPlayerId)
            holder.removeAdviser(CONSPIRACY_ID)
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
        forcedOutcome: () => undefined,
        reasonCannotAnswer: (state, _playerId, matched) => {
            const { travelerPlayerId, fromSiteId } = matched.question
            return shroudedWoodDestinations(state, travelerPlayerId, fromSiteId).includes(
                matched.answer.siteId
            )
                ? undefined
                : `${matched.answer.siteId} is not a site ${travelerPlayerId} can be sent to`
        },
        apply: (state, _playerId, matched) => {
            const { travelerPlayerId } = matched.question
            const siteId = matched.answer.siteId
            const { notes, revealed } = travelByPower(state, travelerPlayerId, siteId)
            const summary = `sent ${travelerPlayerId} to ${siteId}${notes.length ? ` (${notes.join('; ')})` : ''}`
            return revealed ? { summary, disclosed: true } : summary
        }
    },
    [PowerQuestionKind.TravelFreeTo]: {
        forcedOutcome: (_state, question) =>
            question.siteIds.length === 0 ? 'no site to travel to' : undefined,
        reasonCannotAnswer: (state, playerId, matched) => {
            const siteId = matched.answer.siteId
            if (!matched.question.siteIds.includes(siteId)) {
                return `${siteId} is not one of the sites the Brass Horse named`
            }
            return reasonCannotTravelByPower(state, playerId, siteId)
        },
        apply: (state, playerId, matched) => {
            const siteId = matched.answer.siteId
            const { notes } = travelByPower(state, playerId, siteId)
            return `travelled to ${siteId} for no Supply${notes.length ? ` (${notes.join('; ')})` : ''}`
        }
    },
    [PowerQuestionKind.RerollDice]: {
        forcedOutcome: (state, question) => {
            const power = cardPowers(question.cardId)[question.powerIndex]
            assertExists(power, `${question.cardId} has a power at index ${question.powerIndex}`)
            const cost = reasonCannotPayPowerCost(state, question.askedPlayerId, power)
            return cost ? `${question.askedPlayerId} cannot use Jinx: ${cost}` : undefined
        },
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
        forcedOutcome: (state, question) => {
            const still = question.relicCardIds.filter((id) =>
                state.getPlayerState(question.takerPlayerId).relicIds.includes(id)
            )
            if (still.length === 0) return `${question.takerPlayerId} no longer holds the relics`
            // Circlet of Command, Lost Tongue — "cannot target or take … in any way".
            const forbidden = still
                .map((id) =>
                    reasonPersistentForbidsRelicTake(
                        state,
                        question.askedPlayerId,
                        question.takerPlayerId,
                        id
                    )
                )
                .find((reason) => reason !== undefined)
            if (forbidden) return `${question.askedPlayerId} cannot use Relic Thief: ${forbidden}`
            const power = cardPowers(question.cardId)[question.powerIndex]
            const cost = power
                ? reasonCannotPayPowerCost(state, question.askedPlayerId, power)
                : 'the power is not in play'
            return cost ? `${question.askedPlayerId} cannot use Relic Thief: ${cost}` : undefined
        },
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
        forcedOutcome: () => undefined,
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
        forcedOutcome: () => undefined,
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
        forcedOutcome: (state, question) =>
            reasonCannotSneakAttack(state, question.askedPlayerId, question.defenderPlayerId),
        reasonCannotAnswer: () => undefined,
        apply: (_state, _playerId, matched) =>
            `passed on a Sneak Attack against ${matched.question.defenderPlayerId}`
    },
    [PowerQuestionKind.OrderDiscards]: {
        forcedOutcome: () => undefined,
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
    [PowerQuestionKind.OrderDrawnCards]: {
        forcedOutcome: () => undefined,
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
