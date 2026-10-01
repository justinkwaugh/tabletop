import { describe, expect, it } from 'vitest'
import { Banner, OathType, PlayerStatus } from '@tabletop/oath'
import {
    bannerImage,
    favorTokenImage,
    goalCardImage,
    reliquaryPlacardImage,
    reliquaryTraitImage,
    SUPPLY_TRACK,
    supplyTrackImage,
    oathkeeperTileImage,
    secretTokenImage,
    visionsMarkerImage
} from './tileImages.js'

describe('tile and banner coverage', () => {
    it('the tokens and the Visions marker resolve', () => {
        expect(favorTokenImage()).toBeDefined()
        expect(secretTokenImage()).toBeDefined()
        expect(visionsMarkerImage()).toBeDefined()
    })

    it('R-2.11.a — the Oathkeeper title has both of its sides', () => {
        expect(oathkeeperTileImage(false)).toBeDefined()
        expect(oathkeeperTileImage(true)).toBeDefined()
        expect(oathkeeperTileImage(true)).not.toEqual(oathkeeperTileImage(false))
    })

    it('R-2.10 — every Oath has its goal reference', () => {
        for (const oath of Object.values(OathType)) {
            expect(goalCardImage(oath), oath).toBeDefined()
        }
    })

    it('R-2.3 — all four Reliquary traits resolve, and a fifth space has none', () => {
        const urls = [0, 1, 2, 3].map(reliquaryTraitImage)
        expect(urls.every(Boolean)).toBe(true)
        expect(new Set(urls).size).toBe(4)
        expect(() => reliquaryTraitImage(4)).toThrow()
        expect(reliquaryPlacardImage()).toBeDefined()
    })

    it('R-2.1.5 — every status has its Supply track, and the star is Supply 7', () => {
        for (const status of Object.values(PlayerStatus)) {
            expect(supplyTrackImage(status), status).toBeDefined()
        }
        expect(SUPPLY_TRACK.centers).toHaveLength(8)
        expect(SUPPLY_TRACK.indexOf(7)).toBe(0)
        expect(SUPPLY_TRACK.indexOf(0)).toBe(7)
        expect(() => SUPPLY_TRACK.indexOf(9)).toThrow()
    })

    it("R-2.5, R-2.5.1 — both banners, and the People's Favor's Mob side", () => {
        for (const banner of Object.values(Banner)) {
            expect(bannerImage(banner), banner).toBeDefined()
        }
        expect(bannerImage(Banner.PeoplesFavor, true)).not.toEqual(bannerImage(Banner.PeoplesFavor))
        expect(bannerImage(Banner.DarkestSecret, true)).toEqual(bannerImage(Banner.DarkestSecret))
    })
})
