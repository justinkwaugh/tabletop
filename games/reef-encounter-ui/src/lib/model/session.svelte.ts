import { GameSession } from '@tabletop/frontend-components'
import type {
    HydratedReefEncounterGameState,
    ReefEncounterProjectedState
} from '@tabletop/reef-encounter'

export class ReefEncounterGameSession extends GameSession<
    ReefEncounterProjectedState,
    HydratedReefEncounterGameState
> {}
