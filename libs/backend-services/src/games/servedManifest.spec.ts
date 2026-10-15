import { describe, expect, it } from 'vitest'
import type { SiteManifest, SiteManifestGame } from '@tabletop/games-config'
import { servedManifest } from './servedManifest.js'

const game = (packageId: string, logicVersion: string, uiVersion: string): SiteManifestGame => ({
    gameId: packageId,
    packageId,
    logicVersion,
    uiVersion
})

const loaded: SiteManifest = {
    frontend: { version: '1.0.0' },
    games: [game('oath', '1.0.0', '1.0.0'), game('sol', '2.0.0', '3.0.0')]
}

describe('servedManifest', () => {
    it('reports the live publication of a game whose logic this process runs', () => {
        const live: SiteManifest = {
            ...loaded,
            games: [game('oath', '1.0.0', '1.1.0'), game('sol', '2.0.0', '3.0.0')]
        }
        expect(servedManifest(live, loaded).games).toEqual(live.games)
    })

    it('keeps the loaded publication of a game whose logic changed', () => {
        const live: SiteManifest = {
            ...loaded,
            games: [game('oath', '2.0.0', '2.0.0'), game('sol', '2.0.0', '3.1.0')]
        }
        expect(servedManifest(live, loaded).games).toEqual([
            game('oath', '1.0.0', '1.0.0'),
            game('sol', '2.0.0', '3.1.0')
        ])
    })

    it('leaves out games this process never loaded', () => {
        const live: SiteManifest = {
            ...loaded,
            games: [...loaded.games, game('kogge', '0.1.0', '0.1.0')]
        }
        expect(servedManifest(live, loaded).games.map((entry) => entry.packageId)).toEqual([
            'oath',
            'sol'
        ])
    })

    it('follows the live manifest when a game is withdrawn', () => {
        const live: SiteManifest = { ...loaded, games: [game('sol', '2.0.0', '3.0.0')] }
        expect(servedManifest(live, loaded).games).toEqual([game('sol', '2.0.0', '3.0.0')])
    })

    it('follows the live frontend, which needs no replacement process', () => {
        const live: SiteManifest = { ...loaded, frontend: { version: '2.0.0' } }
        expect(servedManifest(live, loaded).frontend).toEqual({ version: '2.0.0' })
    })

    it('keeps the loaded publication when the same package names a different game', () => {
        const renamed = { ...game('oath', '1.0.0', '1.1.0'), gameId: 'oath-renamed' }
        const live: SiteManifest = { ...loaded, games: [renamed, game('sol', '2.0.0', '3.0.0')] }
        expect(servedManifest(live, loaded).games[0]).toEqual(game('oath', '1.0.0', '1.0.0'))
    })
})
