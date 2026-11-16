import { createGameSessionContext } from '@tabletop/frontend-components'
import { ZertzGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<ZertzGameSession>()

export function setGameSession(session: ZertzGameSession) {
    setContext(session)
}

export function getGameSession(): ZertzGameSession {
    return getContext()
}
