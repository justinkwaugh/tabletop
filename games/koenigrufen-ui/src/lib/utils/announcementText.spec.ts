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
    bonusHeading,
    bonusResultLine,
    bonusSummary,
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

    it('says what a bonus takes and what it is worth unannounced', () => {
        const rufer = contractDefinition(Contract.Rufer)
        expect(bonusHeading(Bonus.Uhu, rufer)).toBe('Uhu (4)')
        expect(bonusSummary(Bonus.Uhu, rufer)).toBe(
            'Win the second-last trick with trump II. Worth 2 unannounced.'
        )
        expect(bonusSummary(Bonus.Trull, contractDefinition(Contract.Solodreier))).toBe(
            'Take Pagat, Mond and Sküs. Worth 2 unannounced.'
        )
        expect(bonusSummary(Bonus.Valat, contractDefinition(Contract.Dreier))).toBe(
            'Win every trick. Replaces the game and every other bonus. Worth 16 unannounced.'
        )
        expect(bonusSummary(Bonus.Sack, rufer)).toBe(
            'Take 46 of 70 card points. Scores only when announced.'
        )
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
                { bonus: Bonus.Trull, side: Side.Declarer, doubles: 0 },
                { bonus: Bonus.Pagat, side: Side.Declarer, doubles: 2 }
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
                { bonus: Bonus.Pagat, side: Side.Declarer, doubles: 2 },
                { bonus: Bonus.Trull, side: Side.Defenders, doubles: 0 }
            ]
        }
        expect(announcementsSummary(announcements, names)).toEqual([
            'Game Kontra',
            'Pagat (Re)',
            'Trull (defenders)'
        ])
    })

    it('describes a scored bonus as a short phrase', () => {
        const result = {
            bonus: Bonus.Kakadu,
            side: Side.Declarer,
            announced: true,
            doubles: 1,
            made: false,
            points: -12
        }
        expect(bonusResultLine(result)).toBe('Declarer announced and lost Kakadu (Kontra)')
        expect(
            bonusResultLine({
                ...result,
                bonus: Bonus.Trull,
                announced: false,
                doubles: 0,
                made: true
            })
        ).toBe('Declarer made Trull')
        expect(bonusResultLine({ ...result, side: Side.Defenders, doubles: 0, made: true })).toBe(
            'Defenders announced and made Kakadu'
        )
        expect(bonusResultLine({ ...result, announced: false, doubles: 0 })).toBe(
            'Declarer lost Kakadu'
        )
    })
})
