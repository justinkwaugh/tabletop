import { createGameSessionContext } from '@tabletop/frontend-components'
import { GipfGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<GipfGameSession>()

export function setGameSession(session: GipfGameSession) {
    setContext(session)
}

export function getGameSession(): GipfGameSession {
    return getContext()
}
