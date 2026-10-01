import { describe, expect, it } from 'vitest'
import { Color, assert, getPrng, type Visibility } from '@tabletop/common'
import { OathGameStateValidator } from '../model/gameState.js'
import { CardKind, Region } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { MachineState } from '../definition/states.js'
import { createOathVault } from '../model/vault.js'
import { OathVisibility } from '../definition/runtime.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { spectator } from '../testing/projection.js'
import { required } from '../testing/required.js'
import { PowerTiming, powersWithTiming } from '../data/cardPowers.js'
import { INN, FILLER } from '../testing/cards.js'
import {
    discardWitnesses,
    forgetHand,
    rememberRelicAt,
    putUnderWorldDeckKnown,
    tableWitnesses,
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
        drawWorldDeck(s, 1, 'p2')
        expect(s.getPlayerState('p1').knownWorldDeckTop).toEqual([VISION, WOLVES])
        expect(drawWorldDeckVision(s, 'p2')).toBe(VISION)
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
        putOnDiscardPile(s, Region.Cradle, [ELDERS], false, { witnessOf: () => ['p2'] })
        expect(s.getPlayerState('p1').knownDiscardPiles?.cradle).toEqual([null, TENTS, INN])
        expect(s.getPlayerState('p2').knownDiscardPiles?.cradle).toEqual([null, null, null, ELDERS])
        expect(drawDiscardPile(s, Region.Cradle, 2, false, 'p2')).toEqual([ELDERS, INN])
        expect(s.getPlayerState('p1').knownDiscardPiles?.cradle).toEqual([null, TENTS])
        expect(s.getPlayerState('p2').knownDiscardPiles?.cradle).toEqual([])
        putOnDiscardPile(s, Region.Cradle, [ELDERS], true, { witnessOf: () => ['p2'] })
        expect(s.getPlayerState('p1').knownDiscardPiles?.cradle).toEqual([null, null, TENTS])
        expect(s.getPlayerState('p2').knownDiscardPiles?.cradle).toEqual([ELDERS])
        expect(drawDiscardPile(s, Region.Cradle, 2, true, 'p2')).toEqual([ELDERS, WOLVES])
        expect(s.getPlayerState('p1').knownDiscardPiles?.cradle).toEqual([TENTS])
        expect(s.requireVault().discardPiles.cradle).toEqual([TENTS])
    })

    it('a card shown to the table is remembered by the table, and a hidden one by the player who put it there', () => {
        const s = table()
        putOnDiscardPile(s, Region.Provinces, [WOLVES, ELDERS], false, { witnessOf: (cardId: string) => (cardId === WOLVES ? ['everyone'] : ['p1']) })
        expect(s.requireVault().discardPiles.provinces).toEqual([ELDERS, WOLVES, RANGERS])
        // R-9.4 — the table saw the hidden card's back go down.
        expect(s.seenDiscardPiles.provinces).toEqual([null, WOLVES, { back: CardKind.Denizen }])
        expect(s.getPlayerState('p1').knownDiscardPiles?.provinces).toEqual([null, null, ELDERS])
        expect(s.getPlayerState('p2').knownDiscardPiles?.provinces).toEqual([])
        const state = s.dehydrate()
        assert(OathGameStateValidator.Check(state), 'the fixture is canonical')
        expect(OathVisibility.state.project(state, spectator).seenDiscardPiles.provinces).toEqual([null, WOLVES, { back: CardKind.Denizen }])
        expect(JSON.stringify(OathVisibility.state.project(state, spectator))).not.toContain(ELDERS)
    })

    it('before an action, a card on the table is everyone’s to have seen, and a hand or facedown adviser its holder’s', () => {
        const s = table()
        s.denizensBySite = { c1: [WOLVES] }
        s.getPlayerState('p2').handIds = [RANGERS]
        s.getPlayerState('p2').handCount = 1
        const witnesses = discardWitnesses(s).byCard
        expect(witnesses.get(WOLVES)).toEqual(['everyone'])
        expect(witnesses.get(RANGERS)).toEqual(['p2'])
        expect(witnesses.get(FACEDOWN)).toEqual(['p1'])
        expect(witnesses.get(INN)).toBeUndefined()
    })

    it('Truthful Harp — the table knows which cards went down but not their order; their player knows both', () => {
        const s = table()
        putOnDiscardPile(s, Region.Hinterland, [WOLVES, ELDERS], false, { witnessOf: () => ['p1'], setWitnessesOf: (cardId: string) => ([WOLVES, ELDERS].includes(cardId) ? ['everyone'] : []) })
        expect(s.getPlayerState('p1').knownDiscardPiles?.hinterland).toEqual([WOLVES, ELDERS])
        const set = { among: [WOLVES, ELDERS].toSorted(), back: CardKind.Denizen }
        expect(s.seenDiscardPiles.hinterland).toEqual([set, set])
        expect(s.getPlayerState('p2').knownDiscardPiles?.hinterland).toEqual([])
        const other = table()
        putOnDiscardPile(other, Region.Hinterland, [ELDERS, WOLVES], false, { witnessOf: () => ['p1'], setWitnessesOf: (cardId: string) => ([WOLVES, ELDERS].includes(cardId) ? ['everyone'] : []) })
        expect(other.seenDiscardPiles).toEqual(s.seenDiscardPiles)
    })

    it('a card no one can be named for is remembered by no one, though the table saw its back', () => {
        const s = table()
        putOnDiscardPile(s, Region.Hinterland, [WOLVES], false, { witnessOf: () => [] })
        expect(s.seenDiscardPiles.hinterland).toEqual([{ back: CardKind.Denizen }])
        expect(s.players.map((player) => player.knownDiscardPiles?.hinterland)).toEqual([[], []])
    })

    it('the table snapshot reads public state only: no hand, no facedown adviser', () => {
        const s = table()
        s.denizensBySite = { c1: [WOLVES] }
        expect([...tableWitnesses(s).byCard]).toEqual([[WOLVES, ['everyone']]])
        expect(tableWitnesses(s).holders).toBe(false)
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

describe('the world deck’s bottom, as each player saw it (Cracked Horn)', () => {
    it('lifts what was under it, keeps it through draws above, and drops it once a draw reaches it', () => {
        const s = table()
        const SCOUTS = 'denizen.order.scouts'
        putUnderWorldDeckKnown(s, [TENTS], { witnessOf: () => ['p1'] })
        putUnderWorldDeckKnown(s, [ELDERS, SCOUTS], { witnessOf: () => ['p2'] })
        expect(s.requireVault().worldDeck).toEqual([INN, VISION, WOLVES, RANGERS, TENTS, ELDERS, SCOUTS])
        expect(s.getPlayerState('p1').knownWorldDeckBottom).toEqual([null, null, TENTS])
        expect(s.getPlayerState('p2').knownWorldDeckBottom).toEqual([SCOUTS, ELDERS])
        // R-5.1.2 — the draw stops on the Vision, well above the cards under the deck.
        expect(drawWorldDeck(s, 4, 'p2').drawn).toEqual([INN, VISION])
        expect(s.getPlayerState('p1').knownWorldDeckBottom).toEqual([null, null, TENTS])
        expect(drawWorldDeck(s, 3, 'p2').drawn).toEqual([WOLVES, RANGERS, TENTS])
        expect(s.requireVault().worldDeck).toEqual([ELDERS, SCOUTS])
        expect(s.getPlayerState('p1').knownWorldDeckBottom).toEqual([])
        expect(s.getPlayerState('p2').knownWorldDeckBottom).toEqual([SCOUTS, ELDERS])
    })
})

describe('a known relic drawn back out of the relic deck', () => {
    it('onto a site slot: its knowers know it there, and the table too when it went down in public, with no peek granted', () => {
        const s = table()
        s.requireVault().relicDeck = [CUP]
        sendRelicToBottom(s, CUP, ['p1'])
        const drawn = drawRelicDeck(s, 1)
        rememberRelicAt(s, 'c2.relic.0', CUP, drawn.seenBy[0])
        expect(s.getPlayerState('p1').peekedRelics).toEqual({ 'c2.relic.0': CUP })
        expect(s.getPlayerState('p1').peekedRelicSlotIds).toEqual([])
        expect(s.getPlayerState('p2').peekedRelics).toEqual({})
        rememberRelicAt(s, 'c2.relic.1', DRUM, ['everyone'])
        expect(s.seenRelics).toEqual({ 'c2.relic.1': DRUM })
    })

    it('into a relic question: whoever knew it sees the question\'s relic', () => {
        const s = table()
        s.pendingQuestions = {
            queue: [{ kind: PowerQuestionKind.KeepOrBottomRelic, cardId: 'relic.dowsing-sticks', askedPlayerId: 'p1', seenBy: ['p2'], relicCardId: CUP }],
            askingPlayerId: 'p1',
            resumeMachineState: MachineState.ActPhase
        }
        const state = s.dehydrate()
        assert(OathGameStateValidator.Check(state), 'the fixture is canonical')
        const relicOf = (perspective: Visibility.Perspective) => {
            const question = OathVisibility.state.project(state, perspective).pendingQuestions?.queue[0]
            return question && 'relicCardId' in question ? question.relicCardId : undefined
        }
        expect(relicOf({ kind: 'player', playerId: 'p2' })).toBe(CUP)
        expect(relicOf(spectator)).toBeUndefined()
    })
})

describe('Oracle and what lies under the world deck', () => {
    it('moves no record but its drawer\'s while a Vision may lie above what the table saw go under', () => {
        const s = table()
        s.requireVault().worldDeck = [INN, 'vision.people', WOLVES]
        s.worldDeckVisions = 1
        putUnderWorldDeckKnown(s, [VISION, TENTS], { witnessOf: () => ['p1'], setWitnessesOf: (cardId: string) => ([VISION, TENTS].includes(cardId) ? ['everyone'] : []) })
        const table_ = structuredClone(s.seenWorldDeckBottom)
        expect(drawWorldDeckVision(s, 'p1')).toBe('vision.people')
        expect(s.seenWorldDeckBottom).toEqual(table_)
        expect(s.getPlayerState('p1').knownWorldDeckBottom).toEqual([TENTS, VISION])
    })

    it('when every Vision left lies under the deck, everyone knows which one it took', () => {
        const s = table()
        s.requireVault().worldDeck = [INN, WOLVES]
        putUnderWorldDeckKnown(s, [VISION, TENTS], { witnessOf: () => ['p1'], setWitnessesOf: (cardId: string) => ([VISION, TENTS].includes(cardId) ? ['everyone'] : []) })
        expect(s.worldDeckVisions).toBe(1)
        expect(drawWorldDeckVision(s, 'p1')).toBe(VISION)
        expect(s.requireVault().worldDeck).toEqual([INN, WOLVES, TENTS])
        expect(s.seenWorldDeckBottom).toEqual([{ among: [TENTS, VISION].toSorted(), back: CardKind.Denizen }])
        expect(s.getPlayerState('p1').knownWorldDeckBottom).toEqual([TENTS])
        expect(s.worldDeckVisions).toBe(0)
    })

    it('its drawer, who saw where the Vision lay, closes the gap it left under the cards above', () => {
        const s = table()
        s.requireVault().worldDeck = [INN, WOLVES]
        putUnderWorldDeckKnown(s, [ELDERS], { witnessOf: () => ['p1'] })
        putUnderWorldDeckKnown(s, [VISION, TENTS], { witnessOf: () => ['p1'] })
        expect(s.getPlayerState('p1').knownWorldDeckBottom).toEqual([TENTS, VISION, ELDERS])
        expect(drawWorldDeckVision(s, 'p1')).toBe(VISION)
        expect(s.requireVault().worldDeck).toEqual([INN, WOLVES, ELDERS, TENTS])
        expect(s.getPlayerState('p1').knownWorldDeckBottom).toEqual([TENTS, ELDERS])
    })
})

describe('R-9.4 — the backs of held cards are public', () => {
    it('a hand counts its Visions, and a facedown Vision adviser shows as one', () => {
        const s = table()
        const p2 = s.getPlayerState('p2')
        p2.setHand([VISION, WOLVES])
        expect(p2.handVisions).toBe(1)
        p2.setAdvisers([{ cardId: VISION, faceUp: false }, { cardId: TENTS, faceUp: false }])
        expect(p2.advisers).toEqual([{ faceUp: false, vision: true }, { faceUp: false }])
        const state = s.dehydrate()
        assert(OathGameStateValidator.Check(state), 'the fixture is canonical')
        const seen = OathVisibility.state.project(state, spectator).players[1]
        expect(seen.handVisions).toBe(1)
        expect(seen.advisers).toEqual([{ faceUp: false, vision: true }, { faceUp: false }])
        expect(JSON.stringify(seen)).not.toContain(VISION)
    })
})

describe('HIDDEN-010 — a card someone knew in a stack, drawn into a hand', () => {
    it('stays known in that hand: to the table when the table knew it, to a player when they did', () => {
        const s = table()
        putOnDiscardPile(s, Region.Hinterland, [WOLVES, ELDERS], false, { witnessOf: (cardId: string) => (cardId === WOLVES ? ['everyone'] : ['p1']) })
        expect(drawDiscardPile(s, Region.Hinterland, 2, false, 'p2')).toEqual([ELDERS, WOLVES])
        expect(s.getPlayerState('p2').handSeen).toEqual([WOLVES])
        expect(s.getPlayerState('p1').knownHands).toEqual({ p2: [ELDERS] })
        forgetHand(s, 'p2')
        expect(s.getPlayerState('p2').handSeen).toEqual([])
        expect(s.getPlayerState('p1').knownHands).toEqual({})
    })

    it('X-08 — whoever was shown a facedown adviser knows it among the cards when it is discarded', () => {
        const s = table()
        s.getPlayerState('p1').markShown(FACEDOWN, 'p2')
        const witnesses = discardWitnesses(s)
        expect(witnesses.byCard.get(FACEDOWN)).toEqual(['p1'])
        expect(witnesses.setsByCard.get(FACEDOWN)).toEqual(['p2'])
        putOnDiscardPile(s, Region.Hinterland, [FACEDOWN, WOLVES], false, {
            witnessOf: () => ['p1'],
            setWitnessesOf: (cardId: string) => witnesses.setsByCard.get(cardId) ?? []
        })
        expect(s.getPlayerState('p2').knownDiscardPiles?.hinterland).toEqual([{ among: [FACEDOWN] }, { among: [FACEDOWN] }])
        expect(s.getPlayerState('p1').knownDiscardPiles?.hinterland).toEqual([FACEDOWN, WOLVES])
    })
})

describe('HIDDEN-011 — a set a witness knew only part of', () => {
    const handKnown = (order: string[]) => {
        const s = table()
        putOnDiscardPile(s, Region.Hinterland, order, false, {
            witnessOf: () => ['p1'],
            setWitnessesOf: (cardId: string) => (cardId === WOLVES ? ['everyone', 'p2'] : [])
        })
        return s
    }

    it('lies at every place of the deposit with its back, so the order stays the depositor’s', () => {
        const [first, second] = [handKnown([WOLVES, ELDERS, VISION]), handKnown([ELDERS, WOLVES, VISION])]
        expect(first.seenDiscardPiles.hinterland).toEqual([
            { among: [WOLVES], back: CardKind.Denizen },
            { among: [WOLVES], back: CardKind.Denizen },
            { back: CardKind.Vision }
        ])
        expect(second.seenDiscardPiles).toEqual(first.seenDiscardPiles)
        expect(second.getPlayerState('p2').knownDiscardPiles).toEqual(first.getPlayerState('p2').knownDiscardPiles)
        expect(first.getPlayerState('p2').knownDiscardPiles?.hinterland).toEqual([{ among: [WOLVES] }, { among: [WOLVES] }])
    })
})

describe('HIDDEN-015 — a relic the table knew, sent to the bottom again', () => {
    it('stays known to the table, from a known bottom or a known slot', () => {
        const s = table()
        sendRelicToBottom(s, CUP, 'everyone')
        expect(drawRelicDeck(s, 3).seenBy).toEqual([[], [], ['everyone']])
        sendRelicToBottom(s, CUP, ['p1', 'everyone'])
        expect(s.seenRelicDeckBottom).toEqual([CUP])
        expect(s.getPlayerState('p2').knownRelicDeckBottom).toEqual([CUP])
        s.seenRelics = { 'site.1.relic': MAP }
        s.getPlayerState('p2').peekedRelics = { 'site.1.relic': MAP }
        sendRelicToBottom(s, MAP, ['p1'])
        expect(s.seenRelicDeckBottom).toEqual([CUP, MAP])
        expect(s.seenRelics).toEqual({})
        expect(s.getPlayerState('p2').peekedRelics).toEqual({})
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
        expect(s.seenRelicDeckBottom).toEqual(['relic.ring-of-devotion'])
        expect(drawRelicDeck(s, 3)).toEqual({ relicCardIds: [DRUM, MAP, CUP], seenBy: [[], [], ['p1']] })
        expect(s.players.map((player) => player.knownRelicDeckBottom)).toEqual([
            ['relic.ring-of-devotion'],
            ['relic.ring-of-devotion']
        ])
        expect(drawRelicDeck(s, 1)).toEqual({ relicCardIds: ['relic.ring-of-devotion'], seenBy: [['everyone']] })
        expect(s.seenRelicDeckBottom).toEqual([])
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
        const own = OathVisibility.state.project(state, { kind: 'player', playerId: 'p1' }).players[0]
        expect(own).toMatchObject({
            peekedSites: { h1: 'site.mountain' },
            knownWorldDeckTop: [INN],
            knownDiscardPiles: { provinces: [RANGERS] },
            knownRelicDeckBottom: [CUP]
        })
        for (const perspective of [{ kind: 'player', playerId: 'p2' } as const, spectator]) {
            const seen = OathVisibility.state.project(state, perspective).players[0]
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
