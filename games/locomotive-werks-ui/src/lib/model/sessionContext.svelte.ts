import { createGameSessionContext } from '@tabletop/frontend-components'
import { LwGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<LwGameSession>()

export function setGameSession(session: LwGameSession) {
    setContext(session)
}

export function getGameSession(): LwGameSession {
    return getContext()
}
