import { createGameSessionContext } from '@tabletop/frontend-components'
import { MatrxGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<MatrxGameSession>()

export function setGameSession(session: MatrxGameSession) {
    setContext(session)
}

export function getGameSession(): MatrxGameSession {
    return getContext()
}
