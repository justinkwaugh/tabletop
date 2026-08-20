import { createGameSessionContext } from '@tabletop/frontend-components'
import { LowenherzGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<LowenherzGameSession>()

export function setGameSession(session: LowenherzGameSession) {
    setContext(session)
}

export function getGameSession(): LowenherzGameSession {
    return getContext()
}
