import { describe, expect, it } from 'vitest'
import { GameVisibility, Role, UserStatus, type GameCatalogEntry } from '@tabletop/common'
import {
    availableCatalogEntries,
    libraryShelfItems,
    librarySeriesById,
    playerCountText,
    titleMaturityLabel,
    titleSeries
} from './libraryTitles.js'

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

describe('titleMaturityLabel', () => {
    it('names the maturity of a title that is not public yet', () => {
        expect(entries.map((entry) => titleMaturityLabel(entry.metadata))).toEqual([
            undefined,
            'Beta',
            'Alpha'
        ])
    })
})

describe('playerCountText', () => {
    it('gives the player range, or one count when it is fixed', () => {
        expect(playerCountText(base.metadata)).toBe('2–4 players')
        expect(playerCountText({ ...base.metadata, maxPlayers: 2 })).toBe('2 players')
    })
})

describe('library shelf series', () => {
    function title(name: string, series?: string): GameCatalogEntry {
        return { ...base, id: name, metadata: { ...base.metadata, name, series } }
    }
    function shelfNames(entries: GameCatalogEntry[]) {
        return libraryShelfItems(entries).map((item) =>
            item.kind === 'series'
                ? `${item.series.name}: ${item.titles.map((entry) => entry.id).join(', ')}`
                : item.title.id
        )
    }

    it('gathers a series into one tile at its own sort position', () => {
        expect(
            shelfNames([
                title('1830', '18xx'),
                title('Bus'),
                title('The Old Prince', '18xx'),
                title('Sol')
            ])
        ).toEqual(['18xx: 1830, The Old Prince', 'Bus', 'Sol'])
    })

    it('leaves a lone title of a series on the main shelf', () => {
        expect(shelfNames([title('Bus'), title('1830', '18xx')])).toEqual(['1830', 'Bus'])
    })

    it('leaves titles of a series this site does not know on the main shelf', () => {
        expect(shelfNames([title('Bus', 'future'), title('Sol', 'future')])).toEqual(['Bus', 'Sol'])
        expect(titleSeries(title('Bus', 'future').metadata)).toBeUndefined()
    })

    it('finds series only by their own ids', () => {
        expect(librarySeriesById('18xx')?.name).toBe('18xx')
        expect(librarySeriesById('constructor')).toBeUndefined()
    })
})
