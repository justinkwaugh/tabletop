import { createGameSessionContext } from '@tabletop/frontend-components'
import { DvonnGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<DvonnGameSession>()

export function setGameSession(session: DvonnGameSession) {
    setContext(session)
}

export function getGameSession(): DvonnGameSession {
    return getContext()
}
