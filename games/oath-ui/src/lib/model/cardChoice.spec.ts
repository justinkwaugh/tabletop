import { describe, expect, it } from 'vitest'
import { CardKind, PowerChoiceKind, Region } from '@tabletop/oath'
import { powerChoiceCard, powerChoiceCards, powerUseCards, toggleSingle, togglePick, type CardResolvers } from './cardChoice.js'

const resolve: CardResolvers = {
    knownRelicAt: (slotId) => (slotId === 'c1.relic.0' ? 'relic.map' : undefined),
    faceupSiteCardAt: (siteId) => (siteId === 'c1' ? 'site.plains' : undefined),
    relicSlotLabel: (slotId) => `relic ${slotId}`,
    facedownAdviserLabel: (playerId, index) => `${playerId}'s facedown adviser ${index + 1}`,
    facedownAdviserBack: (_playerId, index) => (index === 2 ? CardKind.Vision : CardKind.Denizen),
    siteLabel: (siteId) => `site ${siteId}`,
    warbandOwnerName: (owner) => `${owner}'s`
}

describe('a card row: tap to pick, tap again to untap', () => {
    it('a single pick replaces, and a second tap on the picked card untaps it', () => {
        expect(togglePick([], 'a', 1)).toEqual(['a'])
        expect(togglePick(['a'], 'b', 1)).toEqual(['b'])
        expect(togglePick(['a'], 'a', 1)).toEqual([])
        expect(toggleSingle(undefined, 'a')).toBe('a')
        expect(toggleSingle('a', 'b')).toBe('b')
        expect(toggleSingle('a', 'a')).toBeUndefined()
    })

    it('a multi-pick adds up to its limit and no further, and untaps any', () => {
        expect(togglePick(['a'], 'b', 2)).toEqual(['a', 'b'])
        expect(togglePick(['a', 'b'], 'c', 2)).toEqual(['a', 'b'])
        expect(togglePick(['a', 'b'], 'a', 2)).toEqual(['b'])
    })
})

describe('a power choice drawn as cards', () => {
    it('a card by its face, a relic by its face when known and a back when not, a facedown adviser by a back', () => {
        expect(powerChoiceCard({ kind: PowerChoiceKind.Card, cardId: 'denizen.nomad.tents' }, '0', resolve)).toMatchObject({ cardId: 'denizen.nomad.tents' })
        expect(powerChoiceCard({ kind: PowerChoiceKind.RelicSlot, slotId: 'c1.relic.0' }, '0', resolve)).toMatchObject({ cardId: 'relic.map' })
        expect(powerChoiceCard({ kind: PowerChoiceKind.RelicSlot, slotId: 'p1.relic.0' }, '0', resolve)).toEqual({ key: '0', back: CardKind.Relic, label: 'relic p1.relic.0' })
        expect(powerChoiceCard({ kind: PowerChoiceKind.FacedownAdviser, playerId: 'ann', index: 1 }, '0', resolve)).toEqual({ key: '0', back: CardKind.Denizen, label: "ann's facedown adviser 2" })
        expect(powerChoiceCard({ kind: PowerChoiceKind.FacedownAdviser, playerId: 'ann', index: 2 }, '0', resolve)).toEqual({ key: '0', back: CardKind.Vision, label: "ann's facedown adviser 3" })
    })

    it('warbands at a site by the site card, captioned with the group; on a board they are no card', () => {
        const atSite = { kind: PowerChoiceKind.Warbands, group: { at: { kind: 'site', siteId: 'c1' }, owner: 'ann', count: 2 } } as const
        expect(powerChoiceCard(atSite, '0', resolve)).toMatchObject({ cardId: 'site.plains', caption: "2 ann's" })
        const onBoard = { kind: PowerChoiceKind.Warbands, group: { at: { kind: 'board', playerId: 'ann' }, owner: 'ann', count: 2 } } as const
        expect(powerChoiceCard(onBoard, '0', resolve)).toBeUndefined()
    })

    it('a row is all cards or none: a region among cards keeps the list control', () => {
        const card = { kind: PowerChoiceKind.Card, cardId: 'denizen.nomad.tents' } as const
        expect(powerChoiceCards([card, card], resolve)?.map((c) => c.key)).toEqual(['0', '1'])
        expect(powerChoiceCards([card, { kind: PowerChoiceKind.Region, region: Region.Cradle }], resolve)).toBeUndefined()
    })
})

describe('a power offered for use drawn as its card', () => {
    it('is keyed by card and power, so one card with two powers gives two picks, and captioned with its text', () => {
        const cards = powerUseCards([
            { cardId: 'denizen.nomad.tents', powerIndex: 0, text: 'first' },
            { cardId: 'denizen.nomad.tents', powerIndex: 1, text: 'second' }
        ])
        expect(new Set(cards.map((card) => card.key)).size).toBe(2)
        expect(cards.map((card) => card.caption)).toEqual(['first', 'second'])
        expect(cards.every((card) => card.cardId === 'denizen.nomad.tents')).toBe(true)
    })
})
