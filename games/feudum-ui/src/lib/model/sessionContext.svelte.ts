import { createGameSessionContext } from '@tabletop/frontend-components'
import { FeudumGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<FeudumGameSession>()

export function setGameSession(session: FeudumGameSession) {
    setContext(session)
}

export function getGameSession(): FeudumGameSession {
    return getContext()
}
