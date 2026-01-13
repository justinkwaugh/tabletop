import { createGameSessionContext } from '@tabletop/frontend-components'
import { KaivaiGameSession } from './KaivaiGameSession.svelte.js'

const [getContext, setContext] = createGameSessionContext<KaivaiGameSession>()

export function setGameSession(session: KaivaiGameSession) {
    setContext(session)
}

export function getGameSession(): KaivaiGameSession {
    return getContext()
}
