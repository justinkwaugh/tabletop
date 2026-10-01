import { assert, assertExists } from '@tabletop/common'
import { Banner, MAX_SUPPLY, OathType, PlayerStatus } from '@tabletop/oath'
import { bannerFiles, tileFiles } from './imageManifest.generated.js'
import { imageNamed, indexByName } from './manifestIndex.js'

const tiles = indexByName(tileFiles)
const banners = indexByName(bannerFiles)

export function favorTokenImage(): string {
    return imageNamed(tiles, 'token.favor')
}
export function secretTokenImage(): string {
    return imageNamed(tiles, 'token.secret')
}
export function visionsMarkerImage(): string {
    return imageNamed(tiles, 'marker.visions')
}
// R-2.11.a — the Oathkeeper title on the side it currently shows.
export function oathkeeperTileImage(usurper: boolean): string {
    return imageNamed(tiles, usurper ? 'oathkeeper.usurper' : 'oathkeeper')
}
// R-2.10 — one card prints the Oathkeeper goal on top and the Successor goal
// (R-3.3.1) below; callers crop by `object-position`.
export function goalCardImage(oathType: OathType): string {
    return imageNamed(tiles, `goal.${oathType}`)
}
// R-2.5.1 — the People's Favor has a Mob side.
export function bannerImage(banner: Banner, mobSide = false): string {
    return imageNamed(
        banners,
        banner === Banner.PeoplesFavor && mobSide ? 'peoplesFavor.mob' : banner
    )
}

// R-2.3, R-6.6.2.a — the trait under a Reliquary space, in the placard's order
// (`data/reliquary.ts` keeps the text in the same order).
const TRAITS = ['brutal', 'decadent', 'careless', 'greedy'] as const
export function reliquaryTraitImage(spaceIndex: number): string {
    const trait = TRAITS[spaceIndex]
    assertExists(trait, `The Reliquary has no space ${spaceIndex + 1}`)
    return imageNamed(tiles, `trait.${trait}`)
}

// Three track designs, not eleven: every Exile board prints the same track,
// as does every Citizen board.
export function supplyTrackImage(status: PlayerStatus): string {
    return imageNamed(tiles, `track.${status}`)
}

// Measured as fractions of the width; circles run Supply 7 down to 0 left to
// right.
export const SUPPLY_TRACK = {
    centers: [0.0844, 0.2054, 0.3264, 0.4474, 0.5684, 0.6894, 0.8104, 0.9314],
    diameter: 0.09,
    aspect: 2020 / 222,
    indexOf(supply: number): number {
        assert(
            Number.isInteger(supply) && supply >= 0 && supply <= MAX_SUPPLY,
            `Supply ${supply} is not on the track`
        )
        return MAX_SUPPLY - supply
    }
} as const

// R-2.3 — the Imperial Reliquary placard; the four spaces' centres and width as
// fractions of the placard's width, measured off the art.
export function reliquaryPlacardImage(): string {
    return imageNamed(tiles, 'reliquary.placard')
}
export const RELIQUARY_PLACARD = {
    centers: [0.136, 0.376, 0.621, 0.864],
    space: 0.1975,
    cy: 0.62,
    aspect: 3380 / 1038
} as const
