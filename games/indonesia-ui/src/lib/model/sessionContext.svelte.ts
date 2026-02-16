import { createGameSessionContext } from '@tabletop/frontend-components'
import { IndonesiaGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<IndonesiaGameSession>()

export function setGameSession(session: IndonesiaGameSession) {
    setContext(session)
}

export function getGameSession(): IndonesiaGameSession {
    return getContext()
}
