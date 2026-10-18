import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import {
    ActionType,
    Banner,
    CURRENT_OATH_REVISION,
    FAVOR_BANK_ORDER,
    HydratedOathGameState,
    MachineState,
    OathRevision,
    OathVisibility,
    PlayerStatus,
    PowerTiming,
    SearchPlay,
    Suit,
    playMapChanges,
    powerIndexOf,
    type LegalChoice
} from '@tabletop/oath'
import { openTurn, required, served, testBanners, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import {
    bankRuns,
    emptyPicks,
    favorBankSuits,
    openRunBanks,
    withRunToggled,
    type PowerChoicePicks
} from './powerChoices.js'
import { whenPlayedBanks } from './whenPlayed.js'

// R-7.3.3: "Gain favor from playing to site, resolve Homeland site powers, and resolve modifiers before resolving
// this." Salad Days' picker shows each bank as the play leaves it, the banks the engine judges its picks on, and
// opens an empty bank only while fewer than three others hold favor (R-7.1.3).

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const SALAD = 'denizen.hearth.salad-days'
const WOLVES = 'denizen.beast.wolves'
const TUTOR = 'denizen.arcane.tutor'
const BIRDSONG = 'denizen.beast.birdsong'
const DISSENT = 'denizen.discord.dissent'
const VOW = 'denizen.nomad.vow-of-kinship'
const WELCOMING_PARTY = 'denizen.hearth.welcoming-party'
const BOOK = 'relic.book-of-records'
const LAND_WARDEN = 'denizen.hearth.land-warden'

const ALL = FAVOR_BANK_ORDER

const banksOf = (held: Partial<Record<Suit, number>>): Record<Suit, number> => ({
    [Suit.Discord]: held[Suit.Discord] ?? 0,
    [Suit.Arcane]: held[Suit.Arcane] ?? 0,
    [Suit.Order]: held[Suit.Order] ?? 0,
    [Suit.Hearth]: held[Suit.Hearth] ?? 0,
    [Suit.Beast]: held[Suit.Beast] ?? 0,
    [Suit.Nomad]: held[Suit.Nomad] ?? 0
})

/** Four banks hold favor once the play to the River takes the Hearth bank's last. */
const FOUR_LEFT = banksOf({ [Suit.Arcane]: 3, [Suit.Order]: 3, [Suit.Hearth]: 1, [Suit.Beast]: 3, [Suit.Nomad]: 2 })
/** Only Arcane and Order hold favor once the play takes the Hearth bank's last. */
const TWO_LEFT = banksOf({ [Suit.Arcane]: 3, [Suit.Order]: 3, [Suit.Hearth]: 1 })

const modifier = (cardId: string) => ({ cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Modifier) })

type Table = {
    banks: Record<Suit, number>
    revision?: OathRevision
    rhys?: Partial<Parameters<typeof testPlayer>[0]>
    over?: Record<string, unknown>
}

/** Rhys, an Exile at the River (not a Homeland), searching with Salad Days, Wolves and Tutor drawn; Dana the Chancellor. */
function table({ banks, revision = CURRENT_OATH_REVISION, rhys = {}, over = {} }: Table) {
    const state = testState(
        [
            testPlayer({ playerId: 'rhys', color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', favor: 2, secrets: 3, handIds: [SALAD, WOLVES, TUTOR], ...rhys }),
            testPlayer({ playerId: 'dana', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c2' })
        ],
        {
            machineState: MachineState.Searching,
            oathRevision: revision,
            chancellorPlayerId: 'dana',
            favorBank: { ...banks },
            siteCards: { c1: 'site.river', c2: 'site.plains', p1: 'site.mountain', h1: 'site.wastes' },
            denizensBySite: { c1: [BIRDSONG], c2: [], p1: [], h1: [] },
            ...over
        }
    )
    openTurn(state, 'rhys')
    return state
}

type Picker = {
    choices: LegalChoice[]
    banks: Readonly<Record<Suit, number>>
    tableBanks: Readonly<Record<Suit, number>>
    reasonFor: (suits: readonly Suit[]) => string | undefined
}

/** The banks the picker shows and opens, and the engine's answer to a complete pick, as the panel reads them. */
function pickerOf(choices: LegalChoice[], banks: Readonly<Record<Suit, number>>, tableBanks: Readonly<Record<Suit, number>>, judge: (picks: PowerChoicePicks) => string | undefined): Picker {
    return {
        choices,
        banks,
        tableBanks,
        reasonFor: (suits) => {
            const run = required(bankRuns(choices)[0], 'Salad Days asks a run of banks')
            return judge(suits.reduce((picks, suit) => withRunToggled(run, choices, picks, suit), emptyPicks()))
        }
    }
}

/** The banks still open after `named`, as the picker opens them on the banks it shows. */
function openAfter(picker: Picker, named: readonly Suit[]): Suit[] {
    const run = required(bankRuns(picker.choices)[0], 'Salad Days asks a run of banks')
    expect(run).toEqual({ specs: [0, 1, 2], distinct: true, total: 3 })
    const offered = favorBankSuits(required(picker.choices[0], 'the first pick').options)
    const open = openRunBanks(run, offered, named, picker.banks)
    // In the board's order, as the picker draws them.
    return FAVOR_BANK_ORDER.filter((suit) => open.includes(suit))
}

/** Every three banks the picker lets a player name, tapping only open banks in some order. */
function pickable(picker: Picker): string[] {
    const found = new Set<string>()
    const walk = (named: Suit[]) => {
        if (named.length === 3) found.add([...named].sort().join(','))
        else for (const suit of openAfter(picker, named)) walk([...named, suit])
    }
    walk([])
    return [...found].sort()
}

/** Every three different banks, by whether the engine accepts them. */
function accepted(picker: Picker): string[] {
    const found: string[] = []
    for (let a = 0; a < ALL.length; a++)
        for (let b = a + 1; b < ALL.length; b++)
            for (let c = b + 1; c < ALL.length; c++) {
                const suits = [ALL[a], ALL[b], ALL[c]].filter((suit): suit is Suit => suit !== undefined)
                if (picker.reasonFor(suits) === undefined) found.push([...suits].sort().join(','))
            }
    return found.sort()
}

/** The picker opens exactly the picks the engine accepts. */
function expectAgreement(picker: Picker) {
    const engine = accepted(picker)
    expect(engine.length).toBeGreaterThan(0)
    expect(pickable(picker)).toEqual(engine)
}

type Placement = { play: SearchPlay; faceUp?: boolean }

/** Salad Days kept from the Search and placed, as the Search panel shows its picker. */
async function searching(state: HydratedOathGameState, placement: Placement = { play: SearchPlay.Site }, before: (draft: Awaited<ReturnType<typeof openSessionOn>>['search']) => void = () => {}) {
    const session = await openSessionOn(tableOf(state))
    vi.spyOn(session, 'resolveSearch').mockResolvedValue()
    const draft = session.search
    draft.keep(SALAD)
    before(draft)
    await draft.choosePlacement(placement)
    expect(draft.needsWhenPlayed).toBe(true)
    return pickerOf(draft.whenPlayed, draft.whenPlayedBanks, session.gameState.favorBank, (picks) => {
        draft.setPicks(picks)
        return draft.whenPlayedReason
    })
}

/** Salad Days held as a facedown adviser and played faceup to the site (R-6.1), as its panel shows the picker. */
async function flipping(state: HydratedOathGameState) {
    const session = await openSessionOn(tableOf(state))
    vi.spyOn(session, 'applyAction').mockResolvedValue()
    session.chooseAction(ActionType.PlayFacedownAdviser)
    await session.chooseAdviserPlay(SALAD, SearchPlay.Site)
    expect(session.adviserPlayChoices).toHaveLength(3)
    return pickerOf(session.adviserPlayChoices, session.adviserPlayBanks, session.gameState.favorBank, (picks) => {
        session.setAdviserPlayPicks(picks)
        return session.adviserPlayReason
    })
}

describe('Salad Days played to the site: the picker shows each bank as the play leaves it (R-7.3.3, R-7.1.3)', () => {
    it('Hearth 1 and four other banks holding: the Hearth bank shows 0 and is shut; the table keeps its 1', async () => {
        const picker = await searching(table({ banks: FOUR_LEFT }))
        expect(picker.banks).toEqual({ ...FOUR_LEFT, [Suit.Hearth]: 0 })
        expect(picker.tableBanks[Suit.Hearth]).toBe(1)
        expect(openAfter(picker, [])).toEqual([Suit.Arcane, Suit.Order, Suit.Beast, Suit.Nomad])
        expect(openAfter(picker, [Suit.Arcane, Suit.Order])).toEqual([Suit.Beast, Suit.Nomad])
        // Brief 121's case: Hearth, Arcane, Order yields 2 of 3 once played, so the engine refuses it.
        expect(picker.reasonFor([Suit.Hearth, Suit.Arcane, Suit.Order])).toMatch(/the banks named yield 2, and 3 can be had/)
        expect(picker.reasonFor([Suit.Arcane, Suit.Order, Suit.Beast])).toBeUndefined()
        expectAgreement(picker)
    })

    it('Hearth 1, Arcane 3, Order 3: only two banks hold favor after the play, so any bank may be the third', async () => {
        const picker = await searching(table({ banks: TWO_LEFT }))
        expect(picker.banks).toEqual({ ...TWO_LEFT, [Suit.Hearth]: 0 })
        expect(openAfter(picker, [])).toEqual(ALL)
        expect(openAfter(picker, [Suit.Arcane, Suit.Order])).toEqual([Suit.Discord, Suit.Hearth, Suit.Beast, Suit.Nomad])
        // Brief 121's case: Arcane, Order, Beast is accepted once played.
        expect(picker.reasonFor([Suit.Arcane, Suit.Order, Suit.Beast])).toBeUndefined()
        expectAgreement(picker)
    })

    it('an adviser play gains nothing first: the picker shows the table’s banks', async () => {
        const picker = await searching(table({ banks: FOUR_LEFT }), { play: SearchPlay.Adviser, faceUp: true })
        expect(picker.banks).toEqual(FOUR_LEFT)
        expect(openAfter(picker, [])).toEqual([Suit.Arcane, Suit.Order, Suit.Hearth, Suit.Beast, Suit.Nomad])
        expectAgreement(picker)
    })

    it('R-X.4 — before revision 16 the engine judges the banks before the play, and the picker shows those', async () => {
        for (const banks of [FOUR_LEFT, TWO_LEFT]) {
            const picker = await searching(table({ banks, revision: OathRevision.EngineFixes11 }))
            expect(picker.banks).toEqual(banks)
            expectAgreement(picker)
        }
        const two = await searching(table({ banks: TWO_LEFT, revision: OathRevision.EngineFixes11 }))
        expect(openAfter(two, [])).toEqual([Suit.Arcane, Suit.Order, Suit.Hearth])
    })
})

describe('Salad Days’ picker beside the cards that change what the play gains first', () => {
    it('Book of Records carried: the site play gains a secret, not favor, so the Hearth bank keeps its 1', async () => {
        const picker = await searching(
            table({ banks: TWO_LEFT, rhys: { relicIds: [BOOK] }, over: { pendingSearchModifiers: [modifier(BOOK)] } })
        )
        expect(picker.banks).toEqual(TWO_LEFT)
        expect(openAfter(picker, [Suit.Arcane, Suit.Order])).toEqual([Suit.Hearth])
        expectAgreement(picker)
    })

    it('Vow of Kinship: the Hearth favor the play takes goes to the Nomad bank', async () => {
        const picker = await searching(table({ banks: TWO_LEFT, rhys: { advisers: [{ cardId: VOW, faceUp: true }] } }))
        expect(picker.banks).toEqual({ ...TWO_LEFT, [Suit.Hearth]: 0, [Suit.Nomad]: 1 })
        expect(openAfter(picker, [Suit.Arcane, Suit.Order])).toEqual([Suit.Nomad])
        expectAgreement(picker)
    })

    it('Fertile Valley, the Hearth Homeland: its favor leaves the Hearth bank too', async () => {
        const banks = { ...TWO_LEFT, [Suit.Hearth]: 2 }
        const picker = await searching(table({ banks, over: { siteCards: { c1: 'site.fertile-valley', c2: 'site.plains', p1: 'site.mountain', h1: 'site.wastes' } } }))
        expect(picker.banks).toEqual({ ...banks, [Suit.Hearth]: 0 })
        expectAgreement(picker)
    })

    it("Dissent discarded first by the People's Favor: its favor is back in the Discord bank", async () => {
        const state = table({ banks: TWO_LEFT, over: { banners: testBanners({ [Banner.PeoplesFavor]: 'rhys' }) } })
        state.denizensBySite['c1'] = [DISSENT]
        state.addTokensOn(DISSENT, { favor: 2 })
        const picker = await searching(state, { play: SearchPlay.Site }, (draft) => {
            draft.setDiscardFirst(DISSENT)
            expect(draft.discardFirst).toBe(DISSENT)
        })
        expect(picker.banks).toEqual({ ...TWO_LEFT, [Suit.Hearth]: 0, [Suit.Discord]: 2 })
        expect(openAfter(picker, [Suit.Arcane, Suit.Order])).toEqual([Suit.Discord])
        expectAgreement(picker)
    })

    it('a facedown Salad Days played faceup to the site (R-6.1): the same banks as from the Search', async () => {
        const picker = await flipping(
            table({ banks: FOUR_LEFT, rhys: { handIds: [], advisers: [{ cardId: SALAD, faceUp: false }] }, over: { machineState: MachineState.ActPhase } })
        )
        expect(picker.banks).toEqual({ ...FOUR_LEFT, [Suit.Hearth]: 0 })
        expect(picker.tableBanks[Suit.Hearth]).toBe(1)
        expectAgreement(picker)
    })

    it('Land Warden: the second card plays after Salad Days, so its site favor is not taken first', async () => {
        const state = table({ banks: FOUR_LEFT, over: { pendingSearchModifiers: [modifier(LAND_WARDEN)], denizensBySite: { c1: [], c2: [], p1: [], h1: [] } } })
        const picker = await searching(state, { play: SearchPlay.Site }, (draft) => {
            draft.setSecondPlay(draft.secondPlays.find((option) => option.cardId === WOLVES && option.play === SearchPlay.Site)?.key)
            expect(draft.second).toMatchObject({ cardId: WOLVES, play: SearchPlay.Site })
        })
        expect(picker.banks).toEqual({ ...FOUR_LEFT, [Suit.Hearth]: 0 })
        expectAgreement(picker)
    })

    // Welcoming Party gains its Hearth favor once the play is done, after the When Played power: the engine's plan
    // does not take it first, and neither does the picker.
    it('Welcoming Party: its Hearth favor comes after the power, so only the site’s is taken first', async () => {
        const banks = { ...TWO_LEFT, [Suit.Hearth]: 2 }
        const picker = await searching(table({ banks, rhys: { advisers: [{ cardId: WELCOMING_PARTY, faceUp: true }] } }))
        expect(picker.banks).toEqual({ ...banks, [Suit.Hearth]: 1 })
        expectAgreement(picker)
    })
})

describe("the banks the picker reads on the player's own view", () => {
    it('are the server’s, and nothing hidden is read', () => {
        const state = table({ banks: FOUR_LEFT })
        const me: Visibility.Perspective = { kind: 'player', playerId: 'rhys' }
        const own = OathVisibility.state.guardForExecution(new HydratedOathGameState(served(state, me)), me)
        for (const view of [state, own]) {
            expect(whenPlayedBanks(view, playMapChanges(view, 'rhys', SALAD, SearchPlay.Site))).toEqual({ ...FOUR_LEFT, [Suit.Hearth]: 0 })
        }
        expect(state.favorBank).toEqual(FOUR_LEFT)
    })
})
