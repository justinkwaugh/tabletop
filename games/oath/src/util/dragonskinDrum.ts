import { HydratedOathGameState } from '../model/gameState.js'
import { PowerQuestionKind, type WarbandGain } from '../model/question.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { DRAGONSKIN_DRUM_ID } from '../data/relics.js'
import { gainedWarbandsWords, gainWarbandsWithOwner, warbandOwnerGainedByPower } from './force.js'
import { askQuestion } from './questions.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'
import { countOf, countedWarbands } from './warbands.js'

/**
 * "After traveling, gain one warband." Its Q&A: a player made to travel still gains it. On their own
 * Travel the holder declares it as a modifier; when a power moves them, from revision 7 (R-X.4) they
 * are asked once the pawn has arrived, so after any Toll Roads answer that let the move happen.
 */
export function askDragonskinDrum(
    state: HydratedOathGameState,
    movedPlayerId: string,
    askingPlayerId: string,
    front: boolean
): void {
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes3)) return
    if (!state.getPlayerState(movedPlayerId).relicIds.includes(DRAGONSKIN_DRUM_ID)) return
    // An empty bank is the question's forced outcome: nothing could be gained, so nothing is asked.
    askQuestion(
        state,
        askingPlayerId,
        {
            kind: PowerQuestionKind.DragonskinDrum,
            cardId: DRAGONSKIN_DRUM_ID,
            askedPlayerId: movedPlayerId
        },
        front
    )
}

/** R-10.10, R-9.3 — the bank the warband would come from: the Empire's for a Citizen (R-5.2.2). */
export function reasonDrumBankEmpty(
    state: HydratedOathGameState,
    playerId: string
): string | undefined {
    const owner = warbandOwnerGainedByPower(state, playerId)
    const bank = state.getPlayerState(state.warbandBankHolderOf(owner)).warbandsInPersonalBank
    if (countOf(bank, owner) > 0) return undefined
    return owner === IMPERIAL_WARBANDS && state.chancellorId() !== playerId
        ? "the Empire's warband bank is empty"
        : 'your warband bank is empty'
}

/** "Gain": one warband onto the holder's board, in the colour R-10.13 gives it. */
export function gainFromDrum(
    state: HydratedOathGameState,
    playerId: string
): { summary: string; warbandGain: WarbandGain } {
    const owner = warbandOwnerGainedByPower(state, playerId)
    const { gained } = gainWarbandsWithOwner(state, playerId, 1, owner)
    const words = gainedWarbandsWords(state, playerId, gained) ?? countedWarbands(gained)
    return { summary: `gained ${words}`, warbandGain: { owner, count: gained } }
}
