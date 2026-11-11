import { createContext } from 'svelte'

export type PlaceLinks = {
    name(locationId: string): string
    reveal(locationId: string): void
}

export const [getPlaceLinks, setPlaceLinks] = createContext<PlaceLinks>()
