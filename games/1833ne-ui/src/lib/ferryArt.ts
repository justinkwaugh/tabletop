import AllynsPointFerry from './images/ferries/allyns-point.svg'
import AllynsPointLuxury from './images/ferries/allyns-point-luxury.svg'
import FallRiverFerry from './images/ferries/fall-river.svg'
import FallRiverLuxury from './images/ferries/fall-river-luxury.svg'
import NewHavenFerry from './images/ferries/new-haven.svg'
import NewHavenLuxury from './images/ferries/new-haven-luxury.svg'
import ProvidenceFerry from './images/ferries/providence.svg'
import ProvidenceLuxury from './images/ferries/providence-luxury.svg'
import StoningtonFerry from './images/ferries/stonington.svg'
import StoningtonLuxury from './images/ferries/stonington-luxury.svg'

/** Each ferry's marker, a steamship over its colour, by its hex. */
export const FerryArt: Readonly<Record<string, string>> = {
    C26: NewHavenFerry,
    E26: AllynsPointFerry,
    F27: StoningtonFerry,
    F25: ProvidenceFerry,
    G26: FallRiverFerry
}

/** The same marker ringed in gold and doubled, for the ferry the Luxury Ferry Service serves. */
export const LuxuryFerryArt: Readonly<Record<string, string>> = {
    C26: NewHavenLuxury,
    E26: AllynsPointLuxury,
    F27: StoningtonLuxury,
    F25: ProvidenceLuxury,
    G26: FallRiverLuxury
}
