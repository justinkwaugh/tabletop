import { HydratedOathGameState } from '../model/gameState.js'
import { PowerQuestionKind, RerolledRollKind, type RerolledRoll } from '../model/question.js'
import { persistentsInPlay } from './persistent.js'
import { askQuestion } from './questions.js'
import { gainFavorFromBank } from './favor.js'
import { FAVOR_BANK_ORDER } from '../data/favorBanks.js'
import { takeNotes, takeRelicsFrom } from './relics.js'

/** Jinx — "after you roll [attackDie] or [defenseDie] for any reason"; true when the roll now waits on the answer. */
export function offerReroll(
    state: HydratedOathGameState,
    askingPlayerId: string,
    rollerId: string,
    roll: RerolledRoll,
    front = false
): boolean {
    let asked = false
    for (const { ctx, hooks } of persistentsInPlay(state)) {
        if (!hooks.offersReroll?.(ctx, rollerId)) continue
        const note = askQuestion(
            state,
            askingPlayerId,
            {
                kind: PowerQuestionKind.RerollDice,
                cardId: ctx.cardId,
                askedPlayerId: rollerId,
                powerIndex: ctx.power.powerIndex,
                roll
            },
            front
        )
        if (!note) asked = true
    }
    return asked
}

/** What a roll outside a Campaign did once it stood. */
export interface SettledRoll {
    summary: string
    /** Relic Thief — the relics changed hands. */
    relicsTaken: boolean
}

const GAMBLING_HALL = 'denizen.discord.gambling-hall'

/** A roll's total as a History row reads it. */
export function rolledShields(shields: number): string {
    return `rolled ${shields} ${shields === 1 ? 'shield' : 'shields'}`
}

/**
 * Gambling Hall, Relic Thief — what a roll outside a Campaign does once it stands. From revision 21
 * Gambling Hall's bank is asked now, after any Jinx answer, or settled unasked (R-7.1.3-H2).
 */
export function settleRoll(
    state: HydratedOathGameState,
    askingPlayerId: string,
    rollerId: string,
    roll: Exclude<RerolledRoll, { kind: RerolledRollKind.Campaign }>
): SettledRoll {
    if (roll.kind === RerolledRollKind.GamblingHallDice) {
        const forced = askQuestion(
            state,
            askingPlayerId,
            {
                kind: PowerQuestionKind.GamblingHallBank,
                cardId: GAMBLING_HALL,
                askedPlayerId: rollerId,
                shields: roll.shields,
                faces: roll.faces,
                // In the banks' order on the board, as the buttons read.
                banks: FAVOR_BANK_ORDER.filter((suit) => state.favorBank[suit] > 0)
            },
            true
        )
        const rolled = rolledShields(roll.shields)
        return { summary: forced ? `${rolled}; ${forced}` : rolled, relicsTaken: false }
    }
    if (roll.kind === RerolledRollKind.GamblingHall) {
        const gained = gainFavorFromBank(state, rollerId, roll.bank, roll.shields)
        return {
            summary: `rolled ${roll.shields} shields and took ${gained} favor from the ${roll.bank} bank`,
            relicsTaken: false
        }
    }
    const taker = state.getPlayerState(roll.takerPlayerId)
    const relics = roll.relicCardIds.filter((id) => taker.relicIds.includes(id))
    if (roll.shields > 0) {
        return {
            summary: `Relic Thief: rolled ${roll.shields} shields; ${relics.join(', ')} stayed with ${roll.takerPlayerId}`,
            relicsTaken: false
        }
    }
    const notes = takeRelicsFrom(state, roll.takerPlayerId, rollerId, relics)
    return {
        summary: `Relic Thief: rolled no shields and took ${relics.join(', ')} from ${roll.takerPlayerId}${takeNotes(notes)}`,
        relicsTaken: true
    }
}
