import { GameSession } from '@tabletop/frontend-components'
import {
    MachineState,
    type HydratedIndonesiaGameState,
    type IndonesiaGameState
} from '@tabletop/indonesia'

export class IndonesiaGameSession extends GameSession<
    IndonesiaGameState,
    HydratedIndonesiaGameState
> {
    isNewEra = $derived(this.gameState.machineState === MachineState.NewEra)
}
