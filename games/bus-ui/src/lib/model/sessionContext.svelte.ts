import { createGameSessionContext } from '@tabletop/frontend-components'
import { BusGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<BusGameSession>()

export function setGameSession(session: BusGameSession) {
    setContext(session)
}

export function getGameSession(): BusGameSession {
    return getContext()
}
