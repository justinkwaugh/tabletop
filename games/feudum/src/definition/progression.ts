import type { GameProgress, GameProgression } from '@tabletop/common'
import { EpochTrack, LastEpoch } from '../data/tracks.js'
import { epochConditionMet, epochConditionShown } from '../model/epochConditions.js'
import { HydratedFeudumGameState, type FeudumProjectedState } from '../model/gameState.js'
import { epochNumber, nextSunray, sunray } from '../model/tracks.js'

/** R-2.1 Epochs I to IV are played; reaching V ends the game. */
const PlayedEpochs = LastEpoch - 1

/** R-2.1, R-4.11.2, R-6.1 The host's display aid: public information only, read from any view. */
export class FeudumProgression implements GameProgression<FeudumProjectedState> {
    progress(projected: FeudumProjectedState): GameProgress {
        const state = new HydratedFeudumGameState(projected)
        const lastRay = EpochTrack[EpochTrack.length - 1]
        const final = state.epoch === lastRay.id || epochConditionMet(state, lastRay)
        const round = state.roundManager.series.length
        return {
            fraction: final
                ? 1
                : (epochNumber(state) - 1 + FeudumProgression.towardsNextEpoch(state)) /
                  PlayedEpochs,
            label: `Epoch ${sunray(state.epoch).ray} · ${round === 0 ? 'Setup' : `Round ${round}`}`,
            ...(final ? { final: true } : {})
        }
    }

    /** R-4.11.2 How much of this epoch's sunray the stack tops already show. */
    private static towardsNextEpoch(state: HydratedFeudumGameState): number {
        const next = nextSunray(state.epoch)
        const shown = next === undefined ? undefined : epochConditionShown(state, next)
        return shown === undefined ? 0 : Math.min(shown.showing / shown.count, 1)
    }
}
