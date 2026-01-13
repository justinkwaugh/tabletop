import { createGameSessionContext } from '@tabletop/frontend-components'
import { EstatesGameSession } from './EstatesGameSession.svelte.js'

const [getContext, setContext] = createGameSessionContext<EstatesGameSession>()

export function setGameSession(session: EstatesGameSession) {
    setContext(session)
}

export function getGameSession(): EstatesGameSession {
    return getContext()
}
