import { createGameSessionContext } from '@tabletop/frontend-components'
import { UrbinoGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<UrbinoGameSession>()

export function setGameSession(session: UrbinoGameSession) {
    setContext(session)
}

export function getGameSession(): UrbinoGameSession {
    return getContext()
}
