import { createGameSessionContext } from '@tabletop/frontend-components'
import { ContainerGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<ContainerGameSession>()

export function setGameSession(session: ContainerGameSession) {
    setContext(session)
}

export function getGameSession(): ContainerGameSession {
    return getContext()
}
