import { describe, expect, it } from 'vitest'
import { Contract, contractDefinition } from '../components/contracts.js'
import {
    announceableBonuses,
    applyAnnouncement,
    Bonus,
    doubleTargets,
    isAnnouncingOver,
    newAnnouncements,
    Side,
    validateAnnouncement,
    type AnnouncingContext
} from './announcements.js'

function speaker(
    contract: Contract,
    playerId: string,
    side: Side,
    extra: Partial<AnnouncingContext> = {}
): AnnouncingContext {
    return {
        definition: contractDefinition(contract),
        playerId,
        side,
        declarerId: 'a',
        defenderIds: ['b', 'c', 'd'],
        kontraAllowed: true,
        calledKingInPlay: true,
        ...extra
    }
}

describe('announcements', () => {
    it('offers King ultimo only to declarer’s side of a king-calling contract', () => {
        const announcements = newAnnouncements()
        expect(
            announceableBonuses(announcements, speaker(Contract.Rufer, 'a', Side.Declarer))
        ).toEqual([
            Bonus.Trull,
            Bonus.FourKings,
            Bonus.KingUltimo,
            Bonus.Pagat,
            Bonus.Uhu,
            Bonus.Kakadu,
            Bonus.Quapil,
            Bonus.Valat,
            Bonus.Sack
        ])
        expect(
            announceableBonuses(announcements, speaker(Contract.Rufer, 'b', Side.Defenders))
        ).not.toContain(Bonus.KingUltimo)
        expect(
            announceableBonuses(announcements, speaker(Contract.Dreier, 'a', Side.Declarer))
        ).not.toContain(Bonus.KingUltimo)
    })

    it('allows only Valat in Farbensolo and no bonuses in negative games', () => {
        const announcements = newAnnouncements()
        expect(
            announceableBonuses(announcements, speaker(Contract.Farbensolo, 'a', Side.Declarer))
        ).toEqual([Bonus.Valat])
        expect(
            announceableBonuses(announcements, speaker(Contract.Bettel, 'a', Side.Declarer))
        ).toEqual([])
    })

    it('alternates Kontra, Re and Sub between the sides, up to Sub', () => {
        const announcements = newAnnouncements()
        const declarer = speaker(Contract.Rufer, 'a', Side.Declarer)
        const defender = speaker(Contract.Rufer, 'b', Side.Defenders)
        expect(doubleTargets(announcements, declarer)).toEqual([])
        expect(doubleTargets(announcements, defender)).toEqual([{ kind: 'game' }])
        applyAnnouncement(announcements, defender, [], [{ kind: 'game' }])
        expect(doubleTargets(announcements, defender)).toEqual([])
        expect(doubleTargets(announcements, declarer)).toEqual([{ kind: 'game' }])
        applyAnnouncement(announcements, declarer, [Bonus.Trull], [{ kind: 'game' }])
        expect(doubleTargets(announcements, defender)).toEqual([
            { kind: 'game' },
            { kind: 'bonus', bonus: Bonus.Trull, side: Side.Declarer }
        ])
        applyAnnouncement(announcements, defender, [], [{ kind: 'game' }])
        expect(announcements.game).toEqual([{ doubles: 3 }])
        expect(doubleTargets(announcements, declarer)).toEqual([])
    })

    it('lets each defender of a negative game double alone', () => {
        const announcements = newAnnouncements()
        const declarer = speaker(Contract.Bettel, 'a', Side.Declarer)
        const b = speaker(Contract.Bettel, 'b', Side.Defenders)
        expect(doubleTargets(announcements, b)).toEqual([{ kind: 'game', defenderId: 'b' }])
        applyAnnouncement(announcements, b, [], [{ kind: 'game', defenderId: 'b' }])
        expect(doubleTargets(announcements, declarer)).toEqual([{ kind: 'game', defenderId: 'b' }])
        expect(doubleTargets(announcements, speaker(Contract.Bettel, 'c', Side.Defenders))).toEqual(
            [{ kind: 'game', defenderId: 'c' }]
        )
    })

    it('forbids Kontra once the called King is in the talon', () => {
        const defender = speaker(Contract.Rufer, 'b', Side.Defenders, { kontraAllowed: false })
        expect(doubleTargets(newAnnouncements(), defender)).toEqual([])
    })

    it('rejects a bonus already announced by the same side, or a double not on offer', () => {
        const announcements = newAnnouncements()
        const declarer = speaker(Contract.Rufer, 'a', Side.Declarer)
        applyAnnouncement(announcements, declarer, [Bonus.Pagat], [])
        expect(validateAnnouncement(announcements, declarer, [Bonus.Pagat], [])).toBeDefined()
        expect(validateAnnouncement(announcements, declarer, [], [{ kind: 'game' }])).toBeDefined()
    })

    it('ends once everyone has spoken and the last three passed', () => {
        const announcements = newAnnouncements()
        const context = speaker(Contract.Rufer, 'a', Side.Declarer)
        applyAnnouncement(announcements, context, [], [])
        applyAnnouncement(announcements, context, [], [])
        applyAnnouncement(announcements, context, [], [])
        expect(isAnnouncingOver(announcements, 4)).toBe(false)
        applyAnnouncement(announcements, context, [Bonus.Trull], [])
        applyAnnouncement(announcements, context, [], [])
        applyAnnouncement(announcements, context, [], [])
        expect(isAnnouncingOver(announcements, 4)).toBe(false)
        applyAnnouncement(announcements, context, [], [])
        expect(isAnnouncingOver(announcements, 4)).toBe(true)
    })
})
