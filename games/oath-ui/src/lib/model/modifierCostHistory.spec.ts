import { afterEach, describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    HydratedPlayFacedownAdviser,
    HydratedSearch,
    HydratedUseActionPower,
    MachineState,
    OathRevision,
    PlayFacedownAdviser,
    PowerTiming,
    Search,
    SearchPlay,
    SearchSource,
    UseActionPower,
    powerIndexOf,
    type HydratedOathGameState,
    type ModifierUse
} from '@tabletop/oath'
import {
    buildAction,
    openTurn,
    placeEdifice,
    required,
    testPlayer,
    testState
} from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { describeAction } from './actionDescription.js'
import { searchRows } from './searchRows.js'

// Great Spire: "You may swap any number of denizens you draw with random cards from the
// Dispossessed"; its cost is a secret placed on it. Law 7.1.2: a modifier's cost is paid when it is
// used. Each line the History writes names every cost paid: the action's and each card's in use.

afterEach(() => disposeSessions())

const ORACLE = 'denizen.nomad.oracle'
const SPIRE = 'edifice.arcane.great-spire'
const HORN = 'relic.cracked-horn'
const LAND_WARDEN = 'denizen.hearth.land-warden'
const INN = 'denizen.hearth.wayside-inn'
const WOLVES = 'denizen.beast.wolves'
const SUPREMACY = 'vision.supremacy'

const modifier = (cardId: string): ModifierUse => ({
    cardId,
    powerIndex: powerIndexOf(cardId, PowerTiming.Modifier)
})
const SPIRE_USE = modifier(SPIRE)

const REVISIONS: [string, OathRevision][] = [
    ['32', OathRevision.EngineFixes27],
    ['31', OathRevision.EngineFixes26],
    ['30', OathRevision.Chronicle]
]

/**
 * Dana on turn at c1 (the Cradle) with 3 secrets and 3 favor, Oracle and the intact Great Spire there,
 * and the Inn, a Vision and the Wolves on top of the world deck.
 */
function table(
    revision: OathRevision,
    extra: { relicIds?: string[]; advisers?: { cardId: string; faceUp: boolean }[] } = {}
): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 3,
                supply: 6,
                relicIds: extra.relicIds ?? [],
                advisers: extra.advisers ?? []
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c2', favor: 2 })
        ],
        {
            oathRevision: revision,
            machineState: MachineState.ActPhase,
            denizensBySite: { c1: [ORACLE], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } }
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = [INN, SUPREMACY, WOLVES]
    placeEdifice(s, 'c1', SPIRE)
    return s
}

const dana = (s: HydratedOathGameState) =>
    required(
        s.players.find((p) => p.playerId === 'dana'),
        'Dana is seated'
    )

/** The line Rhys reads for the action, applied to the table. */
async function lineFor(
    s: HydratedOathGameState,
    action: HydratedSearch | HydratedUseActionPower | HydratedPlayFacedownAdviser
): Promise<string> {
    const session = await openSessionOn(tableOf(s))
    return describeAction(action.dehydrate(), session.historyNames, 'rhys')
}

function search(modifiers: ModifierUse[]): HydratedSearch {
    return new HydratedSearch(
        buildAction(Search, {
            playerId: 'dana',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers
        })
    )
}

function oracleUse(modifiers: ModifierUse[]): HydratedUseActionPower {
    return new HydratedUseActionPower(
        buildAction(UseActionPower, {
            playerId: 'dana',
            cardId: ORACLE,
            powerIndex: powerIndexOf(ORACLE, PowerTiming.Action),
            modifiers
        })
    )
}

describe('a Search with Great Spire in use: the source row and History name its secret', () => {
    for (const [name, revision] of REVISIONS) {
        it(`at ${name}: the row shows 2 Supply + 1 secret, History "spending 2 Supply and placing a secret on Great Spire"; 1 secret paid`, async () => {
            const s = table(revision)
            const [row] = searchRows(s, 'dana', [SPIRE_USE], [])
            expect(row?.cost).toBe(2)
            expect(row?.cardCost?.placeSecret).toBe(1)

            const action = search([SPIRE_USE])
            action.apply(s)
            expect(dana(s).secrets).toBe(2)
            expect(dana(s).supply).toBe(4)
            expect(await lineFor(s, action)).toBe(
                'searched the world deck, spending 2 Supply and placing a secret on Great Spire; the draw stopped on a Vision'
            )
        })
    }

    it('with Land Warden in use too, each card is named by its cost', async () => {
        const s = table(OathRevision.EngineFixes26, {
            advisers: [{ cardId: LAND_WARDEN, faceUp: true }]
        })
        const action = search([SPIRE_USE, modifier(LAND_WARDEN)])
        action.apply(s)
        // Land Warden's favor is placed too (Law 7.1.2).
        expect(dana(s).secrets).toBe(2)
        expect(dana(s).favor).toBe(2)
        expect(await lineFor(s, action)).toBe(
            'searched the world deck, spending 2 Supply and placing a secret on Great Spire and placing a favor on Land Warden; the draw stopped on a Vision'
        )
    })

    it('a record that does not say which cards acted names no card cost, as before', async () => {
        const s = table(OathRevision.EngineFixes26)
        const action = search([SPIRE_USE])
        action.apply(s)
        const record = action.dehydrate() as Search
        const { modifiers: _acted, ...metadata } = required(record.metadata, 'the Search records')
        const session = await openSessionOn(tableOf(s))
        expect(describeAction({ ...record, metadata }, session.historyNames, 'rhys')).toBe(
            'searched the world deck, spending 2 Supply; the draw stopped on a Vision'
        )
    })

    it('without Great Spire the line is as before', async () => {
        const s = table(OathRevision.EngineFixes26)
        const action = search([])
        action.apply(s)
        expect(dana(s).secrets).toBe(3)
        expect(await lineFor(s, action)).toBe(
            'searched the world deck, spending 2 Supply; the draw stopped on a Vision'
        )
    })
})

describe("Oracle's use with Great Spire declared: History names both cards' secrets", () => {
    for (const [name, revision] of REVISIONS.slice(0, 2)) {
        it(`at ${name}: "used Oracle, placing 2 secrets on it and placing a secret on Great Spire"; 3 secrets paid`, async () => {
            const s = table(revision)
            const action = oracleUse([SPIRE_USE])
            action.apply(s)
            expect(dana(s).secrets).toBe(0)
            expect(await lineFor(s, action)).toMatch(
                /^used Oracle, placing 2 secrets on it and placing a secret on Great Spire: drew the next Vision/
            )
        })
    }

    it('a free card beside it stays in brackets: "…on Great Spire (Cracked Horn): …"', async () => {
        const s = table(OathRevision.EngineFixes26, { relicIds: [HORN] })
        const action = oracleUse([SPIRE_USE, modifier(HORN)])
        action.apply(s)
        expect(dana(s).secrets).toBe(0)
        expect(await lineFor(s, action)).toMatch(
            /^used Oracle, placing 2 secrets on it and placing a secret on Great Spire \(Cracked Horn\): drew the next Vision/
        )
    })

    it('the Horn alone: "used Oracle, placing 2 secrets on it (Cracked Horn)", as before', async () => {
        const s = table(OathRevision.EngineFixes26, { relicIds: [HORN] })
        const action = oracleUse([modifier(HORN)])
        action.apply(s)
        expect(dana(s).secrets).toBe(1)
        expect(await lineFor(s, action)).toMatch(
            /^used Oracle, placing 2 secrets on it \(Cracked Horn\): drew the next Vision/
        )
    })

    it('before revision 31 the use takes no Search card, so nothing more is paid or named', async () => {
        const s = table(OathRevision.Chronicle)
        expect(() => oracleUse([SPIRE_USE]).apply(s)).toThrow(/before revision 31/)
        const action = oracleUse([])
        action.apply(s)
        expect(dana(s).secrets).toBe(1)
        expect(await lineFor(s, action)).toMatch(
            /^used Oracle, placing 2 secrets on it: drew the next Vision/
        )
    })
})

describe('a facedown adviser played with Great Spire declared (R-6.1): History names its secret', () => {
    for (const [name, revision] of REVISIONS) {
        it(`at ${name}: "played Wolves to their site, placing a secret on Great Spire, gaining 1 favor"; 1 secret paid`, async () => {
            const s = table(revision, { advisers: [{ cardId: WOLVES, faceUp: false }] })
            const action = new HydratedPlayFacedownAdviser(
                buildAction(PlayFacedownAdviser, {
                    playerId: 'dana',
                    cardId: WOLVES,
                    play: SearchPlay.Site,
                    modifiers: [SPIRE_USE]
                })
            )
            action.apply(s)
            expect(dana(s).secrets).toBe(2)
            expect(await lineFor(s, action)).toBe(
                'played Wolves to their site, placing a secret on Great Spire, gaining 1 favor'
            )
        })
    }
})
