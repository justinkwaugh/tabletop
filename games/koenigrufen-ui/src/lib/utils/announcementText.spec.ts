import {
    Bonus,
    Contract,
    contractDefinition,
    newAnnouncements,
    Side,
    type Announcements
} from '@tabletop/koenigrufen'
import { describe, expect, it } from 'vitest'
import {
    announcedValue,
    announcementsSummary,
    bonusResultLine,
    doubleGroups,
    doubleTargetName,
    doubleWord,
    shortTargetName
} from './announcementText.js'

const names = { name: (playerId: string) => playerId.toUpperCase() }

describe('announcement text', () => {
    it('prices an announced bonus, doubling for Solo contracts and multiplying Valat by the game', () => {
        expect(announcedValue(Bonus.Uhu, contractDefinition(Contract.Rufer))).toBe(4)
        expect(announcedValue(Bonus.Uhu, contractDefinition(Contract.Solodreier))).toBe(8)
        expect(announcedValue(Bonus.Valat, contractDefinition(Contract.Dreier))).toBe(32)
    })

    it('names the next double and what it raises', () => {
        const announcements: Announcements = {
            ...newAnnouncements(),
            game: [{ doubles: 1 }, { defenderId: 'b', doubles: 2 }]
        }
        expect(doubleWord(announcements, { kind: 'game' })).toBe('Re')
        expect(doubleWord(announcements, { kind: 'game', defenderId: 'b' })).toBe('Sub')
        expect(doubleTargetName({ kind: 'game', defenderId: 'b' }, names, 'a')).toBe(
            'the game with B'
        )
        expect(
            doubleTargetName({ kind: 'bonus', bonus: Bonus.Trull, side: Side.Defenders }, names)
        ).toBe('the defenders’ Trull')
    })

    it('groups the doubles on offer by word, with short labels', () => {
        const announcements: Announcements = {
            ...newAnnouncements(),
            game: [{ doubles: 1 }],
            bonuses: [
                { bonus: Bonus.Trull, side: Side.Declarer, playerId: 'a', doubles: 0 },
                { bonus: Bonus.Pagat, side: Side.Declarer, playerId: 'a', doubles: 2 }
            ]
        }
        const trull = { kind: 'bonus', bonus: Bonus.Trull, side: Side.Declarer } as const
        const pagat = { kind: 'bonus', bonus: Bonus.Pagat, side: Side.Declarer } as const
        const groups = doubleGroups(announcements, [{ kind: 'game' }, trull, pagat])
        expect(groups.map((group) => [group.word, group.targets.length])).toEqual([
            ['Kontra', 1],
            ['Re', 1],
            ['Sub', 1]
        ])
        expect(groups[0]?.targets).toEqual([trull])
        expect(shortTargetName(trull, names)).toBe('Trull')
        expect(shortTargetName({ kind: 'game' }, names)).toBe('Game')
        expect(shortTargetName({ kind: 'game', defenderId: 'b' }, names, 'a')).toBe('Game with B')
        expect(shortTargetName({ kind: 'game', defenderId: 'b' }, names, 'b')).toBe('Game')
    })

    it('summarises what has been said', () => {
        const announcements: Announcements = {
            ...newAnnouncements(),
            game: [{ doubles: 1 }],
            bonuses: [
                { bonus: Bonus.Pagat, side: Side.Declarer, playerId: 'a', doubles: 2 },
                { bonus: Bonus.Trull, side: Side.Defenders, playerId: 'c', doubles: 0 }
            ]
        }
        expect(announcementsSummary(announcements, names)).toEqual([
            'Game Kontra',
            'Pagat (Re)',
            'Trull (defenders)'
        ])
    })

    it('describes a scored bonus', () => {
        expect(
            bonusResultLine({
                bonus: Bonus.Kakadu,
                side: Side.Declarer,
                announced: true,
                doubles: 1,
                made: false,
                points: -12
            })
        ).toBe('Kakadu · declarer’s · announced (Kontra) · lost')
    })
})
