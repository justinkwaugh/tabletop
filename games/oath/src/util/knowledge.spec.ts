import { describe, expect, it } from 'vitest'
import { Color, assert, getPrng } from '@tabletop/common'
import { OathGameStateValidator } from '../model/gameState.js'
import { Region } from '../model/oathEnums.js'
import { createOathVault } from '../model/vault.js'
import { OathRuntime } from '../definition/runtime.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { spectator } from '../testing/projection.js'
import { required } from '../testing/required.js'
import { PowerTiming, powersWithTiming } from '../data/cardPowers.js'
import { INN, FILLER } from '../testing/cards.js'
import {
    drawDiscardPile,
    drawRelicDeck,
    drawWorldDeck,
    drawWorldDeckVision,
    mergeDiscardPileOnto,
    putOnDiscardPile,
    seeDiscardPile,
    seeWorldDeckTop,
    sendRelicToBottom
} from './knowledge.js'
import { discardFromPlayInChosenOrder } from './orderedDiscard.js'
import { PowerChoiceKind, defaultDomain } from './powerChoice.js'

const TENTS = 'denizen.nomad.tents'
const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const ELDERS = 'denizen.nomad.elders'
const VISION = 'vision.supremacy'
const CUP = 'relic.cup-of-plenty'
const DRUM = 'relic.dragonskin-drum'
const MAP = 'relic.map'
const FACEDOWN = 'denizen.arcane.inquisitor'

function table() {
    const s = testState([
        testPlayer({ playerId: 'p1', color: Color.Red, siteId: 'c1', advisers: [{ cardId: FACEDOWN, faceUp: false }] }),
        testPlayer({ playerId: 'p2', color: Color.Blue, siteId: 'c2' })
    ])
    const vault = createOathVault(
        {
            discardPiles: { cradle: [INN, TENTS, WOLVES], provinces: [RANGERS], hinterland: [] },
            composeWorldDeck: () => []
        },
        getPrng(1)
    )
    vault.worldDeck = [INN, VISION, WOLVES, RANGERS]
    vault.relicDeck = [DRUM, MAP]
    s.vault = vault
    return s
}

describe('the world deck’s top, as a player saw it', () => {
    it('drops what a draw takes and the Vision Oracle takes, and keeps the rest in order', () => {
        const s = table()
        seeWorldDeckTop(s, 'p1', [INN, VISION, WOLVES])
        drawWorldDeck(s, 1)
        expect(s.getPlayerState('p1').knownWorldDeckTop).toEqual([VISION, WOLVES])
        expect(drawWorldDeckVision(s)).toBe(VISION)
        expect(s.getPlayerState('p1').knownWorldDeckTop).toEqual([WOLVES])
        expect(s.requireVault().worldDeck).toEqual([WOLVES, RANGERS])
        expect(s.getPlayerState('p2').knownWorldDeckTop).toEqual([])
    })
})

describe('a discard pile, as a player saw it, by position from the bottom', () => {
    it('keeps its positions when cards go on top, and follows top draws, bottom draws and cards put underneath', () => {
        const s = table()
        seeDiscardPile(s, 'p1', Region.Cradle, [INN, TENTS])
        expect(s.getPlayerState('p1').knownDiscardPiles?.cradle).toEqual([null, TENTS, INN])
        putOnDiscardPile(s, Region.Cradle, [ELDERS], false)
        expect(s.getPlayerState('p1').knownDiscardPiles?.cradle).toEqual([null, TENTS, INN])
        expect(drawDiscardPile(s, Region.Cradle, 2, false)).toEqual([ELDERS, INN])
        expect(s.getPlayerState('p1').knownDiscardPiles?.cradle).toEqual([null, TENTS])
        putOnDiscardPile(s, Region.Cradle, [ELDERS], true)
        expect(s.getPlayerState('p1').knownDiscardPiles?.cradle).toEqual([null, null, TENTS])
        expect(drawDiscardPile(s, Region.Cradle, 2, true)).toEqual([ELDERS, WOLVES])
        expect(s.getPlayerState('p1').knownDiscardPiles?.cradle).toEqual([TENTS])
        expect(s.requireVault().discardPiles.cradle).toEqual([TENTS])
    })

    it('Convoys — a pile moved onto another keeps what was seen, above the cards it now covers', () => {
        const s = table()
        seeDiscardPile(s, 'p1', Region.Cradle, [INN, TENTS, WOLVES])
        mergeDiscardPileOnto(s, Region.Cradle, Region.Provinces)
        expect(s.requireVault().discardPiles.provinces).toEqual([INN, TENTS, WOLVES, RANGERS])
        expect(s.getPlayerState('p1').knownDiscardPiles).toEqual({
            cradle: [],
            provinces: [null, WOLVES, TENTS, INN],
            hinterland: []
        })
    })
})

describe('the relic deck’s bottom, as each player saw it', () => {
    it('names a relic to those who know it, and a draw that reaches it takes it off', () => {
        const s = table()
        sendRelicToBottom(s, CUP, ['p1'])
        expect(s.players.map((player) => player.knownRelicDeckBottom)).toEqual([[CUP], []])
        sendRelicToBottom(s, 'relic.ring-of-devotion', 'everyone')
        expect(s.players.map((player) => player.knownRelicDeckBottom)).toEqual([
            [CUP, 'relic.ring-of-devotion'],
            ['relic.ring-of-devotion']
        ])
        expect(drawRelicDeck(s, 3)).toEqual([DRUM, MAP, CUP])
        expect(s.players.map((player) => player.knownRelicDeckBottom)).toEqual([
            ['relic.ring-of-devotion'],
            ['relic.ring-of-devotion']
        ])
    })

    it('R-6.3 — a player who had peeked at a relic knows it when it goes down unseen', () => {
        const s = table()
        s.getPlayerState('p2').recordPeek('c1.relic.0', CUP)
        sendRelicToBottom(s, CUP, [])
        expect(s.players.map((player) => player.knownRelicDeckBottom)).toEqual([[], [CUP]])
    })
})

describe('retained knowledge in projections', () => {
    it('reaches its owner alone: not another player, not a spectator', () => {
        const s = table()
        seeWorldDeckTop(s, 'p1', [INN])
        seeDiscardPile(s, 'p1', Region.Provinces, [RANGERS])
        sendRelicToBottom(s, CUP, ['p1'])
        s.getPlayerState('p1').recordSitePeek('h1', 'site.mountain')
        const state = s.dehydrate()
        assert(OathGameStateValidator.Check(state), 'the fixture is canonical')
        const fields = ['peekedSites', 'knownWorldDeckTop', 'knownDiscardPiles', 'knownRelicDeckBottom']
        const own = OathRuntime.visibility.state.project(state, { kind: 'player', playerId: 'p1' }).players[0]
        expect(own).toMatchObject({
            peekedSites: { h1: 'site.mountain' },
            knownWorldDeckTop: [INN],
            knownDiscardPiles: { provinces: [RANGERS] },
            knownRelicDeckBottom: [CUP]
        })
        for (const perspective of [{ kind: 'player', playerId: 'p2' } as const, spectator]) {
            const seen = OathRuntime.visibility.state.project(state, perspective).players[0]
            for (const field of fields) expect(seen).not.toHaveProperty(field)
            expect(JSON.stringify(seen)).not.toContain('site.mountain')
        }
    })
})

describe('R-9.4 — no facedown adviser is named by a public choice or discard order', () => {
    it('a discard in chosen order refuses a facedown adviser', () => {
        const s = table()
        expect(() => discardFromPlayInChosenOrder(s, 'p1', [FACEDOWN, FILLER])).toThrow(/facedown adviser/)
    })

    it('the default Card choice leaves out the actor’s facedown advisers', () => {
        const s = table()
        const power = required(powersWithTiming(FACEDOWN, PowerTiming.Action)[0], 'the Inquisitor’s Action')
        const offered = defaultDomain(PowerChoiceKind.Card)(s, 'p1', power)
        expect(offered).not.toContainEqual({ kind: PowerChoiceKind.Card, cardId: FACEDOWN })
    })
})
