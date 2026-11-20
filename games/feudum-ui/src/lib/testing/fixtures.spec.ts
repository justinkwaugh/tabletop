import {
    conservationBreaks,
    FeudumCanonicalStateValidator,
    handSizeFor,
    HydratedFeudumGameState
} from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixtureNamed, FixtureNames, SeatNames, type Fixture } from './fixtures.js'

/** The fixtures hold positions a game can hold, under invented names, and reach no production code. */

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe.each(FixtureNames)('the fixture %s', (name) => {
    it('R-1.1 holds to the logic: its state passes the validators, and every good and coin is accounted for', async () => {
        const { host } = await fixtureNamed(name).build()
        expect(conservationBreaks(host.state)).toEqual([])
        expect(FeudumCanonicalStateValidator.Check(host.state)).toBe(true)
    })

    it('R-3.1 could be reached: each hand as big as its pouch allows, each rank as its markers say', async () => {
        const { host } = await fixtureNamed(name).build()
        const state = new HydratedFeudumGameState(structuredClone(host.state))
        for (const player of state.players) {
            expect(player.handCount).toBe(player.hand?.length ?? 0)
            if (player.handCount + player.played.length > 0) {
                expect(player.handCount + player.played.length).toBe(handSizeFor(player.pouch))
            }
        }
        const ranks = structuredClone(state.guilds)
        state.recomputeRanks()
        expect(state.guilds).toEqual(ranks)
    })

    it('R-1.4 says so when a hand arranged it: only real Actions otherwise', async () => {
        const fixture: Fixture = fixtureNamed(name)
        const { host } = await fixture.build()
        expect(host.edits > 0).toBe(fixture.arranged !== undefined)
    })

    it('R-1.4 seats invented names', async () => {
        const { host } = await fixtureNamed(name).build()
        const names = host.game.players.map((player) => player.name)
        expect(SeatNames).toEqual(expect.arrayContaining(names))
    })
})

describe('the fixture loader', () => {
    it('a name that is no fixture throws, naming those that are', () => {
        expect(() => fixtureNamed('setup-gods')).toThrow(
            /^No fixture named "setup-gods"\. There are: setup-goods, /
        )
    })

    it('no route and no production module loads the testing folder', async () => {
        const testing = Object.keys(import.meta.glob('/src/lib/testing/**/*.{ts,svelte}'))
        expect(testing).toContain('/src/lib/testing/fixtures.ts')
        const loaded: string[] = []
        vi.resetModules()
        for (const path of testing) {
            vi.doMock(path, () => {
                loaded.push(path)
                throw new Error(`${path} is loaded`)
            })
        }
        try {
            const { UiDefinition } = await import('$lib/definitions/definition.js')
            await UiDefinition.runtime()
            await import('../../routes/+page.svelte')
        } finally {
            testing.forEach((path) => vi.doUnmock(path))
        }
        expect(loaded).toEqual([])
    }, 60_000)
})
