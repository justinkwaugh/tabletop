import { createContext } from 'svelte'
import { KaivaiGameSession } from './KaivaiGameSession.svelte.js'

const [getContext, setContext] = createContext<KaivaiGameSession>()

export function setGameSession(session: KaivaiGameSession) {
    setContext(session)
}

export function getGameSession(): KaivaiGameSession {
    return getContext()
}
