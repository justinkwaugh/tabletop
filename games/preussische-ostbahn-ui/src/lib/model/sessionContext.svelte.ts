import { createGameSessionContext } from '@tabletop/frontend-components'
import { OstbahnGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<OstbahnGameSession>()

export function setGameSession(session: OstbahnGameSession) {
    setContext(session)
}

export function getGameSession(): OstbahnGameSession {
    return getContext()
}
