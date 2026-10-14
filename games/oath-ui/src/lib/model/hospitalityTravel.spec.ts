import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, Color, assert, type GameAction } from '@tabletop/common'
import {
    ActionType,
    HydratedOathGameState,
    HydratedTravel,
    PowerChoiceKind,
    PowerTiming,
    Suit,
    isTravel,
    Region,
    powerIndexOf,
    type ModifierUse,
    type Travel
} from '@tabletop/oath'
import { openTurn, served, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { shroudedWoodState } from '$lib/testing/shroudedWoodTable.js'
import { actionCards, actionMenuRows } from './actionCards.js'
import { describeAction } from './actionDescription.js'
import { chipWords, travelChip } from './travelOnTheMap.js'
import { travelRows } from './travelRows.js'
import { travelSpoken } from './travelWords.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const HOSPITALITY = 'denizen.nomad.hospitality'
const WAR_TORTOISE = 'denizen.beast.war-tortoise'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const WOLVES = 'denizen.beast.wolves'
const ORACLE = 'denizen.nomad.oracle'
const BIRDSONG = 'denizen.beast.birdsong'
const FORCED_LABOR = 'denizen.order.forced-labor'
const ROWDY_PUB = 'denizen.hearth.rowdy-pub'
const TOLL_ROADS = 'denizen.order.toll-roads'
const WAY_STATION = 'denizen.nomad.way-station'
const VOW_OF_POVERTY = 'denizen.beast.vow-of-poverty'
const VOW_OF_KINSHIP = 'denizen.nomad.vow-of-kinship'
const DRUM = 'relic.dragonskin-drum'

const hospitality = { cardId: HOSPITALITY, powerIndex: powerIndexOf(HOSPITALITY, PowerTiming.Modifier) }
const drum = { cardId: DRUM, powerIndex: powerIndexOf(DRUM, PowerTiming.Modifier) }
const withBank = (suit: Suit): ModifierUse => ({
    ...hospitality,
    choices: [{ kind: PowerChoiceKind.FavorBank, suit }]
})

type Seat = Parameters<typeof testPlayer>[0]

/**
 * Dana travels from the top Cradle site, holding Hospitality (nomad), War Tortoise (beast) and
 * Crop Rotation (hearth); the hearth bank is empty. Rhys rules the other Cradle site. The cards at
 * each destination: the Cradle's Wolves (one bank, beast); the first Provinces site Oracle and
 * Birdsong (two banks, beast and nomad); the second Forced Labor (no match); the third Rowdy Pub
 * (hearth, whose bank is empty); the first Hinterland site Rowdy Pub and Wolves (beast only); the
 * second Hinterland site is facedown.
 */
function scene(dana: Partial<Seat> = {}, denizens: Record<string, string[]> = {}) {
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                supply: 7,
                favor: 3,
                advisers: [HOSPITALITY, WAR_TORTOISE, CROP_ROTATION].map((cardId) => ({ cardId, faceUp: true })),
                ...dana
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'h3', favor: 3, warbandsOnBoard: { rhys: 3 } })
        ],
        {
            denizensBySite: {
                c1: [],
                c2: [WOLVES],
                p1: [ORACLE, BIRDSONG],
                p2: [FORCED_LABOR],
                p3: [ROWDY_PUB],
                h1: [ROWDY_PUB, WOLVES],
                h2: [],
                h3: [],
                ...denizens
            },
            warbandsBySite: { c2: { rhys: 2 } },
            siteCards: { c1: 'c1', c2: 'c2', p1: 'p1', p2: 'p2', p3: 'p3', h1: 'h1', h3: 'h3' }
        }
    )
    state.favorBank[Suit.Hearth] = 0
    openTurn(state, 'dana')
    return state
}

function travelling(state = scene()) {
    const session = openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    session.chooseAction(ActionType.Travel)
    return { session, sent }
}

const rowAt = (session: ReturnType<typeof travelling>['session'], slotId: string) => {
    const row = session.travelRows.find((r) => r.slotId === slotId)
    assert(row !== undefined, `${slotId} is offered`)
    return row
}

function sentTravel(sent: { mock: { calls: [GameAction][] } }) {
    const action = sent.mock.calls[0]?.[0]
    assert(action !== undefined && isTravel(action), 'a Travel is sent')
    return action
}

const banksOf = (ways: readonly { hospitality?: Suit }[]) => ways.map((way) => way.hospitality)

describe('Hospitality on a Travel: the gain shows on each destination it fits (R-7.4)', () => {
    it('starts in use, and every destination stays listed with Hospitality in use', () => {
        const { session } = travelling()
        expect(session.modifiers.isDeclared(hospitality)).toBe(true)
        expect(session.modifiers.listed.map((power) => power.cardId)).toContain(HOSPITALITY)
        expect(session.modifiers.picksPending).toBe(false)
        const plain = travelRows(scene(), 'dana', []).map((row) => row.slotId)
        expect(plain).toEqual(['c2', 'p1', 'p2', 'p3', 'h1', 'h2', 'h3'])
        expect(session.travelRows.map((row) => row.slotId)).toEqual(plain)
        expect(session.selectableSites).toEqual(plain)
    })

    it('draws no bank picker: the bank is the destination’s, not asked first', () => {
        const { session } = travelling()
        const [power] = session.modifiers.listed.filter((p) => p.cardId === HOSPITALITY)
        assert(power !== undefined, 'Hospitality is listed')
        expect(session.modifiers.picksInMenu(power)).toBe(true)
    })

    it('one matching bank: the one way carries it, and a tap on the map sends it at once', async () => {
        const { session, sent } = travelling()
        expect(banksOf(rowAt(session, 'c2').ways)).toEqual([Suit.Beast])
        await session.pickTravelSite('c2')
        expect(sentTravel(sent).modifiers).toEqual([withBank(Suit.Beast)])
    })

    it('two matching banks: one way per bank, a map tap opens them, and the way picked sends its bank', async () => {
        const { session, sent } = travelling()
        const ways = rowAt(session, 'p1').ways
        expect(banksOf(ways)).toEqual([Suit.Beast, Suit.Nomad])
        expect(ways.map((way) => way.cost)).toEqual([ways[0]?.cost, ways[0]?.cost])

        await session.pickTravelSite('p1')
        expect(sent).not.toHaveBeenCalled()
        expect(session.travelWaysOpen?.slotId).toBe('p1')

        const nomad = ways[1]
        assert(nomad !== undefined, 'the nomad way is offered')
        await session.travelTo('p1', nomad)
        expect(sentTravel(sent).modifiers).toEqual([withBank(Suit.Nomad)])
    })

    it('no matching bank: no gain, and the Travel is sent without Hospitality', async () => {
        const { session, sent } = travelling()
        expect(session.modifiers.isDeclared(hospitality)).toBe(true)
        expect(banksOf(rowAt(session, 'p2').ways)).toEqual([undefined])
        await session.pickTravelSite('p2')
        expect(sentTravel(sent).modifiers).toEqual([])
    })

    it('an empty matching bank gives no gain; beside another match, only the bank with favor (R-9.3)', () => {
        const { session } = travelling()
        expect(banksOf(rowAt(session, 'p3').ways)).toEqual([undefined])
        expect(banksOf(rowAt(session, 'h1').ways)).toEqual([Suit.Beast])
    })

    it('a facedown site has no cards, so no gain (R-9.4)', () => {
        const { session } = travelling()
        expect(session.modifiers.isDeclared(hospitality)).toBe(true)
        const row = rowAt(session, 'h2')
        expect(row.cardId).toBeUndefined()
        expect(banksOf(row.ways)).toEqual([undefined])
    })

    it('Hospitality is a nomad adviser itself, so a nomad card at the destination matches it alone', () => {
        const { session } = travelling(scene({ advisers: [{ cardId: HOSPITALITY, faceUp: true }] }))
        expect(banksOf(rowAt(session, 'p1').ways)).toEqual([Suit.Nomad])
        expect(banksOf(rowAt(session, 'c2').ways)).toEqual([undefined])
    })

    it('put down, the gains leave the sites and nothing is sent with it; a tap brings it back', async () => {
        const { session, sent } = travelling()
        session.modifiers.declare(hospitality, false)
        expect(session.modifiers.isDeclared(hospitality)).toBe(false)
        expect(session.modifiers.listed.map((power) => power.cardId)).toContain(HOSPITALITY)
        expect(session.travelRows.flatMap((row) => banksOf(row.ways)).every((bank) => bank === undefined)).toBe(true)
        expect(rowAt(session, 'p1').ways).toHaveLength(1)
        session.modifiers.declare(hospitality, true)
        expect(banksOf(rowAt(session, 'p1').ways)).toEqual([Suit.Beast, Suit.Nomad])
        session.modifiers.declare(hospitality, false)
        await session.pickTravelSite('c2')
        expect(sentTravel(sent).modifiers).toEqual([])
    })

    it('Toll Roads at the destination: the toll and the gain stand on one way, and the send carries both', async () => {
        const { session, sent } = travelling(scene({}, { c2: [WOLVES, TOLL_ROADS] }))
        const ways = rowAt(session, 'c2').ways
        expect(ways.map((way) => [way.tolls, way.favorTo, way.hospitality])).toEqual([[[TOLL_ROADS], ['rhys'], Suit.Beast]])
        // A toll opens the way in the panel before anything is paid.
        await session.pickTravelSite('c2')
        expect(sent).not.toHaveBeenCalled()
        const [way] = ways
        assert(way !== undefined, 'the toll way is offered')
        await session.travelTo('c2', way)
        const action = sentTravel(sent)
        expect(action.modifiers).toEqual([withBank(Suit.Beast)])
        expect(action).toMatchObject({ tolls: [TOLL_ROADS] })
    })

    it('two ways to pay and two banks: one way per pair', async () => {
        const { session, sent } = travelling(scene({}, { c2: [WAY_STATION, WOLVES] }))
        const ways = rowAt(session, 'c2').ways
        expect(ways.map((way) => [way.discountTolls, way.hospitality])).toEqual([
            [[], Suit.Beast],
            [[], Suit.Nomad],
            [[WAY_STATION], Suit.Beast],
            [[WAY_STATION], Suit.Nomad]
        ])
        const last = ways[3]
        assert(last !== undefined, 'the fourth way is offered')
        await session.travelTo('c2', last)
        const action = sentTravel(sent)
        expect(action.modifiers).toEqual([withBank(Suit.Nomad)])
        expect(action).toMatchObject({ tolls: [WAY_STATION] })
    })

    it('another Travel card in use (the Dragonskin Drum): the banks are judged with it, and the send carries both', async () => {
        const { session, sent } = travelling(scene({ relicIds: [DRUM] }))
        expect(session.modifiers.isDeclared(drum)).toBe(true)
        expect(banksOf(rowAt(session, 'p1').ways)).toEqual([Suit.Beast, Suit.Nomad])
        await session.pickTravelSite('c2')
        expect(sentTravel(sent).modifiers).toEqual([drum, withBank(Suit.Beast)])
    })

    it('Vow of Poverty stops only a Trade’s favor: the gain shows, and the engine gives it', async () => {
        const vowed = () =>
            scene({ advisers: [HOSPITALITY, VOW_OF_POVERTY].map((cardId) => ({ cardId, faceUp: true })) })
        const { session, sent } = travelling(vowed())
        expect(banksOf(rowAt(session, 'c2').ways)).toEqual([Suit.Beast])
        await session.pickTravelSite('c2')
        const action = sentTravel(sent)
        const state = vowed()
        const before = state.getPlayerState('dana').favor
        new HydratedTravel(action).apply(state)
        expect(state.getPlayerState('dana').favor).toBe(before + 1)
    })
})

/**
 * Dana keeps her favor in the nomad bank (Vow of Kinship): none on her board, `nomad` in the bank.
 * Toll Roads at the Cradle site Rhys rules takes a favor to travel there.
 */
function kinship(nomad: number, denizens: Record<string, string[]> = {}) {
    const state = scene(
        { favor: 0, advisers: [HOSPITALITY, VOW_OF_KINSHIP, WAR_TORTOISE].map((cardId) => ({ cardId, faceUp: true })) },
        denizens
    )
    state.favorBank[Suit.Nomad] = nomad
    return state
}

const tollsAndBanks = (ways: readonly { tolls: readonly string[]; hospitality?: Suit }[]) =>
    ways.map((way) => [way.tolls, way.hospitality])

describe('Hospitality’s bank as the way’s tolls leave it (R-7.1.4, R-7.4, R-9.3)', () => {
    it('the engine pays the toll before the gain: a nomad bank the toll empties gives nothing', () => {
        const state = kinship(1, { c2: [ORACLE, TOLL_ROADS] })
        const travel = new HydratedTravel(
            recorded({
                type: ActionType.Travel,
                playerId: 'dana',
                siteId: 'c2',
                tolls: [TOLL_ROADS],
                modifiers: [withBank(Suit.Nomad)]
            }) as Travel
        )
        travel.apply(state)
        expect(state.favorBank[Suit.Nomad]).toBe(0)
        expect(state.getPlayerState('rhys').favor).toBe(4)
        expect(travel.metadata?.modifierNotes).toContain(`Hospitality: gained 0 favor from the ${Suit.Nomad} bank`)
    })

    it('Vow of Kinship pays the toll from the nomad bank: emptied, it offers no gain, and the Travel is sent without Hospitality', async () => {
        const { session, sent } = travelling(kinship(1, { c2: [ORACLE, TOLL_ROADS] }))
        const ways = rowAt(session, 'c2').ways
        expect(tollsAndBanks(ways)).toEqual([[[TOLL_ROADS], undefined]])
        const [way] = ways
        assert(way !== undefined, 'the toll way is offered')
        await session.travelTo('c2', way)
        const action = sentTravel(sent)
        expect(action.modifiers).toEqual([])
        expect(action).toMatchObject({ tolls: [TOLL_ROADS] })
    })

    it('beside another match, the emptied nomad bank drops and the bank that still holds favor stays', async () => {
        const { session, sent } = travelling(kinship(1, { c2: [ORACLE, WOLVES, TOLL_ROADS] }))
        const ways = rowAt(session, 'c2').ways
        expect(tollsAndBanks(ways)).toEqual([[[TOLL_ROADS], Suit.Beast]])
        const [way] = ways
        assert(way !== undefined, 'the toll way is offered')
        await session.travelTo('c2', way)
        expect(sentTravel(sent).modifiers).toEqual([withBank(Suit.Beast)])
    })

    it('two favor in the nomad bank: one is left after the toll, so the gain stands', () => {
        const { session } = travelling(kinship(2, { c2: [ORACLE, TOLL_ROADS] }))
        expect(tollsAndBanks(rowAt(session, 'c2').ways)).toEqual([[[TOLL_ROADS], Suit.Nomad]])
    })

    it('a toll paid from the board leaves the bank’s offer unchanged', () => {
        const state = scene({}, { c2: [ORACLE, TOLL_ROADS] })
        state.favorBank[Suit.Nomad] = 1
        const { session } = travelling(state)
        expect(tollsAndBanks(rowAt(session, 'c2').ways)).toEqual([[[TOLL_ROADS], Suit.Nomad]])
    })

    it('Way Station: the way that pays its toll from the nomad bank has no gain; the way that does not keeps it', async () => {
        const { session, sent } = travelling(kinship(1, { c2: [WAY_STATION] }))
        const ways = rowAt(session, 'c2').ways
        expect(tollsAndBanks(ways)).toEqual([
            [[], Suit.Nomad],
            [[WAY_STATION], undefined]
        ])
        const paid = ways[1]
        assert(paid !== undefined, 'the toll way is offered')
        await session.travelTo('c2', paid)
        const action = sentTravel(sent)
        expect(action.modifiers).toEqual([])
        expect(action).toMatchObject({ tolls: [WAY_STATION] })
    })

    it('a payee who keeps favor in the nomad bank fills it: the gain shows, and the engine gives it', async () => {
        const fills = () => {
            const state = scene({}, { c2: [ORACLE, TOLL_ROADS] })
            const rhys = state.getPlayerState('rhys')
            rhys.favor = 0
            rhys.advisers = [{ cardId: VOW_OF_KINSHIP, faceUp: true }]
            state.favorBank[Suit.Nomad] = 0
            return state
        }
        const { session, sent } = travelling(fills())
        const ways = rowAt(session, 'c2').ways
        expect(tollsAndBanks(ways)).toEqual([[[TOLL_ROADS], Suit.Nomad]])
        const [way] = ways
        assert(way !== undefined, 'the toll way is offered')
        await session.travelTo('c2', way)
        const action = sentTravel(sent)
        expect(action.modifiers).toEqual([withBank(Suit.Nomad)])
        const state = fills()
        const before = state.getPlayerState('dana').favor
        new HydratedTravel(action).apply(state)
        // One favor to Rhys's nomad bank for the toll, then Hospitality's one back from it.
        expect(state.getPlayerState('dana').favor).toBe(before)
        expect(state.favorBank[Suit.Nomad]).toBe(0)
    })
})

describe('Hospitality only on the player’s own Travel', () => {
    it('the Shrouded Wood ruler’s pick lists no card and sends the Travel without Hospitality', async () => {
        const state = shroudedWoodState(2)
        state.getPlayerState('Dana').advisers.push({ cardId: HOSPITALITY, faceUp: true })
        const session = openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        session.chooseAction(ActionType.Travel)
        expect(session.shroudedWoodChooser).toBe('Rhys')
        expect(session.modifiers.listed).toEqual([])
        expect(session.travelRows).toEqual([])
        await session.travelFromShroudedWood()
        expect(sentTravel(sent).modifiers).toEqual([])
    })
})

describe('Hospitality and the powers list (R-7.4)', () => {
    it('lists no Use a power entry for Hospitality: its gain comes after the action', () => {
        expect(actionCards(scene(), 'dana').map((card) => card.cardId)).not.toContain(HOSPITALITY)
    })

    it('a destination offers the same Travel with Hospitality’s bank as without it', () => {
        const state = scene()
        expect(actionMenuRows(state, 'dana', ActionType.Travel, [hospitality])).toEqual(
            actionMenuRows(state, 'dana', ActionType.Travel, [])
        )
    })
})

describe('Hospitality’s banks on a player’s own view', () => {
    it('reads the same banks on the seat’s projected state as on the server’s', () => {
        const state = scene({}, { h3: [] })
        state.getPlayerState('rhys').advisers = [{ cardId: 'denizen.nomad.tents', faceUp: false }]
        const view = new HydratedOathGameState(served(state, { kind: 'player', playerId: 'dana' }))
        const read = (s: HydratedOathGameState) =>
            travelRows(s, 'dana', [hospitality]).map((row) => [row.slotId, banksOf(row.ways)])
        const own = read(view)
        expect(own).toEqual(read(state))
        expect(own).toContainEqual(['p1', [Suit.Beast, Suit.Nomad]])
    })

    it('judges each way’s bank after its toll on the seat’s projected state as on the server’s', () => {
        const state = kinship(1, { c2: [WAY_STATION], h3: [] })
        state.getPlayerState('rhys').advisers = [{ cardId: 'denizen.nomad.tents', faceUp: false }]
        const view = new HydratedOathGameState(served(state, { kind: 'player', playerId: 'dana' }))
        const read = (s: HydratedOathGameState) =>
            travelRows(s, 'dana', [hospitality]).map((row) => [row.slotId, tollsAndBanks(row.ways)])
        const own = read(view)
        expect(own).toEqual(read(state))
        expect(own).toContainEqual([
            'c2',
            [
                [[], Suit.Nomad],
                [[WAY_STATION], undefined]
            ]
        ])
    })
})

/** A row as the History reads it from the record. */
function recorded(fields: { type: ActionType; playerId?: string } & Record<string, unknown>): GameAction {
    return { id: 'a1', gameId: 'g1', source: ActionSource.User, ...fields }
}

describe('Hospitality’s gain in words', () => {
    const way = (hospitality?: Suit) => ({
        tolls: [],
        flipSecret: false,
        discountTolls: [],
        cost: 2,
        favorTo: [],
        modifiers: [],
        ...(hospitality ? { hospitality } : {})
    })

    it('the map chip reads the gold cost, then the gain with each bank’s suit', () => {
        expect(travelChip([way(Suit.Beast)])).toEqual({ ways: [{ cost: 2, favor: 0, secret: false }], banks: [Suit.Beast] })
        expect(travelChip([way(Suit.Beast), way(Suit.Nomad)])).toEqual({
            ways: [{ cost: 2, favor: 0, secret: false }],
            banks: [Suit.Beast, Suit.Nomad]
        })
        expect(travelChip([way()])).toEqual({ words: '2 Supply' })
        expect(chipWords({ ways: [{ cost: 2, favor: 0, secret: false }], banks: [Suit.Beast, Suit.Nomad] })).toBe(
            '2 Supply, gain 1 favor from the Beast or Nomad bank'
        )
    })

    it('a way’s accessible name adds the gain and its bank', () => {
        const row = { slotId: 'c2', region: Region.Cradle, cardId: 'c2', ways: [], modifiers: [] }
        const nameOf = (id: string) => id
        expect(travelSpoken(row, way(Suit.Beast), nameOf)).toMatch(/: spend 2 Supply, gain 1 favor from the Beast bank$/)
        expect(travelSpoken(row, way(), nameOf)).toMatch(/: spend 2 Supply$/)
    })

    it('the History names the gain, its bank, then the card', () => {
        const travel = recorded({
            type: ActionType.Travel,
            playerId: 'dana',
            siteId: 'c2',
            metadata: { supplySpent: 2, modifiers: [HOSPITALITY], modifierNotes: ['Hospitality: gained 1 favor from the beast bank'] }
        })
        const names = { player: (id: string) => id, site: () => 'Plains', seats: ['dana', 'rhys'] }
        expect(describeAction(travel, names)).toBe('traveled to Plains, spending 2 Supply; gained 1 favor from the Beast bank (Hospitality)')
    })
})
