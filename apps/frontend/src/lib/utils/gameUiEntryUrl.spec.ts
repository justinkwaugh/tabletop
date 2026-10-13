import { describe, expect, it } from 'vitest'
import { gameUiEntryUrl } from './gameUiEntryUrl.js'

const game = { packageId: 'the-old-prince', uiVersion: '1.23.0' }
const siteUrl = 'https://site.example.com/_app/immutable/chunks/library.js'

describe('gameUiEntryUrl', () => {
    it('points at the site itself when no game UI base URL is configured', () => {
        expect(gameUiEntryUrl(game, '', siteUrl)).toBe(
            'https://site.example.com/games/the-old-prince/ui/1.23.0/index.js'
        )
    })

    it('points at the configured base URL, keeping its path', () => {
        expect(gameUiEntryUrl(game, 'https://storage.example.com/bucket', siteUrl)).toBe(
            'https://storage.example.com/bucket/games/the-old-prince/ui/1.23.0/index.js'
        )
    })

    it('ignores a trailing slash on the base URL', () => {
        expect(gameUiEntryUrl(game, 'https://storage.example.com/bucket/', siteUrl)).toBe(
            'https://storage.example.com/bucket/games/the-old-prince/ui/1.23.0/index.js'
        )
    })
})
