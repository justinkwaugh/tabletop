import { afterEach, describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    ActionType,
    IMPERIAL_WARBANDS,
    MachineState,
    OathRevision,
    PlayerStatus,
    PowerChoiceKind,
    type LegalPowerUse,
    type OathPlayerState,
    type OathProjectedState
} from '@tabletop/oath'
import { openTurn, required, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { emptyPicks } from './powerChoices.js'
import type { OathGameSession } from './session.svelte.js'

afterEach(() => {
    disposeSessions()
})

const CAPTAINS = 'denizen.order.captains'
const SIEGE_ENGINES = 'denizen.order.siege-engines'
const PALANQUIN = 'denizen.order.palanquin'
const IVORY_EYE = 'relic.ivory-eye'

/**
 * Dana, the Chancellor, stands at the Drowned City (c1, Cradle), which Rhys rules with 2. She rules
 * the Plains (c2), where Captains lies and Rhys's pawn stands, and the Great Slum (p1), where
 * Ann's pawn stands. Captains offers the sites she rules; Siege Engines, in her advisers, the
 * faceup sites in her region. h3 is facedown.
 */
function table(
    dana: Partial<OathPlayerState> = {},
    over: Partial<OathProjectedState> = {},
    pawns: { rhys?: string; ann?: string } = {},
    rhysHolds: Partial<OathPlayerState> = {}
) {
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                advisers: [{ cardId: SIEGE_ENGINES, faceUp: true }],
                ...dana
            }),
            testPlayer({ playerId: 'rhys', color: Color.Red, siteId: pawns.rhys ?? 'c2', ...rhysHolds }),
            testPlayer({ playerId: 'ann', color: Color.Blue, siteId: pawns.ann ?? 'p1' })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'dana',
            siteCards: {
                c1: 'site.drowned-city',
                c2: 'site.plains',
                p1: 'site.great-slums',
                p2: 'site.river',
                p3: 'site.mountain',
                h1: 'site.narrow-pass',
                h2: 'site.wastes'
            },
            denizensBySite: { c1: [], c2: [CAPTAINS], p1: [], p2: [], p3: [], h1: [], h2: [] },
            warbandsBySite: {
                c1: { rhys: 2 },
                c2: { [IMPERIAL_WARBANDS]: 2 },
                p1: { [IMPERIAL_WARBANDS]: 3 }
            },
            ...over
        }
    )
    openTurn(state, 'dana')
    return state
}

function usingPowers(state = table()): OathGameSession {
    const session = openSessionOn(tableOf(state))
    session.chooseAction(ActionType.UseActionPower)
    return session
}

function powerOf(session: OathGameSession, cardId: string): LegalPowerUse {
    return required(
        session.actionPowers.powers.find((p) => p.cardId === cardId),
        `${cardId} is listed`
    )
}

/** Each lit site with the words its chip carries, in the map's slot order. */
function lit(session: OathGameSession): [string, string][] {
    return session.siteOffers
        .flatMap((offer) => (offer.intent === 'power' ? [[offer.slotId, offer.rows.join(' · ')] as [string, string]] : []))
        .sort(([a], [b]) => a.localeCompare(b))
}

function ringed(session: OathGameSession): string[] {
    return session.siteOffers.flatMap((offer) => (offer.intent === 'power' && offer.picked ? [offer.slotId] : []))
}

function siteOf(session: OathGameSession, cardId: string): string | undefined {
    const power = powerOf(session, cardId)
    return session.actionPowers.siteRow(power, 0)?.picked
}

describe('a power’s site on the lit map: one pick for the whole panel', () => {
    it('every site either power takes is lit, each chip naming the rows a tap there fills, in the panel’s order', () => {
        const session = usingPowers()
        const listed = session.actionPowers.powers.map((p) => p.cardId)
        expect([...listed].sort()).toEqual([CAPTAINS, SIEGE_ENGINES].sort())
        const both = listed.indexOf(CAPTAINS) < listed.indexOf(SIEGE_ENGINES) ? 'Campaign · Kill 2' : 'Kill 2 · Campaign'
        expect(lit(session)).toEqual([
            ['c1', 'Kill 2'],
            ['c2', both],
            ['p1', 'Campaign']
        ])
        expect(ringed(session)).toEqual([])
        expect(session.mapDimmed).toBe(true)
        expect(session.mapPick).toEqual({ kind: 'power', sites: expect.arrayContaining(['c1', 'c2', 'p1']), choosing: true, moverId: session.myPlayer?.id })
        // Picks start empty: no Use until a tap.
        for (const cardId of [CAPTAINS, SIEGE_ENGINES]) {
            expect(session.actionPowers.picksComplete(powerOf(session, cardId))).toBe(false)
            expect(session.actionPowers.siteRow(powerOf(session, cardId), 0)).toMatchObject({ ready: true, made: false, picked: undefined })
        }
    })

    it('a tap on a site one row lacks fills only the other; that row keeps “tap a lit site.”', () => {
        const session = usingPowers()
        session.actionPowers.pickSite('c1')
        expect(siteOf(session, SIEGE_ENGINES)).toBe('c1')
        expect(siteOf(session, CAPTAINS)).toBeUndefined()
        expect(session.actionPowers.picksComplete(powerOf(session, SIEGE_ENGINES))).toBe(true)
        expect(session.actionPowers.picksComplete(powerOf(session, CAPTAINS))).toBe(false)
        expect(ringed(session)).toEqual(['c1'])
        // The map stays lit: another tap moves the one ring.
        expect(lit(session).map(([slot]) => slot)).toEqual(['c1', 'c2', 'p1'])
    })

    it('a tap on a site both rows offer fills both, and nothing is sent until a Use is pressed', () => {
        const session = usingPowers()
        const before = session.gameState.actionCount
        session.actionPowers.pickSite('c2')
        expect(siteOf(session, CAPTAINS)).toBe('c2')
        expect(siteOf(session, SIEGE_ENGINES)).toBe('c2')
        for (const cardId of [CAPTAINS, SIEGE_ENGINES]) {
            const power = powerOf(session, cardId)
            expect(session.actionPowers.picksComplete(power)).toBe(true)
            expect(session.actionPowers.choicesFor(power)).toEqual([{ kind: PowerChoiceKind.Site, siteId: 'c2' }])
            expect(session.actionPowers.reasonCannotUse(power)).toBeUndefined()
        }
        expect(session.gameState.actionCount).toBe(before)
    })

    it('a tap elsewhere moves the one ring: a row that lacks the new site lets its old one go', () => {
        const session = usingPowers()
        session.actionPowers.pickSite('c2')
        session.actionPowers.pickSite('p1')
        expect(siteOf(session, CAPTAINS)).toBe('p1')
        expect(siteOf(session, SIEGE_ENGINES)).toBeUndefined()
        expect(ringed(session)).toEqual(['p1'])
    })

    it('a site no listed power can take is no pick', () => {
        const session = usingPowers()
        session.actionPowers.pickSite('p2')
        expect(session.actionPowers.hasManualSelection()).toBe(false)
        expect(ringed(session)).toEqual([])
    })

    it('Undo takes back the last tap, then the one before, then nothing is left', () => {
        const session = usingPowers()
        session.actionPowers.pickSite('c2')
        session.actionPowers.pickSite('c1')
        expect(session.actionPowers.back()).toBe(true)
        expect([siteOf(session, CAPTAINS), siteOf(session, SIEGE_ENGINES)]).toEqual(['c2', 'c2'])
        expect(session.actionPowers.back()).toBe(true)
        expect([siteOf(session, CAPTAINS), siteOf(session, SIEGE_ENGINES)]).toEqual([undefined, undefined])
        expect(session.actionPowers.hasManualSelection()).toBe(false)
        expect(session.actionPowers.back()).toBe(false)
    })

    it('a tap on the ringed site again changes nothing, and is no tap for Undo', () => {
        const session = usingPowers()
        session.actionPowers.pickSite('c2')
        session.actionPowers.pickSite('c2')
        expect(session.actionPowers.back()).toBe(true)
        expect(session.actionPowers.hasManualSelection()).toBe(false)
    })

    it('R-7.1.2 — a card holding its cost is not listed, so only the other power wants a site', () => {
        const session = usingPowers(table({}, { cardTokens: { [SIEGE_ENGINES]: { favor: 1, secrets: 0 } } }))
        expect(session.actionPowers.powers.map((p) => p.cardId)).toEqual([CAPTAINS])
        expect(lit(session)).toEqual([
            ['c2', 'Campaign'],
            ['p1', 'Campaign']
        ])
    })

    it('a row with one legal site starts with it picked and stays out of the shared pick', () => {
        // Rhys's 2 leave the Drowned City; Dana rules only the Plains.
        const session = usingPowers(table({}, { warbandsBySite: { c2: { [IMPERIAL_WARBANDS]: 2 } } }))
        const captains = powerOf(session, CAPTAINS)
        expect(session.actionPowers.siteRow(captains, 0)).toMatchObject({ made: true, picked: 'c2', sites: ['c2'] })
        expect(session.actionPowers.picksComplete(captains)).toBe(true)
        expect(lit(session)).toEqual([
            ['c1', 'Kill 2'],
            ['c2', 'Kill 2']
        ])
        // A tap for Siege Engines leaves Captains' one site where it is.
        session.actionPowers.pickSite('c1')
        expect(siteOf(session, CAPTAINS)).toBe('c2')
        expect(siteOf(session, SIEGE_ENGINES)).toBe('c1')
    })

    it('a phone’s region chips count the lit sites', () => {
        const session = usingPowers()
        expect(session.mapPick?.kind).toBe('power')
        expect([...(session.mapPick?.sites ?? [])].sort()).toEqual(['c1', 'c2', 'p1'])
    })

    it('choosing another action ends the pick: nothing is lit', () => {
        const session = usingPowers()
        session.actionPowers.pickSite('c2')
        session.chooseAction(ActionType.Travel)
        expect(lit(session)).toEqual([])
        session.chooseAction(ActionType.UseActionPower)
        expect(ringed(session)).toEqual([])
    })
})

describe('Palanquin: its sites light once its player is picked, and only where they can travel', () => {
    /** Dana and Rhys stand at the Drowned City; Ann at the Great Slum. The Narrow Pass is the Hinterland's. */
    function palanquinTable() {
        return table({ advisers: [{ cardId: PALANQUIN, faceUp: true }] }, {}, { rhys: 'c1', ann: 'c1' })
    }

    it('nothing is lit before its player chip; then every other site the player could travel to', () => {
        const session = usingPowers(palanquinTable())
        const palanquin = powerOf(session, PALANQUIN)
        const siteSpec = palanquin.choices.findIndex((legal) => legal.spec.kind === PowerChoiceKind.Site)
        expect(session.actionPowers.siteRow(palanquin, siteSpec)).toMatchObject({ ready: false, sites: [] })
        expect(lit(session).filter(([, words]) => words.includes('Carry'))).toEqual([])

        const players = palanquin.choices[0].options
        const rhys = players.findIndex((option) => option.kind === PowerChoiceKind.Player && option.playerId === 'rhys')
        session.actionPowers.setPicks(palanquin, { ...emptyPicks(), option: { 0: rhys } })
        const row = required(session.actionPowers.siteRow(powerOf(session, PALANQUIN), siteSpec), 'a site row')
        expect(row.ready).toBe(true)
        // R-5.6 — the pawn's own site is not offered; the Narrow Pass is the only way into the Hinterland.
        expect(row.sites).not.toContain('c1')
        expect(row.sites).toContain('h1')
        expect(row.sites).not.toContain('h2')
        expect(row.sites).not.toContain('h3')
        expect(row.sites).toContain('c2')
        // Captains still offers the Plains and the Great Slum: those chips name both rows.
        const carried = lit(session).filter(([, words]) => words.includes('Carry'))
        expect(carried.map(([slot]) => slot)).toEqual([...row.sites].sort())
        // The chip names its rows in the panel's order: an adviser's power before a site's.
        expect(Object.fromEntries(carried)).toMatchObject({ c2: 'Carry · Campaign', p2: 'Carry' })
    })

    it('a site the engine refuses for the picked player is never kept, even when tapped before', () => {
        const session = usingPowers(palanquinTable())
        const palanquin = powerOf(session, PALANQUIN)
        const rhys = palanquin.choices[0].options.findIndex(
            (option) => option.kind === PowerChoiceKind.Player && option.playerId === 'rhys'
        )
        const h2 = palanquin.choices[1].options.findIndex((option) => option.kind === PowerChoiceKind.Site && option.siteId === 'h2')
        session.actionPowers.setPicks(palanquin, { ...emptyPicks(), option: { 0: rhys, 1: h2 } })
        expect(session.actionPowers.siteRow(powerOf(session, PALANQUIN), 1)?.picked).toBeUndefined()
        expect(session.actionPowers.picksComplete(powerOf(session, PALANQUIN))).toBe(false)
    })
})

describe('the Ivory Eye: a facedown site is offered only while nothing else is picked to peek at', () => {
    it('lights the facedown site with “Peek”, not a faceup one; an optional pick is not made for the player', () => {
        const session = usingPowers(table({ advisers: [], relicIds: [IVORY_EYE] }))
        const eye = powerOf(session, IVORY_EYE)
        const siteSpec = eye.choices.findIndex((legal) => legal.spec.kind === PowerChoiceKind.Site)
        expect(session.actionPowers.siteRow(eye, siteSpec)).toMatchObject({ sites: ['h3'], made: false, picked: undefined })
        expect(lit(session)).toEqual([
            ['c2', 'Campaign'],
            ['h3', 'Peek'],
            ['p1', 'Campaign']
        ])
        session.actionPowers.pickSite('h3')
        expect(session.actionPowers.siteRow(powerOf(session, IVORY_EYE), siteSpec)?.picked).toBe('h3')
        expect(session.actionPowers.picksComplete(powerOf(session, IVORY_EYE))).toBe(true)
        expect(session.actionPowers.reasonCannotUse(powerOf(session, IVORY_EYE))).toBeUndefined()
    })
})

describe('Resettle: its site lights once its card is picked', () => {
    const RESETTLE = 'denizen.nomad.resettle'
    const ELDERS = 'denizen.nomad.elders'
    const STEED = 'denizen.nomad.a-fast-steed'
    const SLUM_FULL = ['denizen.hearth.wayside-inn', 'denizen.beast.the-old-oak', 'denizen.arcane.spirit-snare']

    /** Resettle lies at the Drowned City, where Dana stands; Rhys keeps two Nomads faceup; the Great Slum is full. */
    const resettleTable = () =>
        table(
            { advisers: [] },
            {
                denizensBySite: { c1: [RESETTLE], c2: [CAPTAINS], p1: SLUM_FULL, p2: [], p3: [], h1: [], h2: [] },
                warbandsBySite: { c1: { rhys: 2 }, c2: { [IMPERIAL_WARBANDS]: 2 } }
            },
            {},
            { advisers: [{ cardId: ELDERS, faceUp: true }, { cardId: STEED, faceUp: true }] }
        )

    it('nothing is lit for it before the card; then every site with room, and the full Great Slum, which a discard first opens', () => {
        const session = usingPowers(resettleTable())
        const resettle = powerOf(session, RESETTLE)
        expect(session.actionPowers.siteRow(resettle, 1)).toMatchObject({ ready: false, sites: [] })
        expect(lit(session).filter(([, words]) => words.includes('Place it'))).toEqual([])

        const elders = resettle.choices[0].options.findIndex(
            (option) => option.kind === PowerChoiceKind.Card && option.cardId === ELDERS
        )
        expect(elders).toBeGreaterThanOrEqual(0)
        session.actionPowers.setPicks(resettle, { ...emptyPicks(), option: { 0: elders } })
        const row = required(session.actionPowers.siteRow(powerOf(session, RESETTLE), 1), 'a site row')
        expect(row.ready).toBe(true)
        expect(row.sites).toContain('p1')
        expect(row.sites).toContain('c2')
        expect(lit(session).find(([slot]) => slot === 'p1')?.[1]).toBe('Place it')
    })
})

const WILD_ALLIES = 'denizen.beast.wild-allies'

/** Revision 8: Captains and Wild Allies offer only a site a Campaign can be declared from. */
describe('revision 8: Captains and Wild Allies light only the sites the engine offers', () => {
    const at8 = (
        dana: Partial<OathPlayerState> = {},
        over: Partial<OathProjectedState> = {},
        pawns: { ann?: string } = {}
    ) => table(dana, { oathRevision: OathRevision.EngineFixes4, ...over }, pawns)

    it('Captains: a site Dana rules with no one there to defend it is not lit; before revision 8 it was', () => {
        // Ann's pawn leaves the Great Slum, which Dana rules with the Empire's 3: no one defends it.
        const fixed = usingPowers(at8({ advisers: [] }, {}, { ann: 'h1' }))
        expect(fixed.actionPowers.siteRow(powerOf(fixed, CAPTAINS), 0)).toMatchObject({
            sites: ['c2'],
            picked: 'c2',
            made: true
        })
        expect(lit(fixed)).toEqual([])
        const older = usingPowers(table({ advisers: [] }, {}, { ann: 'h1' }))
        expect(older.actionPowers.siteRow(powerOf(older, CAPTAINS), 0)?.sites).toEqual(['c2', 'p1'])
        expect(lit(older)).toEqual([
            ['c2', 'Campaign'],
            ['p1', 'Campaign']
        ])
    })

    it('Wild Allies: The Hidden Place is lit only while a secret is left to flip once its cost has placed one', () => {
        // Beast cards at the Drowned City, which Rhys rules, and at the Great Slum, here The Hidden Place,
        // where Ann stands; no Captains.
        const scene = (secrets: number) =>
            at8(
                { advisers: [{ cardId: WILD_ALLIES, faceUp: true }], secrets },
                {
                    siteCards: { ...table().siteCards, p1: 'site.the-hidden-place' },
                    denizensBySite: {
                        c1: ['denizen.beast.wolves'],
                        c2: [],
                        p1: ['denizen.beast.rangers'],
                        p2: [],
                        p3: [],
                        h1: [],
                        h2: []
                    }
                }
            )
        const one = usingPowers(scene(1))
        expect(one.actionPowers.siteRow(powerOf(one, WILD_ALLIES), 0)?.sites).toEqual(['c1'])
        // One site left: it starts picked, and nothing is lit.
        expect(lit(one)).toEqual([])
        const two = usingPowers(scene(2))
        expect(two.actionPowers.siteRow(powerOf(two, WILD_ALLIES), 0)?.sites).toEqual(['c1', 'p1'])
        expect(lit(two)).toEqual([
            ['c1', 'Campaign'],
            ['p1', 'Campaign']
        ])
    })
})
