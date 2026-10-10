import { createGameSessionContext } from '@tabletop/frontend-components'
import { SantiagoGameSession } from '../stores/SantiagoGameSession.svelte.js'

const [getContext, setContext] = createGameSessionContext<SantiagoGameSession>()

export function setGameSession(session: SantiagoGameSession) {
    setContext(session)
}

export function getGameSession(): SantiagoGameSession {
    return getContext()
}
