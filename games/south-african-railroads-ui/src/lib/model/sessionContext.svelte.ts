import { createGameSessionContext } from '@tabletop/frontend-components'
import { SarGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<SarGameSession>()

export function setGameSession(session: SarGameSession) {
    setContext(session)
}

export function getGameSession(): SarGameSession {
    return getContext()
}
