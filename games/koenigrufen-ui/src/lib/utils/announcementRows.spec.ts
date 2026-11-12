import { describe, expect, it } from 'vitest'
import {
    Bonus,
    Contract,
    contractDefinition,
    newAnnouncements,
    Side,
    type Announcements
} from '@tabletop/koenigrufen'
import { announcementSections, chosenItems } from './announcementRows.js'

const names = { name: (playerId: string) => playerId.toUpperCase() }

describe('the announcement table', () => {
    it('labels each bonus with its announced and silent value', () => {
        const [bonuses] = announcementSections(
            [Bonus.Trull, Bonus.Sack],
            [],
            newAnnouncements(),
            contractDefinition(Contract.Rufer),
            names
        )
        expect(bonuses?.columns).toEqual(['Announced', 'Silent'])
        expect(bonuses?.rows.map((row) => [row.name, ...row.values])).toEqual([
            ['Trull', '2', '1'],
            ['Sack', '2', '']
        ])
    })

    it('groups doubles by their word, with the value now and doubled', () => {
        const announcements: Announcements = {
            ...newAnnouncements(),
            game: [{ doubles: 1 }],
            bonuses: [{ bonus: Bonus.Pagat, side: Side.Declarer, doubles: 0 }]
        }
        const sections = announcementSections(
            [],
            [{ kind: 'game' }, { kind: 'bonus', bonus: Bonus.Pagat, side: Side.Declarer }],
            announcements,
            contractDefinition(Contract.Rufer),
            names
        )
        expect(sections.map((section) => section.title)).toEqual(['Kontra', 'Re'])
        const [kontra, re] = sections
        expect(kontra?.rows.map((row) => [row.name, ...row.values])).toEqual([['Pagat', '2', '4']])
        expect(re?.rows.map((row) => [row.name, ...row.values])).toEqual([['Game', '2', '4']])
        expect(re?.rows[0]?.heading).toBe('Re on the game')
    })

    it('lists what is ticked in table order', () => {
        const sections = announcementSections(
            [Bonus.Trull, Bonus.Pagat],
            [{ kind: 'game' }],
            newAnnouncements(),
            contractDefinition(Contract.Rufer),
            names
        )
        expect(chosenItems(sections, ['game:', 'bonus:pagat', 'bonus:trull'])).toEqual([
            'Trull',
            'Pagat',
            'Kontra Game'
        ])
    })
})
