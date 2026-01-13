import { createGameSessionContext } from '@tabletop/frontend-components'
import { FreshFishGameSession } from '../stores/FreshFishGameSession.svelte.js'

const [getContext, setContext] = createGameSessionContext<FreshFishGameSession>()

export function setGameSession(session: FreshFishGameSession) {
    setContext(session)
}

export function getGameSession(): FreshFishGameSession {
    return getContext()
}
