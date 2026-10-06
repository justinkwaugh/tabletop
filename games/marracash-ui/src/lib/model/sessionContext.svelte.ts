import { createGameSessionContext } from '@tabletop/frontend-components'
import { MarracashGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<MarracashGameSession>()

export function setGameSession(session: MarracashGameSession) {
    setContext(session)
}

export function getGameSession(): MarracashGameSession {
    return getContext()
}
