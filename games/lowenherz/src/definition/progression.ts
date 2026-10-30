import { assertExists, type GameProgress, type GameProgression } from '@tabletop/common'
import type { LowenherzProjectedState } from '../model/gameState.js'
import { ActionCardDeck, CardBack } from './actionCards.js'

const isBasicDeckBack = (back: CardBack) => back !== CardBack.A
const basicDeckSize = ActionCardDeck.filter((card) => isBasicDeckBack(card.back)).length

// Whether the A cards were dealt (player-placed castles) is config, not state, and nothing
// public records them once drawn, so only the basic B–E deck measures progress.
export class LowenherzProgression implements GameProgression<LowenherzProjectedState> {
    progress(state: LowenherzProjectedState): GameProgress {
        const backs = state.actionDeckBacks ?? state.actionDeck?.map((card) => card.back)
        assertExists(backs, 'Progress reads the host state, which holds the action deck')
        const basicDeckRemaining = backs.filter(isBasicDeckBack).length
        const kingMayDie = backs.every((back) => back === CardBack.E)
        return {
            fraction: (basicDeckSize - basicDeckRemaining) / basicDeckSize,
            label: kingMayDie
                ? 'King may die'
                : `${backs.length} action ${backs.length === 1 ? 'card' : 'cards'} left`,
            ...(kingMayDie ? { final: true } : {})
        }
    }
}
