import { createGameSessionContext } from '@tabletop/frontend-components'
import { PowerGridGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<PowerGridGameSession>()

export function setGameSession(session: PowerGridGameSession) {
    setContext(session)
}

export function getGameSession(): PowerGridGameSession {
    return getContext()
}
