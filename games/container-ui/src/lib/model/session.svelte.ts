import { GameSession } from '@tabletop/frontend-components'
import type { HydratedContainerGameState, ContainerGameState } from '@tabletop/container'

export class ContainerGameSession extends GameSession<
    ContainerGameState,
    HydratedContainerGameState
> {}
