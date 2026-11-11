import { afterEach, describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedOathGameState, PlayerStatus, Region, mapSlotsFor } from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { cardPreview, type PreviewGroupCard } from './cardPreview.svelte.js'
import { drawnPreviewGroup, mapPreviewGroup, seatPreviewGroup } from './previewGroups.js'
import { useOnEveryCardTable } from '$lib/testing/useOnEveryCardTables.js'

const SACRED_GROUND = 'denizen.nomad.sacred-ground'
const BLOOD_PACT = 'denizen.arcane.blood-pact'
const ROUND_OF_ALE = 'denizen.hearth.a-round-of-ale'
const KEEP = 'denizen.order.keep'
const WOLVES = 'denizen.beast.wolves'
const HALL_OF_DEBATE = 'edifice.hearth.hall-of-debate'
const ENVOY = 'denizen.nomad.special-envoy'
const RELIC_THIEF = 'denizen.discord.relic-thief'
const GARRISON = 'denizen.order.garrison'
const TUTOR = 'denizen.arcane.tutor'
const TYRANT = 'denizen.order.tyrant'
const SCEPTER = 'relic.grand-scepter'
const LONGBOWS = 'denizen.order.longbows'
const TAVERN_SONGS = 'denizen.hearth.tavern-songs'
const CONQUEST = 'vision.conquest'

const ids = (cards: readonly PreviewGroupCard[]) => cards.map((card) => card.cardId)

describe("the map's group: faceup denizens and edifices, Cradle, Provinces, Hinterland", () => {
    it('reads each region top to bottom and each row left to right, with no site card or relic', () => {
        const state = new HydratedOathGameState(useOnEveryCardTable('envoy').state)
        expect(ids(mapPreviewGroup(state))).toEqual([
            SACRED_GROUND,
            BLOOD_PACT,
            ROUND_OF_ALE,
            KEEP,
            WOLVES
        ])
        expect(mapPreviewGroup(state).map((card) => card.label)).toEqual([
            'Sacred Ground',
            'Blood Pact',
            'A Round of Ale',
            'Keep',
            'Wolves'
        ])
    })

    it('puts an edifice first in its row, named by its face-up side, as the board draws it', () => {
        const [stones] = mapSlotsFor(Region.Cradle)
        const [plains] = mapSlotsFor(Region.Provinces)
        const state = testState([testPlayer({ playerId: 'Dana', color: Color.Red })], {
            siteCards: { [stones]: 'site.standing-stones', [plains]: 'site.plains' },
            denizensBySite: { [stones]: [BLOOD_PACT], [plains]: [ROUND_OF_ALE, HALL_OF_DEBATE] }
        })
        const group = mapPreviewGroup(state)
        expect(ids(group)).toEqual([BLOOD_PACT, HALL_OF_DEBATE, ROUND_OF_ALE])
        expect(group[1].label).toBe('Hall of Debate')
    })
})

describe("a seat's group: its advisers, then its relics", () => {
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                advisers: [
                    { cardId: ENVOY, faceUp: true },
                    { cardId: RELIC_THIEF, faceUp: false }
                ]
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                advisers: [
                    { cardId: GARRISON, faceUp: true },
                    { cardId: TUTOR, faceUp: false },
                    { cardId: TYRANT, faceUp: true }
                ],
                relicIds: [SCEPTER]
            })
        ],
        { chancellorPlayerId: 'Rhys' }
    )

    it("passes over another seat's facedown adviser", () => {
        expect(ids(seatPreviewGroup(state.getPlayerState('Rhys'), 'Dana'))).toEqual([
            GARRISON,
            TYRANT,
            SCEPTER
        ])
    })

    it('keeps your own facedown adviser, named as the seat names it', () => {
        const group = seatPreviewGroup(state.getPlayerState('Dana'), 'Dana')
        expect(ids(group)).toEqual([ENVOY, RELIC_THIEF])
        expect(group[1].label).toBe('Relic Thief — facedown; only you see it')
    })

    it('names no facedown adviser to a viewer who is no seat', () => {
        expect(ids(seatPreviewGroup(state.getPlayerState('Dana'), undefined))).toEqual([ENVOY])
    })
})

describe('the drawn group', () => {
    it('keeps the draw order, a Vision included', () => {
        expect(drawnPreviewGroup([LONGBOWS, TAVERN_SONGS, CONQUEST])).toEqual([
            { cardId: LONGBOWS, label: 'Longbows' },
            { cardId: TAVERN_SONGS, label: 'Tavern Songs' },
            { cardId: CONQUEST, label: 'Vision of Conquest' }
        ])
    })
})

describe('rule 4 — paging the enlarged card through its group', () => {
    afterEach(() => cardPreview.dismiss())

    let cards: PreviewGroupCard[] = []
    const group = () => cards
    const named = (cardId: string, label: string) => ({ cardId, label })

    function openOn(index: number) {
        const card = cards[index]
        cardPreview.toggle({}, () => ({ cardId: card.cardId, label: card.label }), group)
    }

    it('names the cards either side and pages to them', () => {
        cards = [named(SACRED_GROUND, 'Sacred Ground'), named(BLOOD_PACT, 'Blood Pact')]
        cards.push(named(ROUND_OF_ALE, 'A Round of Ale'))
        openOn(1)
        expect(cardPreview.sides?.previous?.cardId).toBe(SACRED_GROUND)
        expect(cardPreview.sides?.next?.cardId).toBe(ROUND_OF_ALE)
        expect(cardPreview.page(1)).toBe(true)
        expect(cardPreview.current).toEqual({ cardId: ROUND_OF_ALE, label: 'A Round of Ale' })
        expect(cardPreview.sides?.previous?.cardId).toBe(BLOOD_PACT)
        expect(cardPreview.sides?.next).toBeUndefined()
    })

    it('stops at the ends', () => {
        cards = [named(SACRED_GROUND, 'Sacred Ground'), named(BLOOD_PACT, 'Blood Pact')]
        openOn(1)
        expect(cardPreview.page(1)).toBe(false)
        expect(cardPreview.current?.cardId).toBe(BLOOD_PACT)
        expect(cardPreview.page(-1)).toBe(true)
        expect(cardPreview.page(-1)).toBe(false)
        expect(cardPreview.current?.cardId).toBe(SACRED_GROUND)
    })

    it('closes when the card it paged to leaves the group', () => {
        cards = [named(SACRED_GROUND, 'Sacred Ground'), named(BLOOD_PACT, 'Blood Pact')]
        openOn(0)
        cardPreview.page(1)
        expect(cardPreview.open).toBe(true)
        cards = [named(SACRED_GROUND, 'Sacred Ground')]
        expect(cardPreview.current).toBeNull()
        expect(cardPreview.open).toBe(false)
    })

    it('does not close a card it paged to when the card first opened leaves play', () => {
        cards = [named(SACRED_GROUND, 'Sacred Ground'), named(BLOOD_PACT, 'Blood Pact')]
        const opener = {}
        cardPreview.toggle(opener, () => named(SACRED_GROUND, 'Sacred Ground'), group)
        cardPreview.page(1)
        cardPreview.release(opener)
        expect(cardPreview.current?.cardId).toBe(BLOOD_PACT)
    })

    it('has no sides for a card with no group, or alone in its group', () => {
        cardPreview.toggle({}, () => named(WOLVES, 'Wolves'))
        expect(cardPreview.sides).toBeUndefined()
        expect(cardPreview.page(1)).toBe(false)
        cards = [named(WOLVES, 'Wolves')]
        openOn(0)
        expect(cardPreview.sides).toBeUndefined()
    })
})
