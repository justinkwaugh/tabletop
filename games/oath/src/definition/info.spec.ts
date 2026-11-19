import { describe, expect, it } from 'vitest'
import { OathInfo } from './info.js'
import { GAME_VERSION } from './version.js'

describe('OathInfo', () => {
    it('is a public title named Oath', () => {
        expect(OathInfo.metadata).toMatchObject({ name: 'Oath', beta: false })
        expect(OathInfo.metadata.visibility).toBeUndefined()
    })

    it('links the publisher that sells the game', () => {
        expect(OathInfo.metadata.publisher).toEqual({
            name: 'Buried Giant Studios',
            url: 'https://buriedgiant.shop/products/oath',
            sellsGame: true
        })
    })

    it('reports the generated game version', () => {
        expect(OathInfo.metadata.version).toBe(GAME_VERSION)
    })
})
