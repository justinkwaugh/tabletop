import { SolGameSession } from './SolGameSession.svelte.js'
import { createGameSessionContext } from '@tabletop/frontend-components'

const [getContext, setContext] = createGameSessionContext<SolGameSession>()

export function setGameSession(session: SolGameSession) {
    setContext(session)
}

export function getGameSession(): SolGameSession {
    return getContext()
}
