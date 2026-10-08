import { createGameSessionContext } from '@tabletop/frontend-components'
import { KoggeGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<KoggeGameSession>()

export function setGameSession(session: KoggeGameSession) {
    setContext(session)
}

export function getGameSession(): KoggeGameSession {
    return getContext()
}
