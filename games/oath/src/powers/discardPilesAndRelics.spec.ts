import { describe, expect, it } from 'vitest'
import { buildAction, machineContext } from '../testing/actions.js'
import { Color, getPrng } from '@tabletop/common'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { HydratedSearch, Search, SearchSource } from '../actions/search.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { MachineState } from '../definition/states.js'
import { ActPhaseStateHandler } from '../stateHandlers/actPhase.js'
import { Banner, CardKind, PlayerStatus, Region } from '../model/oathEnums.js'
import { reliquarySlotId } from '../util/setup.js'
import { createOathVault, type OathVault } from '../model/vault.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { type PowerChoice } from '../util/powerChoice.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { type ModifierUse } from '../util/modifiers.js'
import '../powers/index.js'
import { PowerQuestionKind } from '../model/question.js'
import { answerQuestion } from '../testing/steps.js'
import { region, slot, modifierUse, yes } from '../testing/choices.js'
import { INN, FILLER } from '../testing/cards.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { served, servedJson, spectator } from '../testing/projection.js'
import { OathVisibility } from '../definition/runtime.js'

const FAE = 'denizen.beast.fae-merchant'
const BREAKER = 'denizen.hearth.relic-breaker'
const MUSHROOMS = 'denizen.beast.mushrooms'
const SONGS = 'denizen.hearth.tavern-songs'
const SCRYER = 'denizen.discord.scryer'
const BRACKEN = 'denizen.beast.bracken'
const CONVOYS = 'denizen.nomad.convoys'
const ORACLE = 'denizen.nomad.oracle'
const AMBITIONS = 'denizen.discord.royal-ambitions'
const PACT = 'denizen.nomad.ancient-pact'
const TENTS = 'denizen.nomad.tents'
const WOLVES = 'denizen.beast.wolves'
const PILE_C1 = 'denizen.hearth.ballot-box'
const PILE_C2 = 'denizen.beast.rangers'
const PILE_C3 = 'denizen.order.wrestlers'
const PILE_P1 = 'denizen.nomad.elders'
const PILE_P2 = 'denizen.discord.naysayers'
const CUP = 'relic.cup-of-plenty'
const DRUM = 'relic.dragonskin-drum'
const MAP = 'relic.map'
const RING = 'relic.ring-of-devotion'


function board(cards: Record<string, string[]> = {}, advisers: Record<string, string[]> = {}, over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    const adv = (id: string) => (advisers[id] ?? []).map((cardId) => ({ cardId, faceUp: true }))
    const s = testState(
        [
            testPlayer({ playerId: 'ruler', color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', favor: 4, secrets: 4, supply: 5, warbandsOnBoard: { ruler: 4 }, warbandsInPersonalBank: { ruler: 6 }, advisers: adv('ruler'), ...over['ruler'] }),
            testPlayer({ playerId: 'chancellor', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', favor: 2, secrets: 2, supply: 5, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 }, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 12 }, advisers: adv('chancellor'), ...over['chancellor'] })
        ],
        {
            chancellorPlayerId: 'chancellor',
            denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...cards },
            warbandsBySite: { c1: { ruler: 1 }, c2: { ruler: 2 }, p1: {}, h1: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            discardPileCounts: { cradle: 3, provinces: 2, hinterland: 0 },
            discardTopBackType: { cradle: CardKind.Denizen, provinces: CardKind.Denizen },
            ...state
        }
    )
    openTurn(s, 'ruler')
    return s
}
function vaultFor(over: Parameters<typeof createOathVault>[0] = {}): OathVault {
    const vault = createOathVault({
        discardPiles: { cradle: [PILE_C1, PILE_C2, PILE_C3], provinces: [PILE_P1, PILE_P2], hinterland: [] },
        composeWorldDeck: () => [INN, 'vision.supremacy', TENTS, 'vision.people'],
        ...over
    }, getPrng(1))
    // Assigned after the shuffle, so the relic draws are known.
    vault.relicDeck = [DRUM, MAP, RING]
    return vault
}
function serverUse(s: ReturnType<typeof board>, vault: OathVault, cardId: string, choices?: PowerChoice[]) {
    const action = buildAction(UseActionPower, { playerId: 'ruler', cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Action), choices })
    s.vault = vault
    const hydrated = new HydratedUseActionPower(action)
    hydrated.apply(s)
    return hydrated
}
function serverSearch(s: ReturnType<typeof board>, vault: OathVault, modifiers?: ModifierUse[]) {
    const action = buildAction(Search, { playerId: 'ruler', drawFrom: SearchSource.Discard, revealsInfo: true, modifiers })
    s.vault = vault
    const hydrated = new HydratedSearch(action)
    hydrated.apply(s)
    return hydrated
}
function serverResolve(s: ReturnType<typeof board>, vault: OathVault, fields: Partial<SearchResolve>) {
    const action = buildAction(SearchResolve, { playerId: 'ruler', ...fields })
    s.vault = vault
    const hydrated = new HydratedSearchResolve(action)
    hydrated.apply(s)
    return hydrated
}

describe('relics', () => {
    it('Fae Merchant — draws the top relic, then sends one you hold (or the new one) to the bottom, seeing it', () => {
        const s = board({ c1: [FAE] }, {}, { ruler: { relicIds: [CUP, 'relic.grand-scepter'] } })
        const vault = vaultFor()
        const a = serverUse(s, vault, FAE)
        expect(a.revealsInfo).toBe(true)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.BottomRelic, askedPlayerId: 'ruler', relicCardId: DRUM })
        expect(s.getPlayerState('ruler').relicIds).toEqual([CUP, 'relic.grand-scepter'])
        // The Grand Scepter is never put down.
        expect(() => answerQuestion(s, 'ruler', { kind: PowerQuestionKind.BottomRelic, heldRelicCardId: 'relic.grand-scepter' })).toThrow(/Grand Scepter/)
        const kept = answerQuestion(s, 'ruler', { kind: PowerQuestionKind.BottomRelic, heldRelicCardId: CUP })
        expect(s.getPlayerState('ruler').relicIds).toEqual(['relic.grand-scepter', DRUM])
        expect(vault.relicDeck).toEqual([MAP, RING, CUP])
        expect(kept.metadata?.relicToDeckBottom).toBe(CUP)
        // A held relic was public, so every player knows it lies at the bottom.
        expect(s.players.map((player) => player.knownRelicDeckBottom)).toEqual([[CUP], [CUP]])
        expect(kept.metadata?.summary).toContain(DRUM)

        const t = board({ c1: [FAE] }, {}, { ruler: { relicIds: [CUP] } })
        const v = vaultFor()
        serverUse(t, v, FAE)
        const unkept = answerQuestion(t, 'ruler', { kind: PowerQuestionKind.BottomRelic })
        expect(t.getPlayerState('ruler').relicIds).toEqual([CUP])
        expect(v.relicDeck).toEqual([MAP, RING, DRUM])
        expect(t.players.map((player) => player.knownRelicDeckBottom)).toEqual([[DRUM], []])
        // R-9.4 — a relic drawn and sent down unkept is named only in the Actor-protected fields.
        expect(unkept.metadata?.summary).not.toContain(DRUM)
    })

    it('Relic Breaker — a facedown relic at your site goes under the deck for three warbands', () => {
        const s = board({ c1: [BREAKER] }, {}, { chancellor: { peekedRelicSlotIds: ['slot-1'], peekedRelics: { 'slot-1': CUP } } }, { relicsBySite: { c1: [{ slotId: 'slot-1' }] } })
        const vault = vaultFor({ relicFacedown: { 'slot-1': CUP } })
        const a = serverUse(s, vault, BREAKER, [slot('slot-1')])
        expect(s.relicSlotsAt('c1')).toEqual([])
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(7)
        expect(vault.relicDeck).toEqual([DRUM, MAP, RING, CUP])
        expect(vault.relicFacedown['slot-1']).toBeUndefined()
        // R-9.4 — the card never lets its user look, so the record names the slot and not the relic.
        expect(a.metadata?.relicToDeckBottom).toBeUndefined()
        expect(a.metadata?.relicSlotToBottom).toBe('slot-1')
        expect(JSON.stringify(a.metadata)).not.toContain(CUP)
        // Only a player who had peeked at the slot knows what went down.
        expect(s.players.map((player) => player.knownRelicDeckBottom)).toEqual([[], [CUP]])
        expect(() => serverUse(board({ c1: [BREAKER] }), vaultFor(), BREAKER, [slot('slot-1')])).toThrow()
    })
})

describe('discard piles', () => {
    it('Mushrooms — free, one card, from the bottom of your pile', () => {
        const s = board({ c1: [MUSHROOMS] })
        const use = [modifierUse(MUSHROOMS)]
        expect(HydratedSearch.plan(s, 'ruler', SearchSource.Discard, use).cost).toBe(0)
        expect(HydratedSearch.drawCount(s, 'ruler', use, SearchSource.Discard)).toBe(1)
        expect(HydratedSearch.reasonCannotSearch(s, 'ruler', SearchSource.WorldDeck, use)).toMatch(/not searching a discard pile/)
        const vault = vaultFor()
        const a = serverSearch(s, vault, use)
        expect(a.metadata?.draw.drawnCardIds).toEqual([PILE_C3])
        expect(vault.discardPiles.cradle).toEqual([PILE_C1, PILE_C2])
        expect(s.getPlayerState('ruler').supply).toBe(5)
        expect(s.discardPileCounts.cradle).toBe(2)
    })

    it('Tavern Songs and Scryer — a peek, recorded for the peeker and nothing moved', () => {
        const s = board({ c1: [SONGS, SCRYER] })
        const vault = vaultFor()
        const a = serverUse(s, vault, SONGS)
        expect(a.metadata?.peeked).toEqual([PILE_C1, PILE_C2, PILE_C3])
        expect(a.metadata?.summary).not.toMatch(/d\.c1/)
        expect(a.revealsInfo).toBe(true)
        expect(vault.discardPiles.cradle).toEqual([PILE_C1, PILE_C2, PILE_C3])
        const b = serverUse(s, vault, SCRYER, [region(Region.Provinces)])
        expect(b.metadata?.peeked).toEqual([PILE_P1, PILE_P2])
        expect(s.getPlayerState('ruler').secrets).toBe(3)
        // Kept by position from the bottom of each pile.
        expect(s.getPlayerState('ruler').knownDiscardPiles).toEqual({ cradle: [PILE_C3, PILE_C2, PILE_C1], provinces: [PILE_P2, PILE_P1], hinterland: [] })
        expect(s.getPlayerState('chancellor').knownDiscardPiles).toEqual({ cradle: [], provinces: [], hinterland: [] })
    })

    it("Bracken — the Search's discards go to the pile you name, on top or underneath", () => {
        const s = board({ c1: [BRACKEN] })
        const vault = vaultFor()
        const use = [modifierUse(BRACKEN, [region(Region.Provinces), yes])]
        serverSearch(s, vault, use)
        expect(s.pendingSearchModifiers?.[0]?.choices).toEqual([region(Region.Provinces), yes])
        s.getPlayerState('ruler').handIds = [INN, 'vision.supremacy', WOLVES]
        const r = serverResolve(s, vault, { keptCardId: INN, discardOrder: [WOLVES, 'vision.supremacy'], play: SearchPlay.Adviser, faceUp: false })
        expect(r.metadata?.discardPileRegion).toBe(Region.Provinces)
        expect(r.metadata?.discardToBottom).toBe(true)
        expect(vault.discardPiles.provinces).toEqual([PILE_P1, PILE_P2, WOLVES, 'vision.supremacy'])
        expect(s.discardPileCounts.provinces).toBe(4)
        expect(s.discardTopBackType?.provinces).toBe(CardKind.Denizen)
        const t = board({ c1: [BRACKEN] })
        const v = vaultFor()
        serverSearch(t, v, [modifierUse(BRACKEN, [region(Region.Hinterland)])])
        t.getPlayerState('ruler').handIds = [INN, 'vision.supremacy', WOLVES]
        serverResolve(t, v, { keptCardId: INN, discardOrder: [WOLVES, 'vision.supremacy'], play: SearchPlay.Adviser, faceUp: false })
        expect(v.discardPiles.hinterland).toEqual(['vision.supremacy', WOLVES])
        expect(t.discardPileCounts.hinterland).toBe(2)
        expect(t.discardTopBackType?.hinterland).toBe(CardKind.Vision)
    })

    it("Convoys — another region's pile lands on top of yours", () => {
        const s = board({ c1: [CONVOYS] })
        const vault = vaultFor()
        const a = serverUse(s, vault, CONVOYS, [region(Region.Provinces)])
        expect(vault.discardPiles.cradle).toEqual([PILE_P1, PILE_P2, PILE_C1, PILE_C2, PILE_C3])
        expect(vault.discardPiles.provinces).toEqual([])
        expect(s.discardPileCounts).toEqual({ cradle: 5, provinces: 0, hinterland: 0 })
        expect(s.discardTopBackType?.provinces).toBeUndefined()
        expect(a.metadata?.mergePiles).toEqual({ from: Region.Provinces, to: Region.Cradle })
        expect(() => serverUse(board({ c1: [CONVOYS] }), vaultFor(), CONVOYS, [region(Region.Cradle)])).toThrow()
    })

    it('Oracle — the next Vision in the deck comes to hand, and the machine holds as for a Search', () => {
        const s = board({ c1: [ORACLE] })
        const vault = vaultFor()
        const a = serverUse(s, vault, ORACLE)
        expect(s.getPlayerState('ruler').handIds).toEqual(['vision.supremacy'])
        expect(vault.worldDeck).toEqual([INN, TENTS, 'vision.people'])
        expect(s.visionsDrawn).toBe(1)
        // R-9.4 — the public top back follows the deck the Vision left.
        expect(s.topCardBackType).toBe(CardKind.Denizen)
        expect(s.worldDeckExhausted).toBe(false)
        expect(a.metadata?.opensSearch).toBe(true)
        expect(new ActPhaseStateHandler().onAction(a, machineContext(s))).toBe(MachineState.Searching)
        expect(s.getPlayerState('ruler').secrets).toBe(2)
        // R-9.4 — the Vision drawn reaches its drawer alone, in state and in the record.
        expect(served(s, { kind: 'player', playerId: 'ruler' }).players[0].handIds).toEqual(['vision.supremacy'])
        for (const perspective of [{ kind: 'player', playerId: 'chancellor' } as const, spectator]) {
            expect(servedJson(s, perspective)).not.toContain('vision.supremacy')
            expect(JSON.stringify(OathVisibility.actions.project(a.dehydrate(), perspective))).not.toContain('vision.supremacy')
        }
        serverResolve(s, vault, { keptCardId: 'vision.supremacy', discardOrder: [], play: SearchPlay.RevealedVision })
        expect(s.getPlayerState('ruler').revealedVisionId).toBe('vision.supremacy')
    })
})

describe('Oracle keeps the public deck facts current (R-9.4)', () => {
    it('taking the only card leaves the deck exhausted with no top back', () => {
        const s = board({ c1: [ORACLE] }, {}, {}, { topCardBackType: CardKind.Vision, worldDeckExhausted: false })
        serverUse(s, vaultFor({ composeWorldDeck: () => ['vision.people'] }), ORACLE)
        expect(s.topCardBackType).toBeUndefined()
        expect(s.worldDeckExhausted).toBe(true)
    })
})

describe('Citizenship with a Reliquary relic', () => {
    function playAdviser(s: ReturnType<typeof board>, vault: OathVault, cardId: string, choices?: PowerChoice[]) {
        s.getPlayerState('ruler').handIds = [cardId, FILLER]
        return serverResolve(s, vault, { keptCardId: cardId, discardOrder: [FILLER], play: SearchPlay.Adviser, faceUp: true, choices })
    }

    it('Royal Ambitions — an Exile ruling more sites than the Chancellor takes a Reliquary relic and the seat', () => {
        // ruler rules c1 and c2; the Chancellor rules h1.
        const s = board()
        const vault = vaultFor({ relicFacedown: { [reliquarySlotId(0)]: CUP, [reliquarySlotId(1)]: DRUM, [reliquarySlotId(2)]: MAP, [reliquarySlotId(3)]: RING } })
        const a = playAdviser(s, vault, AMBITIONS, [yes, slot(reliquarySlotId(1))])
        expect(s.getPlayerState('ruler').status).toBe(PlayerStatus.Citizen)
        expect(s.getPlayerState('ruler').relicIds).toEqual([DRUM])
        expect(s.reliquarySlots().map((r) => r.slotId)).toEqual([reliquarySlotId(0), reliquarySlotId(2), reliquarySlotId(3)])
        expect(a.metadata?.endsActPhase).toBe(true)
        expect(vault.relicFacedown[reliquarySlotId(1)]).toBeUndefined()
        const weak = board({}, {}, {}, { warbandsBySite: { c1: { ruler: 1 }, c2: {}, p1: {}, h1: { [IMPERIAL_WARBANDS]: 2 } } })
        expect(() => playAdviser(weak, vaultFor(), AMBITIONS, [yes, slot(reliquarySlotId(0))])).toThrow(/not more than the Chancellor/)
        const keep = board()
        playAdviser(keep, vaultFor(), AMBITIONS)
        expect(keep.getPlayerState('ruler').status).toBe(PlayerStatus.Exile)
        expect(keep.reliquarySlots()).toHaveLength(4)
    })

    it('Relic Thief — a relic taken by Royal Ambitions or kept from Fae Merchant is a take it may roll for', () => {
        const thief = { chancellor: { siteId: 'c2', advisers: [{ cardId: 'denizen.discord.relic-thief', faceUp: true }] } }
        const asked = (s: ReturnType<typeof board>) => s.pendingQuestions?.queue.find((q) => q.kind === PowerQuestionKind.RelicThiefRoll)
        const s = board({}, {}, thief)
        playAdviser(s, vaultFor({ relicFacedown: { [reliquarySlotId(1)]: DRUM } }), AMBITIONS, [yes, slot(reliquarySlotId(1))])
        expect(asked(s)).toMatchObject({ askedPlayerId: 'chancellor', takerPlayerId: 'ruler', relicCardIds: [DRUM] })
        const kept = board({ c1: [FAE] }, {}, { ...thief, ruler: { relicIds: [CUP] } })
        serverUse(kept, vaultFor(), FAE)
        answerQuestion(kept, 'ruler', { kind: PowerQuestionKind.BottomRelic, heldRelicCardId: CUP })
        expect(asked(kept)).toMatchObject({ takerPlayerId: 'ruler', relicCardIds: [DRUM] })
        const unkept = board({ c1: [FAE] }, {}, { ...thief, ruler: { relicIds: [CUP] } })
        serverUse(unkept, vaultFor(), FAE)
        answerQuestion(unkept, 'ruler', { kind: PowerQuestionKind.BottomRelic })
        expect(asked(unkept)).toBeUndefined()
    })

    it('Ancient Pact — the Darkest Secret is given to the Chancellor, unburned (its Q&A), for the seat and a relic', () => {
        const ds = { banners: { [Banner.DarkestSecret]: { holderPlayerId: 'ruler', value: 2 }, [Banner.PeoplesFavor]: { value: 1 } } }
        const s = board({}, {}, {}, ds)
        const vault = vaultFor({ relicFacedown: { [reliquarySlotId(0)]: CUP } })
        playAdviser(s, vault, PACT, [yes, slot(reliquarySlotId(0))])
        expect(s.getPlayerState('ruler').status).toBe(PlayerStatus.Citizen)
        expect(s.banners[Banner.DarkestSecret].holderPlayerId).toBe('chancellor')
        // R-2.5.3 — a Seize burns two secrets, never below one.
        expect(s.banners[Banner.DarkestSecret].value).toBe(2)
        expect(s.getPlayerState('ruler').relicIds).toEqual([CUP])
        expect(() => playAdviser(board(), vaultFor(), PACT, [yes, slot(reliquarySlotId(0))])).toThrow(/Darkest Secret/)
    })
})
