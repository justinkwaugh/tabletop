import { createGameSessionContext } from '@tabletop/frontend-components'
import { StellarHorizonsGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<StellarHorizonsGameSession>()

export function setGameSession(session: StellarHorizonsGameSession) {
    setContext(session)
}

export function getGameSession(): StellarHorizonsGameSession {
    return getContext()
}
