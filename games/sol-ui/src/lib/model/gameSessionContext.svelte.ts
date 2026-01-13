import { createContext } from 'svelte'
import { SolGameSession } from './SolGameSession.svelte.js'

const [getContext, setContext] = createContext<SolGameSession>()

export function setGameSession(session:SolGameSession) {
    setContext(session)
}

export function getGameSession():SolGameSession {
    return getContext()
}
