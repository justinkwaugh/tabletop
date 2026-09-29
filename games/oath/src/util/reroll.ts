import { HydratedOathGameState } from '../model/gameState.js'
import { PowerQuestionKind, RerolledRollKind, type RerolledRoll } from '../model/question.js'
import { persistentsInPlay } from './persistent.js'
import { askQuestion } from './questions.js'
import { gainFavorFromBank } from './favor.js'
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

/** Gambling Hall, Relic Thief — what a roll outside a Campaign does once it stands. */
export function settleRoll(
    state: HydratedOathGameState,
    rollerId: string,
    roll: Exclude<RerolledRoll, { kind: RerolledRollKind.Campaign }>
): string {
    if (roll.kind === RerolledRollKind.GamblingHall) {
        const gained = gainFavorFromBank(state, rollerId, roll.bank, roll.shields)
        return `rolled ${roll.shields} shields and took ${gained} favor from the ${roll.bank} bank`
    }
    const taker = state.getPlayerState(roll.takerPlayerId)
    const relics = roll.relicCardIds.filter((id) => taker.relicIds.includes(id))
    if (roll.shields > 0) {
        return `Relic Thief: rolled ${roll.shields} shields, so ${roll.takerPlayerId} keeps ${relics.join(', ')}`
    }
    const notes = takeRelicsFrom(state, roll.takerPlayerId, rollerId, relics)
    return `Relic Thief: rolled no shields and took ${relics.join(', ')} from ${roll.takerPlayerId}${takeNotes(notes)}`
}
