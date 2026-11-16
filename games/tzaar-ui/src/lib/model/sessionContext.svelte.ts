import { createGameSessionContext } from '@tabletop/frontend-components'
import { TzaarGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<TzaarGameSession>()

export function setGameSession(session: TzaarGameSession) {
    setContext(session)
}

export function getGameSession(): TzaarGameSession {
    return getContext()
}
