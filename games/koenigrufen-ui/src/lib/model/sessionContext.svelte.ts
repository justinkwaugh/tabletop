import { createGameSessionContext } from '@tabletop/frontend-components'
import { KoenigrufenGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<KoenigrufenGameSession>()

export function setGameSession(session: KoenigrufenGameSession) {
    setContext(session)
}

export function getGameSession(): KoenigrufenGameSession {
    return getContext()
}
