import { createGameSessionContext } from '@tabletop/frontend-components'
import { YGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<YGameSession>()

export function setGameSession(session: YGameSession) {
    setContext(session)
}

export function getGameSession(): YGameSession {
    return getContext()
}
