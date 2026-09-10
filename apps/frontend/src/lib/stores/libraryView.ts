import { createContext } from 'svelte'

export type LibraryView = {
    search: string
    scrollTop: number
}

export const [getLibraryView, setLibraryView] = createContext<LibraryView>()
