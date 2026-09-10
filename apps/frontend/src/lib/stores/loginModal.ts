import { createContext } from 'svelte'

export const [getLoginModal, setLoginModal] = createContext<() => void>()
