import { createGameSessionContext } from '@tabletop/frontend-components'
import { YinshGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<YinshGameSession>()

export function setGameSession(session: YinshGameSession) {
    setContext(session)
}

export function getGameSession(): YinshGameSession {
    return getContext()
}
