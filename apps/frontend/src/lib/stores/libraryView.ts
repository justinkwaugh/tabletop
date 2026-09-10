import { createContext } from 'svelte'

export type LibraryView = {
    scrollTop: number
}

export const [getLibraryView, setLibraryView] = createContext<LibraryView>()
