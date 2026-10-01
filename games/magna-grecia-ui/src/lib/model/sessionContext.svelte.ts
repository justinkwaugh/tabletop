import { createGameSessionContext } from '@tabletop/frontend-components'
import { MagnaGreciaGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<MagnaGreciaGameSession>()

export function setGameSession(session: MagnaGreciaGameSession) {
    setContext(session)
}

export function getGameSession(): MagnaGreciaGameSession {
    return getContext()
}
