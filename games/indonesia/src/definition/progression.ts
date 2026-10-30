import type { GameProgress, GameProgression } from '@tabletop/common'
import { Deeds } from '../components/deed.js'
import { HydratedIndonesiaGameState, type IndonesiaGameState } from '../model/gameState.js'
import { shouldStartNewEraAfterRemovingUnstartableDeeds } from '../stateHandlers/operationsFlow.js'
import { Era } from './eras.js'
import { MachineState } from './states.js'

const eras = Object.values(Era)

export class IndonesiaProgression implements GameProgression<IndonesiaGameState> {
    progress(state: IndonesiaGameState): GameProgress {
        const eraDeedCount = Deeds.filter((deed) => deed.era === state.era).length
        const deedsLeft =
            state.machineState === MachineState.NewEra
                ? eraDeedCount
                : state.availableDeeds.filter((deed) => deed.era === state.era).length
        const lastOperations = this.isLastOperations(state)
        return {
            fraction: (eras.indexOf(state.era) + 1 - deedsLeft / eraDeedCount) / eras.length,
            label: lastOperations
                ? `Era ${state.era} · last operations`
                : `Era ${state.era} · ${deedsLeft} ${deedsLeft === 1 ? 'deed' : 'deeds'} left`,
            ...(lastOperations ? { final: true } : {})
        }
    }

    private isLastOperations(state: IndonesiaGameState): boolean {
        return (
            state.era === Era.C &&
            state.machineState !== MachineState.NewEra &&
            shouldStartNewEraAfterRemovingUnstartableDeeds(new HydratedIndonesiaGameState(state))
        )
    }
}
