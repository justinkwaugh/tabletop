import { createGameSessionContext } from '@tabletop/frontend-components'
import { PunctGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<PunctGameSession>()

export function setGameSession(session: PunctGameSession) {
    setContext(session)
}

export function getGameSession(): PunctGameSession {
    return getContext()
}
