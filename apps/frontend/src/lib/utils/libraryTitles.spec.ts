import { describe, expect, it } from 'vitest'
import { GameVisibility, Role, UserStatus, type GameCatalogEntry } from '@tabletop/common'
import { availableCatalogEntries } from './libraryTitles.js'

const base: GameCatalogEntry = {
    id: 'public',
    thumbnailUrl: '/cover.jpg',
    metadata: {
        name: 'The Public',
        designer: '',
        description: '',
        year: '',
        minPlayers: 2,
        maxPlayers: 4,
        defaultPlayerCount: 3,
        version: '1',
        beta: false
    }
}
const entries = [
    base,
    { ...base, id: 'beta', metadata: { ...base.metadata, name: 'Beta', beta: true } },
    {
        ...base,
        id: 'alpha',
        metadata: { ...base.metadata, name: 'Alpha', beta: true, visibility: GameVisibility.Alpha }
    }
]

describe('catalog visibility after merging alpha support', () => {
    it('shows only public entries to visitors', () => {
        expect(availableCatalogEntries(entries).map((entry) => entry.id)).toEqual(['public'])
    })
    it.each([
        { roles: [Role.BetaTester], ids: ['beta', 'public'] },
        { roles: [Role.AlphaTester], ids: ['alpha', 'public'] },
        { roles: [Role.Admin], ids: ['alpha', 'beta', 'public'] }
    ])('preserves role visibility and title sorting for $roles', ({ roles, ids }) => {
        const user = { id: 'test', roles, status: UserStatus.Active, externalIds: [] }
        expect(availableCatalogEntries(entries, user).map((entry) => entry.id)).toEqual(ids)
    })
})
