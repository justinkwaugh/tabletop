import { createGameSessionContext } from '@tabletop/frontend-components'
import { BridgesGameSession } from './BridgesGameSession.svelte.js'

const [getContext, setContext] = createGameSessionContext<BridgesGameSession>()

export function setGameSession(session: BridgesGameSession) {
    setContext(session)
}

export function getGameSession(): BridgesGameSession {
    return getContext()
}
