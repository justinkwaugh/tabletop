import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import {
    ActionType,
    Banner,
    ConsentRequestKind,
    MachineState,
    PlayerStatus,
    PowerChoiceKind,
    PowerTiming,
    Suit,
    allPowersWithTiming,
    FAVOR_BANK_ORDER,
    OathRevision,
    powerIndexOf,
    powerKey,
    legalChoices,
    one,
    type HydratedOathGameState,
    HydratedUseRestPower,
    type LegalPowerUse
} from '@tabletop/oath'
import { openTurn, required, testBanners, testPlayer, testState } from '@tabletop/oath/testing'
import { NO_OPTION, emptyPicks, warbandGrids, withGridCount } from './powerChoices.js'
import { bargainRows, shownBargainPicks, withBargainCount, withBargainPlayer, type BargainPick } from './bargainPicks.js'
import { withCount, withFrom, withTo, type MovePick } from './powerMoves.js'
import { restBankChoice, restRows } from './restRows.js'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { IMPERIAL_WARBANDS } from '@tabletop/oath'
import { GameSession } from '@tabletop/frontend-components'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const ME = 'me'
const CHANCELLOR = 'chancellor'
const OBEDIENCE = 'denizen.order.vow-of-obedience'
const SILVER_TONGUE = 'denizen.discord.silver-tongue'
const INSOMNIA = 'denizen.discord.insomnia'
const POVERTY = 'denizen.beast.vow-of-poverty'
const INN = 'denizen.hearth.wayside-inn'
const OAK = 'denizen.beast.the-old-oak'
const SNARE = 'denizen.arcane.spirit-snare'
const WITCHS_BARGAIN = 'denizen.arcane.witchs-bargain'

function table(
    machineState: MachineState,
    me: Parameters<typeof testPlayer>[0] = {},
    over = {},
    others: ReturnType<typeof testPlayer>[] = []
) {
    const state = testState(
        [
            testPlayer({
                playerId: ME,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 5,
                warbandsOnBoard: { [ME]: 2 },
                ...me
            }),
            testPlayer({
                playerId: CHANCELLOR,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                favor: 4,
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 1 }
            }),
            ...others
        ],
        {
            machineState,
            chancellorPlayerId: CHANCELLOR,
            denizensBySite: { c1: [INN, OAK], c2: [], h1: [] },
            warbandsBySite: { c1: { [ME]: 1 } },
            siteCards: { c1: 'site.mine', c2: 'site.river', h1: 'site.wastes' },
            ...over
        }
    )
    openTurn(state, ME)
    state.turnManager.turnOrder = [ME, CHANCELLOR]
    return state
}

async function opened(state: HydratedOathGameState) {
    return await openSessionOn(tableOf(state))
}

/** R-4.1.1 to R-4.1.4 — one Wake choice at a time; every tap acts, and the last one sends the Wake. */
describe('the Wake draft (docs/user-interactions.md)', () => {
    const BANKS = { arcane: 2, beast: 2, discord: 1, hearth: 2, nomad: 2, order: 2 }
    const waking = async (
        peoplesFavor: { value: number; mobSide: boolean } | undefined,
        over: Record<string, unknown> = {},
        me: Parameters<typeof testPlayer>[0] = {}
    ) => {
        const session = await opened(
            table(MachineState.WakePhase, me, {
                banners: {
                    ...testBanners(),
                    ...(peoplesFavor
                        ? { [Banner.PeoplesFavor]: { ...peoplesFavor, holderPlayerId: ME } }
                        : {})
                },
                favorBank: BANKS,
                ...over
            })
        )
        const sent = vi.spyOn(session, 'resolveWake').mockResolvedValue()
        return { session, wake: session.wake, sent }
    }
    const SITE_TOKENS = { cardTokens: { 'site.mine': { favor: 1, secrets: 0 } } }

    it('nothing is picked before a tap: the step asks Place or Return', async () => {
        const { wake, sent } = await waking({ value: 3, mobSide: false })
        expect(wake.question).toEqual({ kind: 'favorStep', index: 0, options: ['place', 'return'] })
        expect(wake.answeredLines).toEqual([])
        expect(wake.hasManualSelection()).toBe(false)
        expect(wake.readyToEnd).toBe(false)
        expect(sent).not.toHaveBeenCalled()
    })

    it('one step: a tap on Place sends the Wake at once', async () => {
        const { wake, sent } = await waking({ value: 3, mobSide: false })
        await wake.chooseKind('place')
        expect(sent).toHaveBeenCalledExactlyOnceWith([{ kind: 'place' }], undefined)
    })

    it('two steps on the Mob side: the first tap moves to step 2 of 2 and sends nothing; the second sends both', async () => {
        const { wake, sent } = await waking({ value: 3, mobSide: true })
        expect(wake.stepCount).toBe(2)
        await wake.chooseKind('place')
        expect(sent).not.toHaveBeenCalled()
        expect(wake.question).toEqual({ kind: 'favorStep', index: 1, options: ['place', 'return'] })
        expect(wake.answeredLines).toEqual(['Placed 1 favor.'])
        await wake.chooseKind('return')
        expect(sent).toHaveBeenCalledExactlyOnceWith(
            [{ kind: 'place' }, { kind: 'return', toSuit: Suit.Discord }],
            undefined
        )
    })

    it('Return with banks tied for the least favor waits for the bank’s tap, which acts', async () => {
        const { wake, sent } = await waking({ value: 3, mobSide: false }, { favorBank: { ...BANKS, order: 1 } })
        await wake.chooseKind('return')
        expect(sent).not.toHaveBeenCalled()
        expect(wake.question).toEqual({
            kind: 'returnBank',
            index: 0,
            banks: [Suit.Discord, Suit.Order],
            counts: { ...BANKS, order: 1 }
        })
        await wake.chooseBank(Suit.Order)
        expect(sent).toHaveBeenCalledExactlyOnceWith([{ kind: 'return', toSuit: Suit.Order }], undefined)
    })

    it("R-4.1.1-H1 — the second return's tied banks follow the first return", async () => {
        const { wake, sent } = await waking(
            { value: 4, mobSide: true },
            { favorBank: { discord: 0, arcane: 1, order: 2, hearth: 2, beast: 2, nomad: 2 } }
        )
        await wake.chooseKind('return')
        expect(wake.answeredLines).toEqual(['Returned 1 favor to the Discord bank.'])
        await wake.chooseKind('return')
        expect(wake.question).toEqual({
            kind: 'returnBank',
            index: 1,
            banks: [Suit.Discord, Suit.Arcane],
            counts: { discord: 1, arcane: 1, order: 2, hearth: 2, beast: 2, nomad: 2 }
        })
        await wake.chooseBank(Suit.Arcane)
        expect(sent).toHaveBeenCalledExactlyOnceWith(
            [
                { kind: 'return', toSuit: Suit.Discord },
                { kind: 'return', toSuit: Suit.Arcane }
            ],
            undefined
        )
    })

    /** R-4.1.1-H1 — the bank picker counts each bank as the steps before it leave it, as its banks are judged. */
    describe('the counts beside the banks asked', () => {
        const banksAsked = (wake: Awaited<ReturnType<typeof waking>>['wake']) => {
            const question = wake.question
            if (question?.kind !== 'returnBank') throw new Error('no bank is asked')
            return question
        }
        // Each bank offered shows the least count, and no bank shows less.
        const offeredAtLeast = (question: { banks: Suit[]; counts: Record<Suit, number> }) => {
            const least = Math.min(...Object.values(question.counts))
            expect(question.banks.map((suit) => question.counts[suit])).toEqual(
                question.banks.map(() => least)
            )
            expect(FAVOR_BANK_ORDER.filter((suit) => question.counts[suit] === least).sort()).toEqual(
                [...question.banks].sort()
            )
        }
        const AFTER_ORDER = { arcane: 1, beast: 2, discord: 1, hearth: 3, nomad: 2, order: 0 }

        it('Return twice: step 2 counts the bank step 1 returned to', async () => {
            const { wake, sent } = await waking({ value: 3, mobSide: true }, { favorBank: AFTER_ORDER })
            await wake.chooseKind('return')
            expect(wake.answeredLines).toEqual(['Returned 1 favor to the Order bank.'])
            await wake.chooseKind('return')
            const asked = banksAsked(wake)
            expect(asked.index).toBe(1)
            expect(asked.counts).toEqual({ ...AFTER_ORDER, order: 1 })
            expect([...asked.banks].sort()).toEqual([Suit.Arcane, Suit.Discord, Suit.Order].sort())
            offeredAtLeast(asked)
            await wake.chooseBank(Suit.Order)
            expect(sent).toHaveBeenCalledExactlyOnceWith(
                [
                    { kind: 'return', toSuit: Suit.Order },
                    { kind: 'return', toSuit: Suit.Order }
                ],
                undefined
            )
        })

        it('one step: the banks asked are counted as the table shows them', async () => {
            const { wake } = await waking({ value: 3, mobSide: false }, { favorBank: { ...BANKS, order: 1 } })
            await wake.chooseKind('return')
            const asked = banksAsked(wake)
            expect(asked.counts).toEqual({ ...BANKS, order: 1 })
            offeredAtLeast(asked)
        })

        it('Place, then Return: a favor placed from the board leaves the banks as they are', async () => {
            const { wake } = await waking({ value: 3, mobSide: true }, { favorBank: { ...BANKS, order: 1 } })
            await wake.chooseKind('place')
            await wake.chooseKind('return')
            const asked = banksAsked(wake)
            expect(asked.index).toBe(1)
            expect(asked.counts).toEqual({ ...BANKS, order: 1 })
            offeredAtLeast(asked)
        })

        it('Vow of Kinship: a favor placed from the Nomad bank is counted off it on step 2', async () => {
            const banks = { arcane: 1, beast: 2, discord: 2, hearth: 2, nomad: 2, order: 2 }
            const { wake, sent } = await waking(
                { value: 3, mobSide: true },
                { favorBank: banks },
                { favor: 0, advisers: [{ cardId: 'denizen.nomad.vow-of-kinship', faceUp: true }] }
            )
            expect(wake.question).toEqual({ kind: 'favorStep', index: 0, options: ['place', 'return'] })
            await wake.chooseKind('place')
            await wake.chooseKind('return')
            const asked = banksAsked(wake)
            expect(asked.counts).toEqual({ ...banks, nomad: 1 })
            expect([...asked.banks].sort()).toEqual([Suit.Arcane, Suit.Nomad].sort())
            offeredAtLeast(asked)
            await wake.chooseBank(Suit.Nomad)
            expect(sent).toHaveBeenCalledExactlyOnceWith(
                [{ kind: 'place' }, { kind: 'return', toSuit: Suit.Nomad }],
                undefined
            )
        })

        it('Return, then Place: step 2 asks no bank, and the Wake sends both', async () => {
            const { wake, sent } = await waking({ value: 3, mobSide: true }, { favorBank: AFTER_ORDER })
            await wake.chooseKind('return')
            expect(wake.question).toEqual({ kind: 'favorStep', index: 1, options: ['place', 'return'] })
            await wake.chooseKind('place')
            expect(sent).toHaveBeenCalledExactlyOnceWith(
                [{ kind: 'return', toSuit: Suit.Order }, { kind: 'place' }],
                undefined
            )
        })

        it('Undo between the steps counts the banks as the table shows them again', async () => {
            vi.spyOn(GameSession.prototype, 'undo').mockResolvedValue()
            const tied = { ...AFTER_ORDER, arcane: 0, discord: 0 }
            const { session, wake } = await waking({ value: 3, mobSide: true }, { favorBank: tied })
            await wake.chooseKind('return')
            expect(banksAsked(wake).counts).toEqual(tied)
            await wake.chooseBank(Suit.Order)
            await wake.chooseKind('return')
            expect(banksAsked(wake).counts).toEqual({ ...tied, order: 1 })
            await session.undo()
            await session.undo()
            const again = banksAsked(wake)
            expect(again.index).toBe(0)
            expect(again.counts).toEqual(tied)
            expect([...again.banks].sort()).toEqual([Suit.Arcane, Suit.Discord, Suit.Order].sort())
            await wake.chooseBank(Suit.Discord)
            await wake.chooseKind('return')
            expect(banksAsked(wake).counts).toEqual({ ...tied, discord: 1 })
        })
    })

    it('after the People’s Favor, the site asks its take, and that tap sends the Wake with it', async () => {
        const { wake, sent } = await waking({ value: 3, mobSide: false }, SITE_TOKENS)
        await wake.chooseKind('place')
        expect(sent).not.toHaveBeenCalled()
        expect(wake.question).toEqual({ kind: 'siteTake', takes: ['favor'] })
        await wake.chooseSiteTake('favor')
        expect(sent).toHaveBeenCalledExactlyOnceWith([{ kind: 'place' }], 'favor')
    })

    it('the site only: Take nothing sends the Wake without a take', async () => {
        const { wake, sent } = await waking(undefined, SITE_TOKENS)
        expect(wake.question).toEqual({ kind: 'siteTake', takes: ['favor'] })
        await wake.chooseSiteTake(undefined)
        expect(sent).toHaveBeenCalledExactlyOnceWith([], undefined)
    })

    it('nothing to choose: a forced step is its line, and End Wake Phase sends it', async () => {
        const { wake, sent } = await waking({ value: 1, mobSide: false })
        expect(wake.question).toBeUndefined()
        expect(wake.answeredLines).toEqual(['Placed 1 favor.'])
        expect(wake.readyToEnd).toBe(true)
        expect(wake.hasManualSelection()).toBe(false)
        await wake.end()
        expect(sent).toHaveBeenCalledExactlyOnceWith([{ kind: 'place' }], undefined)
    })

    it('Undo before the send takes back the last pick only, and no action', async () => {
        const historyUndo = vi.spyOn(GameSession.prototype, 'undo').mockResolvedValue()
        const { session, wake, sent } = await waking({ value: 3, mobSide: true }, SITE_TOKENS)
        await wake.chooseKind('place')
        await wake.chooseKind('place')
        expect(wake.question).toEqual({ kind: 'siteTake', takes: ['favor'] })
        await session.undo()
        expect(wake.question).toEqual({ kind: 'favorStep', index: 1, options: ['place', 'return'] })
        expect(wake.answeredLines).toEqual(['Placed 1 favor.'])
        await session.undo()
        expect(wake.question).toEqual({ kind: 'favorStep', index: 0, options: ['place', 'return'] })
        expect(wake.hasManualSelection()).toBe(false)
        expect(historyUndo).not.toHaveBeenCalled()
        expect(sent).not.toHaveBeenCalled()
    })

    it('Undo after Return takes back the Return before its bank', async () => {
        const { session, wake } = await waking({ value: 3, mobSide: false }, { favorBank: { ...BANKS, order: 1 } })
        await wake.chooseKind('return')
        await session.undo()
        expect(wake.question).toEqual({ kind: 'favorStep', index: 0, options: ['place', 'return'] })
    })

    it('while a bank is asked, a bank not tied for the least and a kind are never picked', async () => {
        const { wake, sent } = await waking({ value: 3, mobSide: false }, { favorBank: { ...BANKS, order: 1 } })
        await wake.chooseKind('return')
        const asked = {
            kind: 'returnBank',
            index: 0,
            banks: [Suit.Discord, Suit.Order],
            counts: { ...BANKS, order: 1 }
        }
        await wake.chooseBank(Suit.Arcane)
        expect(wake.question).toEqual(asked)
        await wake.chooseKind('place')
        expect(wake.question).toEqual(asked)
        expect(sent).not.toHaveBeenCalled()
        expect(wake.hasManualSelection()).toBe(true)
        expect(wake.back()).toBe(true)
        expect(wake.hasManualSelection()).toBe(false)
    })
})

/** R-4.3.5 — each Rest power's bank, one entry for all of them. */
describe('the Rest draft (docs/user-interactions.md)', () => {
    const resting = async () =>
        (await opened(
            table(MachineState.RestPhase, {
                advisers: [
                    { cardId: OBEDIENCE, faceUp: true },
                    { cardId: SILVER_TONGUE, faceUp: true }
                ]
            })
        )).rest
    const power = (draft: Awaited<ReturnType<typeof resting>>, cardId: string) =>
        required(draft.powers.find((p) => p.cardId === cardId), `${cardId} offered at Rest`)

    it('a bank for one power keeps the bank chosen for the other', async () => {
        const rest = await resting()
        rest.pickBank(power(rest, OBEDIENCE), Suit.Arcane)
        rest.pickBank(power(rest, SILVER_TONGUE), Suit.Beast)
        expect(rest.pickedSuit(power(rest, OBEDIENCE))).toBe(Suit.Arcane)
        expect(rest.pickedSuit(power(rest, SILVER_TONGUE))).toBe(Suit.Beast)
    })

    it('Undo clears every bank at once', async () => {
        const rest = await resting()
        rest.pickBank(power(rest, SILVER_TONGUE), Suit.Beast)
        expect(rest.back()).toBe(true)
        expect(rest.hasManualSelection()).toBe(false)
        expect(rest.back()).toBe(false)
    })

    it('no bank is picked before a tap, so Use waits for one', async () => {
        const rest = await resting()
        expect(rest.pickedSuit(power(rest, OBEDIENCE))).toBeUndefined()
        expect(rest.bankPicked(power(rest, OBEDIENCE))).toBe(false)
        expect(rest.hasManualSelection()).toBe(false)
        rest.pickBank(power(rest, OBEDIENCE), Suit.Arcane)
        expect(rest.bankPicked(power(rest, OBEDIENCE))).toBe(true)
    })

    it('a bank the power does not offer is never picked', async () => {
        const rest = await resting()
        rest.pickBank(power(rest, SILVER_TONGUE), Suit.Arcane)
        expect(rest.hasManualSelection()).toBe(false)
    })

    it('picking a power’s bank again replaces it', async () => {
        const rest = await resting()
        rest.pickBank(power(rest, SILVER_TONGUE), Suit.Beast)
        rest.pickBank(power(rest, SILVER_TONGUE), Suit.Hearth)
        expect(rest.pickedSuit(power(rest, SILVER_TONGUE))).toBe(Suit.Hearth)
    })

    it('lists only the powers the engine accepts: Vow of Poverty is left out while its holder has favor', async () => {
        const withPoverty = async (favor: number) =>
            (await opened(
                table(MachineState.RestPhase, {
                    favor,
                    advisers: [
                        { cardId: OBEDIENCE, faceUp: true },
                        { cardId: POVERTY, faceUp: true }
                    ]
                })
            )).rest
        expect((await withPoverty(3)).powers.map((p) => p.cardId).sort()).toEqual([OBEDIENCE, POVERTY].sort())
        expect((await withPoverty(3)).usablePowers.map((p) => p.cardId)).toEqual([OBEDIENCE])
        expect((await withPoverty(0)).usablePowers.map((p) => p.cardId).sort()).toEqual([OBEDIENCE, POVERTY].sort())
    })
})

/** Visual contract scenario 33 — what the Rest panel does not offer. */
describe('a Rest power whose choice the panel does not offer', () => {
    const NOT_OFFERED = 'this power asks a choice this panel does not offer'

    it('is refused with that reason, while a bank-only power is not', async () => {
        const rest = (await opened(
            table(MachineState.RestPhase, { advisers: [{ cardId: OBEDIENCE, faceUp: true }] })
        )).rest
        const offered = required(
            rest.powers.find((p) => p.cardId === OBEDIENCE),
            'Vow of Obedience offered at Rest'
        )
        const asksForAPlayer: LegalPowerUse = {
            ...offered,
            choices: [
                {
                    spec: one(PowerChoiceKind.Player),
                    options: [{ kind: PowerChoiceKind.Player, playerId: CHANCELLOR }]
                }
            ]
        }
        expect(rest.reasonCannotUse(asksForAPlayer)).toBe(NOT_OFFERED)
        expect(rest.reasonCannotUse(offered)).not.toBe(NOT_OFFERED)
    })

    it('is never reached in play: every Rest power in the card set asks at most a favor bank', () => {
        const state = table(MachineState.RestPhase)
        const restPowers = allPowersWithTiming(PowerTiming.Rest)
        expect(restPowers.map((p) => p.cardId)).toEqual(
            expect.arrayContaining([OBEDIENCE, SILVER_TONGUE])
        )
        const asked = restPowers.flatMap((p) =>
            legalChoices(state, ME, p).map((choice) => choice.spec.kind)
        )
        expect(asked.filter((kind) => kind !== PowerChoiceKind.FavorBank)).toEqual([])
    })
})

/** R-6.2 — each Action power's picks, one entry for all of them. */
describe('the Action powers draft (docs/user-interactions.md)', () => {
    const usingIn = async () => {
        const session = await opened(table(MachineState.ActPhase, {}, { denizensBySite: { c1: [INN, SNARE], c2: [], h1: [] } }))
        session.chooseAction(ActionType.UseActionPower)
        return session
    }
    const using = async () => (await usingIn()).actionPowers
    const INN_USE = { cardId: INN, powerIndex: 0 }
    const SNARE_USE = { cardId: SNARE, powerIndex: 0 }
    const ticked = { ...emptyPicks(), count: [1] }

    it('picks for one power keep the picks for the other', async () => {
        const draft = await using()
        expect(draft.powers.map((p) => p.cardId).sort()).toEqual([SNARE, INN].sort())
        draft.setPicks(INN_USE, ticked)
        draft.setPicks(SNARE_USE, ticked)
        expect(draft.picksOf(INN_USE)).toEqual(ticked)
        expect(draft.picksOf(SNARE_USE)).toEqual(ticked)
    })

    it('Undo takes back the last pick, one at a time, whichever power it was for', async () => {
        const draft = await using()
        const second = { ...emptyPicks(), count: [2] }
        draft.setPicks(INN_USE, ticked)
        draft.setPicks(SNARE_USE, ticked)
        draft.setPicks(INN_USE, second)
        // A pick that changes nothing is none.
        draft.setPicks(INN_USE, second)
        expect(draft.back()).toBe(true)
        expect(draft.picksOf(INN_USE)).toEqual(ticked)
        expect(draft.picksOf(SNARE_USE)).toEqual(ticked)
        expect(draft.back()).toBe(true)
        expect(draft.picksOf(SNARE_USE)).toEqual(emptyPicks())
        expect(draft.back()).toBe(true)
        expect(draft.picksOf(INN_USE)).toEqual(emptyPicks())
        expect(draft.hasManualSelection()).toBe(false)
        expect(draft.back()).toBe(false)
    })

    it('before any pick there is nothing for Undo to take', async () => {
        expect((await using()).hasManualSelection()).toBe(false)
    })

    it('a count, a list or an option taken back to nothing is no pick: Undo landing there leaves the picks at once', async () => {
        const nothing = [
            { ...emptyPicks(), count: { 0: 0 } },
            { ...emptyPicks(), several: { 0: [] } },
            { ...emptyPicks(), option: { 0: NO_OPTION } },
            { ...emptyPicks(), bargain: { 0: [] } }
        ]
        for (const left of nothing) {
            const draft = await using()
            draft.setPicks(INN_USE, ticked)
            draft.setPicks(INN_USE, left)
            draft.setPicks(INN_USE, { ...emptyPicks(), count: { 0: 2 } })
            // Back past the last pick: nothing stands picked, so the picks are left.
            expect(draft.back()).toBe(true)
            expect(draft.hasManualSelection()).toBe(false)
            expect(draft.back()).toBe(false)
        }
    })

    it('a power not in reach is never given picks', async () => {
        const draft = await using()
        draft.setPicks({ cardId: OBEDIENCE, powerIndex: 0 }, ticked)
        expect(draft.hasManualSelection()).toBe(false)
    })

    it("a refusal names the other seat, not their id, and the reader reads “you”", async () => {
        const STEVE = 'Qx7_pL2mWb9-Rk4tYc1nZ'
        const BARGAIN = { cardId: WITCHS_BARGAIN, powerIndex: 0 }
        const session = await opened(
            table(MachineState.ActPhase, {}, { denizensBySite: { c1: [WITCHS_BARGAIN], c2: [], h1: [] } }, [
                testPlayer({ playerId: STEVE, color: Color.Blue, status: PlayerStatus.Citizen, siteId: 'c1', favor: 0 })
            ])
        )
        vi.spyOn(session, 'getPlayerName').mockImplementation((id) => (id === STEVE ? 'Steve' : 'Alice'))
        session.chooseAction(ActionType.UseActionPower)
        session.actionPowers.setPicks(BARGAIN, { ...emptyPicks(), count: { 1: 1, 2: 0 } })
        const power = required(session.actionPowers.powers.find((p) => p.cardId === WITCHS_BARGAIN), 'Witch\'s Bargain is offered')
        expect(session.humanizeReason(session.actionPowers.reasonCannotUse(power))).toBe(
            'Steve has 0 favor, not the 2 you would take'
        )
    })

    it('a power’s choice of several banks starts with none picked; "Use" waits for the pick', async () => {
        const draft = await using()
        const snare = required(draft.powers.find((p) => p.cardId === SNARE), 'Spirit Snare is offered')
        expect(draft.picksComplete(snare)).toBe(false)
        expect(draft.choicesFor(snare)).toEqual([])
        draft.setPicks(SNARE_USE, { ...emptyPicks(), option: { 0: 2 } })
        expect(draft.picksComplete(snare)).toBe(true)
        expect(draft.choicesFor(snare)).toEqual([snare.choices[0].options[2]])
        expect(draft.reasonCannotUse(snare)).toBeUndefined()
    })

    it('choosing another action ends its picks', async () => {
        const session = await usingIn()
        session.actionPowers.setPicks(INN_USE, ticked)
        session.chooseAction(ActionType.Travel)
        session.chooseAction(ActionType.UseActionPower)
        expect(session.actionPowers.picksOf(INN_USE)).toEqual(emptyPicks())
    })
})

/** Witch's Bargain from revision 7: the players at your site as chips, two rows of your pieces each. */
describe("Witch's Bargain's picks (revision 7)", () => {
    const BARGAIN = { cardId: WITCHS_BARGAIN, powerIndex: 0 }
    const SILENCE = 'denizen.arcane.vow-of-silence'
    // The seat holds 5 favor and 3 secrets; Rhys 4 and 2, Ann 1 and 1, all at c1 unless Ann is elsewhere.
    const bargaining = async (advisers: string[] = [], annSite = 'c1') => {
        const session = await opened(
            table(
                MachineState.ActPhase,
                { favor: 5, secrets: 3, advisers: advisers.map((cardId) => ({ cardId, faceUp: true })) },
                { denizensBySite: { c1: [WITCHS_BARGAIN], c2: [], h1: [] }, oathRevision: OathRevision.EngineFixes3 },
                [
                    testPlayer({ playerId: 'rhys', color: Color.Blue, status: PlayerStatus.Exile, siteId: 'c1', favor: 4, secrets: 2 }),
                    testPlayer({ playerId: 'ann', color: Color.Yellow, status: PlayerStatus.Exile, siteId: annSite, favor: 1, secrets: 1 })
                ]
            )
        )
        session.chooseAction(ActionType.UseActionPower)
        const draft = session.actionPowers
        const power = required(draft.powers.find((p) => p.cardId === WITCHS_BARGAIN), "Witch's Bargain is offered")
        const pick = (bargain: BargainPick[]) => draft.setPicks(BARGAIN, { ...emptyPicks(), bargain: { 0: bargain } })
        const picked = () => draft.picksOf(BARGAIN).bargain[0] ?? []
        const legal = power.choices[0]
        return { session, draft, power, pick, picked, legal }
    }

    it('offers the players at your site; the rows wait for a pick, and Use for a count', async () => {
        const { session, draft, power, pick, picked, legal } = await bargaining()
        expect(power.choices.map((c) => c.spec.kind)).toEqual([PowerChoiceKind.Bargain])
        expect(power.choices[0].options.map((o) => (o.kind === PowerChoiceKind.Bargain ? o.playerId : o.kind))).toEqual(['rhys', 'ann'])
        expect(draft.picksComplete(power)).toBe(false)
        pick(withBargainPlayer(legal, picked(), 'rhys'))
        expect(draft.picksComplete(power)).toBe(false)
        // The 3rd secret is the cost's; the 5th favor makes no pair.
        expect(bargainRows(session.gameState, ME, picked(), 'rhys')).toEqual({
            secrets: { held: 3, addable: 2, picked: 0 },
            pairs: { held: 5, addable: 2, picked: 0 }
        })
        // Ann's one favor buys none of your secrets; their last secret can be taken.
        expect(bargainRows(session.gameState, ME, picked(), 'ann')).toEqual({
            secrets: { held: 3, addable: 0, picked: 0 },
            pairs: { held: 5, addable: 1, picked: 0 }
        })
        pick(withBargainCount(legal, picked(), 'rhys', 'secretsGiven', 1))
        expect(draft.picksComplete(power)).toBe(true)
        expect(draft.choicesFor(power)).toEqual([{ kind: PowerChoiceKind.Bargain, playerId: 'rhys', secretsGiven: 1, pairsGiven: 0 }])
        expect(draft.reasonCannotUse(power)).toBeUndefined()
    })

    it('several players: each gets their own rows, held to what the others leave, and is sent in the order picked', async () => {
        const { session, draft, power, pick, picked, legal } = await bargaining()
        pick(withBargainPlayer(legal, picked(), 'rhys'))
        pick(withBargainCount(legal, picked(), 'rhys', 'secretsGiven', 2))
        pick(withBargainCount(legal, picked(), 'rhys', 'pairsGiven', 1))
        pick(withBargainPlayer(legal, picked(), 'ann'))
        expect(bargainRows(session.gameState, ME, picked(), 'ann')).toEqual({
            secrets: { held: 3, addable: 0, picked: 0 },
            pairs: { held: 5, addable: 1, picked: 0 }
        })
        pick(withBargainCount(legal, picked(), 'ann', 'pairsGiven', 1))
        expect(draft.choicesFor(power)).toEqual([
            { kind: PowerChoiceKind.Bargain, playerId: 'rhys', secretsGiven: 2, pairsGiven: 1 },
            { kind: PowerChoiceKind.Bargain, playerId: 'ann', secretsGiven: 0, pairsGiven: 1 }
        ])
        expect(draft.reasonCannotUse(power)).toBeUndefined()
        // Undo takes back the last pick: Ann's pair, then Ann, then Rhys's pair.
        expect(draft.back()).toBe(true)
        expect(picked()).toEqual([
            { playerId: 'rhys', secretsGiven: 2, pairsGiven: 1 },
            { playerId: 'ann', secretsGiven: 0, pairsGiven: 0 }
        ])
        expect(draft.choicesFor(power)).toHaveLength(1)
        expect(draft.back()).toBe(true)
        expect(picked()).toEqual([{ playerId: 'rhys', secretsGiven: 2, pairsGiven: 1 }])
        expect(draft.back()).toBe(true)
        expect(picked()).toEqual([{ playerId: 'rhys', secretsGiven: 2, pairsGiven: 0 }])
    })

    it('a tap on the piece at the count sets none; a tap on a picked chip drops the player and their counts', async () => {
        const { draft, power, pick, picked, legal } = await bargaining()
        pick(withBargainPlayer(legal, picked(), 'rhys'))
        pick(withBargainCount(legal, picked(), 'rhys', 'secretsGiven', 2))
        pick(withBargainCount(legal, picked(), 'rhys', 'secretsGiven', 2))
        expect(picked()).toEqual([{ playerId: 'rhys', secretsGiven: 0, pairsGiven: 0 }])
        expect(draft.picksComplete(power)).toBe(false)
        pick(withBargainCount(legal, picked(), 'rhys', 'pairsGiven', 1))
        pick(withBargainPlayer(legal, picked(), 'rhys'))
        expect(picked()).toEqual([])
        expect(draft.choicesFor(power)).toEqual([])
    })

    it('one other player at your site starts picked, their rows open; a tap on the chip keeps them; Use waits for a count', async () => {
        const { session, draft, power, pick, picked, legal } = await bargaining([], 'c2')
        expect(legal.options.map((o) => (o.kind === PowerChoiceKind.Bargain ? o.playerId : o.kind))).toEqual(['rhys'])
        // Shown picked, never stored: nothing for Undo to take back.
        expect(picked()).toEqual([])
        expect(shownBargainPicks(legal, picked())).toEqual([{ playerId: 'rhys', secretsGiven: 0, pairsGiven: 0 }])
        expect(bargainRows(session.gameState, ME, shownBargainPicks(legal, picked()), 'rhys')).toEqual({
            secrets: { held: 3, addable: 2, picked: 0 },
            pairs: { held: 5, addable: 2, picked: 0 }
        })
        expect(draft.picksComplete(power)).toBe(false)
        // The pick is required: a tap on the one chip changes nothing.
        pick(withBargainPlayer(legal, picked(), 'rhys'))
        expect(picked()).toEqual([])
        expect(shownBargainPicks(legal, picked())).toEqual([{ playerId: 'rhys', secretsGiven: 0, pairsGiven: 0 }])
        expect(draft.picksComplete(power)).toBe(false)
        pick(withBargainCount(legal, picked(), 'rhys', 'pairsGiven', 1))
        expect(picked()).toEqual([{ playerId: 'rhys', secretsGiven: 0, pairsGiven: 1 }])
        expect(draft.picksComplete(power)).toBe(true)
        expect(draft.choicesFor(power)).toEqual([{ kind: PowerChoiceKind.Bargain, playerId: 'rhys', secretsGiven: 0, pairsGiven: 1 }])
        pick(withBargainPlayer(legal, picked(), 'rhys'))
        expect(picked()).toEqual([{ playerId: 'rhys', secretsGiven: 0, pairsGiven: 1 }])
        // Undo takes back the pair; Rhys stays shown picked.
        expect(draft.back()).toBe(true)
        expect(picked()).toEqual([])
        expect(shownBargainPicks(legal, picked())).toEqual([{ playerId: 'rhys', secretsGiven: 0, pairsGiven: 0 }])
        expect(draft.picksComplete(power)).toBe(false)
    })

    it('Vow of Silence draws no secrets row; the favor row stays', async () => {
        const { session } = await bargaining([SILENCE])
        expect(bargainRows(session.gameState, ME, [], 'rhys')).toEqual({ pairs: { held: 5, addable: 2, picked: 0 } })
    })

    it('in a game created before revision 7 the power keeps its player and two counts', async () => {
        const session = await opened(
            table(MachineState.ActPhase, {}, { denizensBySite: { c1: [WITCHS_BARGAIN], c2: [], h1: [] }, oathRevision: OathRevision.UiBatch1 }, [
                testPlayer({ playerId: 'rhys', color: Color.Blue, status: PlayerStatus.Exile, siteId: 'c1' })
            ])
        )
        session.chooseAction(ActionType.UseActionPower)
        const power = required(session.actionPowers.powers.find((p) => p.cardId === WITCHS_BARGAIN), "Witch's Bargain is offered")
        expect(power.choices.map((c) => c.spec.kind)).toEqual([PowerChoiceKind.Player, PowerChoiceKind.Count, PowerChoiceKind.Count])
    })
})

/** Messenger: one move at a time, each read on the state the moves before it leave. */
/** A count of pieces tapped back to none is no pick: Undo that lands there leaves the picks. */
describe('a power’s count tapped back to none', () => {
    const BLOOD_PACT = 'denizen.arcane.blood-pact'
    const USE = { cardId: BLOOD_PACT, powerIndex: 0 }

    it('Undo that lands on it clears the picks, and the next Undo leaves the step', async () => {
        const session = await opened(
            table(MachineState.ActPhase, {
                warbandsOnBoard: { [ME]: 4 },
                advisers: [{ cardId: BLOOD_PACT, faceUp: true }]
            })
        )
        session.chooseAction(ActionType.UseActionPower)
        const draft = session.actionPowers
        const power = required(draft.powers.find((p) => p.cardId === BLOOD_PACT), 'Blood Pact is offered')
        const [grid] = warbandGrids(power.choices)
        const pact = required(grid, 'Blood Pact’s board is a row of pieces')
        const tap = (count: number) => draft.setPicks(USE, withGridCount(draft.picksOf(USE), pact, 0, count))
        tap(2)
        tap(0)
        tap(4)
        // Back past the 4: the row stands at none, so nothing is picked and the picks are left.
        expect(draft.back()).toBe(true)
        expect(draft.picksComplete(power)).toBe(false)
        expect(draft.hasManualSelection()).toBe(false)
        expect(draft.back()).toBe(false)
    })
})

describe('Messenger’s moves (docs/user-interactions.md)', () => {
    const MESSENGER = 'denizen.order.messenger'
    const USE = { cardId: MESSENGER, powerIndex: 0 }
    const board = { at: { kind: 'board' as const, playerId: ME }, owner: ME }
    const at = (siteId: string) => ({ at: { kind: 'site' as const, siteId }, owner: ME })
    const toSite = (siteId: string) => ({ kind: 'site' as const, siteId })
    const toBoard = { kind: 'board' as const }

    // The sheet's scene: four at the first site, two at the second, one at the third; the board empty.
    async function using(
        warbandsBySite: Record<string, Record<string, number>> = { c1: { [ME]: 4 }, c2: { [ME]: 2 }, h1: { [ME]: 1 } },
        warbandsOnBoard: Record<string, number> = {}
    ) {
        const session = await opened(
            table(
                MachineState.ActPhase,
                { warbandsOnBoard, advisers: [{ cardId: MESSENGER, faceUp: true }] },
                { denizensBySite: { c1: [], c2: [], h1: [] }, warbandsBySite }
            )
        )
        session.chooseAction(ActionType.UseActionPower)
        const draft = session.actionPowers
        const power = required(draft.powers.find((p) => p.cardId === MESSENGER), 'Messenger is offered')
        const moves = () => required(draft.movesOf(power), 'Messenger’s choices are moves')
        return { draft, power, moves }
    }

    it('the board is a From after a site → board move, and every count is the one the move leaves', async () => {
        const { draft, power, moves } = await using()
        expect(moves().whole).toEqual([])
        expect(moves().open?.sources).toEqual([
            { ...at('c1'), count: 3 },
            { ...at('c2'), count: 1 }
        ])
        expect(draft.picksComplete(power)).toBe(false)

        draft.setMoves(USE, [{ from: at('c1'), count: 2, to: toBoard }])
        expect(moves().whole).toEqual([{ from: at('c1'), count: 2, to: toBoard }])
        expect(moves().open?.from).toBeUndefined()
        expect(moves().open?.sources).toEqual([
            { ...board, count: 2 },
            { ...at('c1'), count: 1 },
            { ...at('c2'), count: 1 }
        ])
        expect(draft.picksComplete(power)).toBe(true)
        expect(draft.choicesFor(power)).toEqual([{ kind: PowerChoiceKind.Warbands, group: { ...at('c1'), count: 2 } }])
    })

    it('from the board To lists only ruled sites; from a site, the board and the other ruled sites', async () => {
        const { draft, moves } = await using()
        draft.setMoves(USE, [{ from: at('c1'), count: 1 }])
        expect(moves().open?.destinations).toEqual([toBoard, toSite('c2'), toSite('h1')])
        draft.setMoves(USE, [{ from: at('c1'), count: 2, to: toBoard }, { from: board, count: 1 }])
        expect(moves().open?.destinations).toEqual([toSite('c1'), toSite('c2'), toSite('h1')])
    })

    it('a half-built move hides "Use"; the send is the whole moves’ warbands, each with its site unless it goes to the board', async () => {
        const { draft, power, moves } = await using()
        draft.setMoves(USE, [
            { from: at('c1'), count: 2, to: toBoard },
            { from: board, count: 2, to: toSite('h1') },
            { from: at('h1') }
        ])
        expect(moves().whole).toHaveLength(2)
        expect(moves().open?.free).toBe(2)
        expect(draft.picksComplete(power)).toBe(false)
        draft.setMoves(USE, draft.picksOf(USE).moves.slice(0, 2))
        expect(draft.picksComplete(power)).toBe(true)
        expect(draft.choicesFor(power)).toEqual([
            { kind: PowerChoiceKind.Warbands, group: { ...at('c1'), count: 2 } },
            { kind: PowerChoiceKind.Warbands, group: { ...board, count: 2 } },
            { kind: PowerChoiceKind.Site, siteId: 'h1' }
        ])
        expect(draft.reasonCannotUse(power)).toBeUndefined()
    })

    it('a pick with one option is made: one free warband, one place to go', async () => {
        const { draft, moves } = await using()
        draft.setMoves(USE, [{ from: at('c2') }])
        expect(moves().open?.count).toBe(1)
        draft.setMoves(USE, [{ from: at('c2'), count: 1, to: toSite('h1') }, { from: at('h1') }])
        expect(moves().open?.count).toBe(1)
    })

    it('Undo takes back one pick (To, then How many, then From), then the move before', async () => {
        const { draft, moves } = await using()
        // Each part is its own tap, as the panel sends it.
        const tap = (pick: (picks: MovePick[]) => MovePick[]) => draft.setMoves(USE, pick(draft.picksOf(USE).moves))
        tap((picks) => withFrom(picks, 0, at('c1')))
        tap((picks) => withCount(picks, 0, moves().open?.count, 2))
        tap((picks) => withTo(picks, 0, toBoard))
        tap((picks) => withFrom(picks, 1, board))
        tap((picks) => withCount(picks, 1, moves().open?.count, 2))
        expect(draft.picksOf(USE).moves).toEqual([{ from: at('c1'), count: 2, to: toBoard }, { from: board, count: 2 }])
        expect(draft.back()).toBe(true)
        expect(draft.picksOf(USE).moves).toEqual([{ from: at('c1'), count: 2, to: toBoard }, { from: board }])
        expect(moves().open?.count).toBeUndefined()
        expect(draft.back()).toBe(true)
        expect(draft.picksOf(USE).moves).toEqual([{ from: at('c1'), count: 2, to: toBoard }])
        expect(draft.back()).toBe(true)
        expect(draft.picksOf(USE).moves).toEqual([{ from: at('c1'), count: 2 }])
        expect(moves().whole).toEqual([])
        expect(draft.back()).toBe(true)
        expect(draft.back()).toBe(true)
        expect(draft.picksOf(USE).moves).toEqual([])
        expect(draft.hasManualSelection()).toBe(false)
        expect(draft.back()).toBe(false)
    })

    it('a From made because it has one option is not kept: a count tap, then one Undo, picks nothing', async () => {
        // The board holds two and the one ruled site has none free: the board is the only From.
        const { draft, moves } = await using({ c1: { [ME]: 1 } }, { [ME]: 2 })
        expect(moves().open?.sources).toEqual([{ ...board, count: 2 }])
        expect(moves().open?.from).toEqual(board)

        draft.setMoves(USE, withCount(draft.picksOf(USE).moves, 0, moves().open?.count, 2))
        expect(draft.picksOf(USE).moves).toEqual([{ count: 2 }])
        expect(moves().whole).toEqual([{ from: board, count: 2, to: toSite('c1') }])
        expect(draft.hasManualSelection()).toBe(true)

        expect(draft.back()).toBe(true)
        expect(draft.picksOf(USE).moves).toEqual([])
        expect(draft.hasManualSelection()).toBe(false)
    })

    it('a move made from no pick keeps its place: a From tapped for the next move is that move’s From', async () => {
        // One ruled site holding two, the board empty: the first move has one option at each pick.
        const { draft, power, moves } = await using({ c1: { [ME]: 2 } })
        const made = { from: at('c1'), count: 1, to: toBoard }
        expect(moves().whole).toEqual([made])
        expect(moves().open?.sources).toEqual([{ ...board, count: 1 }])
        expect(moves().open?.from).toBeUndefined()

        // The board is the second move's From; its count and its To (the one ruled site) have one
        // option each, so the second move is whole and the first is still the one the panel made.
        draft.setMoves(USE, withFrom(draft.picksOf(USE).moves, 1, board))
        expect(moves().whole).toEqual([made, { from: board, count: 1, to: toSite('c1') }])
        expect(draft.choicesFor(power)).toHaveLength(3)

        expect(draft.back()).toBe(true)
        expect(draft.picksOf(USE).moves).toEqual([])
        expect(moves().whole).toEqual([made])
        expect(draft.picksComplete(power)).toBe(true)
    })

    it('after the 16th whole move no From opens; the engine takes all 16', async () => {
        const { draft, power, moves } = await using()
        const there = { from: at('c1'), count: 1, to: toSite('c2') }
        const again = { from: at('c2'), count: 1, to: toSite('c1') }
        const sixteen = Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? there : again))
        draft.setMoves(USE, sixteen.slice(0, 15))
        expect(moves().open?.sources.length).toBeGreaterThan(0)
        draft.setMoves(USE, sixteen)
        expect(moves().whole).toHaveLength(16)
        expect(moves().open).toBeUndefined()
        expect(draft.picksComplete(power)).toBe(true)
        expect(draft.choicesFor(power)).toHaveLength(32)
        expect(draft.reasonCannotUse(power)).toBeUndefined()
    })

    it('Undo takes back the last tap, across powers: a count changed after another power’s pick comes back as it was', async () => {
        const WHISTLE = { cardId: 'relic.whistle', powerIndex: 0 }
        const session = await opened(
            table(
                MachineState.ActPhase,
                { warbandsOnBoard: {}, relicIds: [WHISTLE.cardId], advisers: [{ cardId: MESSENGER, faceUp: true }] },
                { denizensBySite: { c1: [], c2: [], h1: [] }, warbandsBySite: { c1: { [ME]: 4 }, c2: { [ME]: 2 }, h1: { [ME]: 1 } } }
            )
        )
        session.chooseAction(ActionType.UseActionPower)
        const draft = session.actionPowers
        const messenger = required(draft.powers.find((p) => p.cardId === MESSENGER), 'Messenger is offered')
        expect(draft.powers.some((p) => p.cardId === WHISTLE.cardId)).toBe(true)
        const count = (n: number) =>
            draft.setMoves(USE, withCount(draft.picksOf(USE).moves, 0, draft.movesOf(messenger)?.open?.count, n))
        const whistled = { ...emptyPicks(), option: { 0: 0 } }

        draft.setMoves(USE, withFrom(draft.picksOf(USE).moves, 0, at('c1')))
        count(2)
        draft.setPicks(WHISTLE, whistled)
        count(3)

        expect(draft.back()).toBe(true)
        expect(draft.picksOf(USE).moves).toEqual([{ from: at('c1'), count: 2 }])
        expect(draft.picksOf(WHISTLE)).toEqual(whistled)
        expect(draft.back()).toBe(true)
        expect(draft.picksOf(USE).moves).toEqual([{ from: at('c1'), count: 2 }])
        expect(draft.picksOf(WHISTLE)).toEqual(emptyPicks())
        expect(draft.back()).toBe(true)
        expect(draft.picksOf(USE).moves).toEqual([{ from: at('c1') }])
        expect(draft.back()).toBe(true)
        expect(draft.picksOf(USE).moves).toEqual([])
        expect(draft.hasManualSelection()).toBe(false)
        expect(draft.back()).toBe(false)
    })
})

/** R-6.6.1 — the Exile, then the relic space, then the terms. */
describe('the Citizenship offer draft (docs/user-interactions.md)', () => {
    const offeringIn = async (prepare?: (state: HydratedOathGameState) => void) => {
        const state = table(MachineState.ActPhase, { status: PlayerStatus.Chancellor, relicIds: ['relic.grand-scepter'] }, {}, [
            testPlayer({ playerId: 'exile2', color: Color.Blue, status: PlayerStatus.Exile, siteId: 'c2' })
        ])
        state.getPlayerState(CHANCELLOR).status = PlayerStatus.Exile
        state.chancellorPlayerId = ME
        state.reliquary = state.reliquary.map((slot, index) => ({ ...slot, cardId: `relic.fixture-${index}` }))
        state.getPlayerState(CHANCELLOR).relicIds = ['relic.cup-of-plenty']
        state.banners[Banner.DarkestSecret] = { value: 1, holderPlayerId: ME }
        prepare?.(state)
        const session = await opened(state)
        session.chooseAction(ActionType.OfferCitizenship)
        return session
    }
    const offering = async () => (await offeringIn()).citizenship
    const [SLOT_A, SLOT_B] = ['reliquary.0', 'reliquary.1']

    it('a refusal of the terms names the Exile, and the offerer reads “you”', async () => {
        const session = await offeringIn()
        const offer = session.citizenship
        vi.spyOn(session, 'getPlayerName').mockImplementation((id) => (id === 'exile2' ? 'Bob' : 'Alice'))
        offer.chooseExile('exile2')
        offer.chooseReliquarySlot(SLOT_A)
        offer.setTerm('givenFavor', 9)
        expect(session.humanizeReason(offer.blockedBecause)).toBe('you promised 9 favor, with only 3 usable')
        offer.setTerm('givenFavor', 0)
        offer.setTerm('askedSecrets', 5)
        expect(session.humanizeReason(offer.blockedBecause)).toBe('Bob promised 5 secrets, holding only 0')
    })

    it('choosing the Exile clears the relic space and terms chosen for the last one', async () => {
        const offer = await offering()
        offer.chooseExile(CHANCELLOR)
        offer.chooseReliquarySlot(SLOT_A)
        offer.setTerm('givenFavor', 1)
        expect(offer.offerTerms.givenFavor).toBe(1)

        offer.chooseExile('exile2')
        expect(offer.reliquarySlotId).toBeUndefined()
        expect(offer.offerTerms.givenFavor).toBe(0)
    })

    it('Undo takes the terms, then the space, then the Exile', async () => {
        const offer = await offering()
        offer.chooseExile(CHANCELLOR)
        offer.chooseReliquarySlot(SLOT_A)
        offer.setTerm('givenFavor', 1)

        expect(offer.back()).toBe(true)
        expect(offer.offerTerms.givenFavor).toBe(0)
        expect(offer.reliquarySlotId).toBe(SLOT_A)
        expect(offer.back()).toBe(true)
        expect(offer.reliquarySlotId).toBeUndefined()
        expect(offer.back()).toBe(true)
        expect(offer.exilePlayerId).toBeUndefined()
        expect(offer.back()).toBe(false)
    })

    it('Undo takes the terms one pick at a time, the last first; a tap that changes nothing is no pick', async () => {
        const offer = await offering()
        offer.chooseExile(CHANCELLOR)
        offer.chooseReliquarySlot(SLOT_A)
        offer.toggleBanner('givenBanners', Banner.DarkestSecret, true)
        offer.setTerm('givenFavor', 2)
        offer.setTerm('askedFavor', 0)
        offer.setTerm('givenFavor', 1)

        expect(offer.back()).toBe(true)
        expect(offer.offerTerms).toMatchObject({ givenFavor: 2, givenBanners: [Banner.DarkestSecret] })
        expect(offer.back()).toBe(true)
        expect(offer.offerTerms).toMatchObject({ givenFavor: 0, givenBanners: [Banner.DarkestSecret] })
        expect(offer.back()).toBe(true)
        expect(offer.offerTerms).toEqual((await offering()).offerTerms)
        expect(offer.reliquarySlotId).toBe(SLOT_A)
        expect(offer.back()).toBe(true)
        expect(offer.reliquarySlotId).toBeUndefined()
    })

    it('before any pick there is nothing for Undo to take', async () => {
        const offer = await offering()
        expect(offer.exiles).toEqual([CHANCELLOR, 'exile2'])
        expect(offer.hasManualSelection()).toBe(false)
    })

    it('a space is chosen only after an Exile, and terms only after a space', async () => {
        const offer = await offering()
        offer.chooseReliquarySlot(SLOT_A)
        offer.setTerm('givenFavor', 1)
        expect(offer.hasManualSelection()).toBe(false)
    })

    // A pick with one legal option is not a choice: it starts made, and Undo has nothing of it to take.
    const offeringTheOnlyExile = async (relics: number) => {
        const state = table(MachineState.ActPhase, { status: PlayerStatus.Chancellor, relicIds: ['relic.grand-scepter'] }, {}, [
            testPlayer({ playerId: 'exile2', color: Color.Blue, status: PlayerStatus.Exile, siteId: 'c2' })
        ])
        state.getPlayerState(CHANCELLOR).status = PlayerStatus.Citizen
        state.chancellorPlayerId = ME
        state.reliquary = state.reliquary
            .slice(0, relics)
            .map((slot, index) => ({ ...slot, cardId: `relic.fixture-${index}` }))
        const session = await opened(state)
        session.chooseAction(ActionType.OfferCitizenship)
        return session.citizenship
    }

    it('the one Exile starts picked, and is no pick for Undo to take', async () => {
        const offer = await offeringTheOnlyExile(4)
        expect(offer.exiles).toEqual(['exile2'])
        expect(offer.exilePlayerId).toBe('exile2')
        expect(offer.reliquarySlotId).toBeUndefined()
        expect(offer.hasManualSelection()).toBe(false)

        offer.chooseReliquarySlot(SLOT_A)
        expect(offer.reliquarySlotId).toBe(SLOT_A)
        expect(offer.back()).toBe(true)
        expect(offer.reliquarySlotId).toBeUndefined()
        expect(offer.exilePlayerId).toBe('exile2')
        expect(offer.back()).toBe(false)
    })

    it('the one relic left starts promised, so the terms open at once', async () => {
        const offer = await offeringTheOnlyExile(1)
        expect(offer.reliquarySlotId).toBe(SLOT_A)
        expect(offer.hasManualSelection()).toBe(false)
        expect(offer.blockedBecause).toBeUndefined()

        offer.setTerm('givenFavor', 1)
        expect(offer.offerTerms.givenFavor).toBe(1)
        expect(offer.back()).toBe(true)
        expect(offer.offerTerms.givenFavor).toBe(0)
        expect(offer.reliquarySlotId).toBe(SLOT_A)
        expect(offer.back()).toBe(false)
    })

    it('choosing another space clears the terms under it', async () => {
        const offer = await offering()
        offer.chooseExile(CHANCELLOR)
        offer.chooseReliquarySlot(SLOT_A)
        offer.setTerm('askedFavor', 2)
        offer.chooseReliquarySlot(SLOT_B)
        expect(offer.reliquarySlotId).toBe(SLOT_B)
        expect(offer.offerTerms.askedFavor).toBe(0)
    })
    it('R-6.6.1 — terms may carry held relics and banners each way, and only held ones', async () => {
        const offer = await offering()
        offer.chooseExile('exile2')
        offer.chooseReliquarySlot(SLOT_A)
        const exile = offer.holdings.exile
        expect(exile.relicIds).toEqual([])
        offer.toggleRelic('askedRelics', 'relic.not-held', true)
        expect(offer.offerTerms.askedRelics).toEqual([])

        offer.chooseExile(CHANCELLOR)
        offer.chooseReliquarySlot(SLOT_A)
        const held = offer.holdings
        expect(held.exile.relicIds).toEqual(['relic.cup-of-plenty'])
        expect(held.offerer.banners).toEqual([Banner.DarkestSecret])
        offer.toggleRelic('askedRelics', 'relic.cup-of-plenty', true)
        offer.toggleBanner('givenBanners', Banner.DarkestSecret, true)
        expect(offer.terms).toEqual({
            fromScepterHolder: { banners: [Banner.DarkestSecret] },
            fromExile: { relicCardIds: ['relic.cup-of-plenty'] }
        })
    })

    // Vow of Silence: "You cannot … give anyone secrets."
    const silenced = (playerId: string, secrets: number) => (state: HydratedOathGameState) => {
        const player = state.getPlayerState(playerId)
        player.secrets = secrets
        player.advisers = [{ cardId: 'denizen.arcane.vow-of-silence', faceUp: true }]
    }

    it('favor and secrets are token rows: one token per unit a side holds, those the rules refuse not addable', async () => {
        const offer = (await offeringIn(silenced('exile2', 2))).citizenship
        offer.chooseExile('exile2')
        offer.chooseReliquarySlot(SLOT_A)
        expect(offer.tokenRow('givenFavor')).toEqual({ held: 3, addable: 3, picked: 0 })
        expect(offer.tokenRow('givenSecrets')).toEqual({ held: 2, addable: 2, picked: 0 })
        // The Exile holds 2 secrets and may give none: two tokens, neither addable.
        expect(offer.tokenRow('askedSecrets')).toEqual({ held: 2, addable: 0, picked: 0 })
        // A token a side holds none of has no tokens, so no control.
        expect(offer.tokenRow('askedFavor')).toEqual({ held: 0, addable: 0, picked: 0 })
    })

    it('a tap on the Nth token sets N; a tap on the token at the count sets 0; each tap is one pick for Undo', async () => {
        const offer = await offering()
        offer.chooseExile(CHANCELLOR)
        offer.chooseReliquarySlot(SLOT_A)
        offer.tapToken('givenFavor', 2)
        expect(offer.tokenRow('givenFavor').picked).toBe(2)
        offer.tapToken('givenFavor', 3)
        expect(offer.tokenRow('givenFavor').picked).toBe(3)
        offer.tapToken('givenFavor', 3)
        expect(offer.tokenRow('givenFavor').picked).toBe(0)
        offer.tapToken('givenSecrets', 1)
        expect(offer.terms).toEqual({ fromScepterHolder: { secrets: 1 }, fromExile: undefined })

        expect(offer.back()).toBe(true)
        expect(offer.tokenRow('givenFavor').picked).toBe(0)
        expect(offer.back()).toBe(true)
        expect(offer.tokenRow('givenFavor').picked).toBe(3)
        expect(offer.back()).toBe(true)
        expect(offer.tokenRow('givenFavor').picked).toBe(2)
    })

    it('a token beyond what the rules let a side add is no pick', async () => {
        const offer = (await offeringIn(silenced(CHANCELLOR, 1))).citizenship
        offer.chooseExile(CHANCELLOR)
        offer.chooseReliquarySlot(SLOT_A)
        offer.tapToken('askedSecrets', 1)
        offer.tapToken('givenFavor', 4)
        expect(offer.terms).toBeUndefined()
        expect(offer.back()).toBe(true)
        expect(offer.reliquarySlotId).toBeUndefined()
    })

    it('R-6.6.1 — an Exile offering themself gets no terms: the offer is the relic alone', async () => {
        const state = table(MachineState.ActPhase, { relicIds: ['relic.grand-scepter'] })
        state.reliquary = state.reliquary.map((slot, index) => ({ ...slot, cardId: `relic.fixture-${index}` }))
        state.banners[Banner.DarkestSecret] = { value: 1, holderPlayerId: ME }
        const session = await opened(state)
        session.chooseAction(ActionType.OfferCitizenship)
        const offer = session.citizenship
        expect(offer.exilePlayerId).toBe(ME)
        offer.chooseReliquarySlot(SLOT_A)
        expect(offer.offersSelf).toBe(true)

        offer.tapToken('givenFavor', 1)
        offer.setTerm('askedSecrets', 1)
        offer.toggleBanner('givenBanners', Banner.DarkestSecret, true)
        offer.toggleRelic('givenRelics', 'relic.grand-scepter', true)
        expect(offer.terms).toBeUndefined()
        expect(offer.offerTerms.givenBanners).toEqual([])
        expect(offer.blockedBecause).toBeUndefined()
        expect(offer.back()).toBe(true)
        expect(offer.reliquarySlotId).toBeUndefined()
    })
})

/** R-6.6.2, R-9.3 — which warbands become Imperial, as pieces by place; every pick is one entry. */
describe('the Citizenship answer draft (docs/user-interactions.md)', () => {
    const BOARD = { kind: 'board', playerId: ME } as const
    const SITE = { kind: 'site', siteId: 'c1' } as const

    const answering = async (imperial: number) => {
        const state = table(
            MachineState.ActPhase,
            { warbandsOnBoard: { [ME]: 3 } },
            { warbandsBySite: { c1: { [ME]: 2 } } }
        )
        state.getPlayerState(CHANCELLOR).warbandsInPersonalBank = { [IMPERIAL_WARBANDS]: imperial }
        state.pendingConsent = {
            request: { kind: ConsentRequestKind.CitizenshipOffer, exilePlayerId: ME, reliquarySlotId: 'reliquary.0' },
            askingPlayerId: CHANCELLOR,
            askedPlayerId: ME
        }
        state.activePlayerIds = [ME]
        return await opened(state)
    }
    const pieceKeys = (session: Awaited<ReturnType<typeof answering>>) =>
        session.consent.places.flatMap((place) => place.pieces.map((piece) => piece.key))

    it('short: the pieces by place, board first, and the first the Empire can cover picked', async () => {
        const session = await answering(3)
        const { consent } = session
        expect(consent.conversion).toEqual({ kind: 'short', warbands: 5, imperial: 3, removed: 2 })
        expect(consent.places.map((place) => [place.at, place.pieces.length])).toEqual([
            [BOARD, 3],
            [SITE, 2]
        ])
        expect(consent.canPick).toBe(true)
        expect(consent.picked).toEqual(pieceKeys(session).slice(0, 3))
        expect(consent.hasManualSelection()).toBe(false)
        expect(consent.blockedBecause).toBeUndefined()
    })

    it('at the limit, a tap on another piece swaps out the oldest pick', async () => {
        const session = await answering(3)
        const { consent } = session
        const [b1, b2, b3, v1, v2] = pieceKeys(session)
        consent.pick(v1)
        expect(consent.picked).toEqual([b2, b3, v1])
        consent.pick(v2)
        expect(consent.picked).toEqual([b3, v1, v2])
        expect([b1, b2, b3, v1, v2].map((key) => consent.isImperial(key))).toEqual([
            false,
            false,
            true,
            true,
            true
        ])
        expect(consent.hasManualSelection()).toBe(true)
    })

    it('a tap on a picked piece untaps it; the picks are short, and the engine refuses fewer than the Empire covers', async () => {
        const session = await answering(3)
        const { consent } = session
        const [b1, b2, b3, v1] = pieceKeys(session)
        expect(consent.picksComplete).toBe(true)
        consent.pick(b1)
        expect(consent.picked).toEqual([b2, b3])
        expect(consent.picksComplete).toBe(false)
        expect(consent.blockedBecause).toMatch(/must choose exactly 3 warbands to replace, not 2/)
        consent.pick(v1)
        expect(consent.picked).toEqual([b2, b3, v1])
        expect(consent.picksComplete).toBe(true)
        expect(consent.blockedBecause).toBeUndefined()
    })

    it('Undo clears every pick at once, and the default returns', async () => {
        const session = await answering(3)
        const { consent } = session
        const keys = pieceKeys(session)
        consent.pick(keys[3])
        consent.pick(keys[4])
        expect(consent.back()).toBe(true)
        expect(consent.picked).toEqual(keys.slice(0, 3))
        expect(consent.back()).toBe(false)
    })

    it('none: every piece is removed and none can be picked; the answer names no warbands', async () => {
        const session = await answering(0)
        const { consent } = session
        expect(consent.conversion).toEqual({ kind: 'none', warbands: 5, imperial: 0, removed: 5 })
        expect(consent.canPick).toBe(false)
        consent.pick(pieceKeys(session)[0])
        expect(consent.picked).toEqual([])
        expect(pieceKeys(session).some((key) => consent.isImperial(key))).toBe(false)
        expect(consent.replacementChoice).toEqual([])
        expect(consent.blockedBecause).toBeUndefined()
    })

    it('enough: every piece becomes Imperial and none can be picked; the answer names no choice', async () => {
        const session = await answering(5)
        const { consent } = session
        expect(consent.conversion).toEqual({ kind: 'enough', warbands: 5, imperial: 5, removed: 0 })
        expect(consent.canPick).toBe(false)
        expect(pieceKeys(session).every((key) => consent.isImperial(key))).toBe(true)
        expect(consent.replacementChoice).toBeUndefined()
        expect(consent.blockedBecause).toBeUndefined()
    })

    it('Accept sends the picks as warband groups by place, as the engine reads them; Refuse sends none', async () => {
        const session = await answering(3)
        const sent = vi.spyOn(session, 'answerCitizenshipOffer').mockResolvedValue()
        session.consent.pick(pieceKeys(session)[3])
        await session.consent.answer(true)
        expect(sent).toHaveBeenLastCalledWith(true, [
            { at: BOARD, owner: ME, count: 2 },
            { at: SITE, owner: ME, count: 1 }
        ])
        await session.consent.answer(false)
        expect(sent).toHaveBeenLastCalledWith(false, undefined)
    })
})

/** R-4.3.5, R-4.3-H1 — from the turn-flow revision, a row per usable power and a button per bank. */
describe('the Rest panel’s rows (turn-flow revision)', () => {
    const resting = async (favorBank: Partial<Record<Suit, number>> = {}) =>
        await opened(
            table(
                MachineState.RestPhase,
                {
                    advisers: [
                        { cardId: OBEDIENCE, faceUp: true },
                        { cardId: SILVER_TONGUE, faceUp: true }
                    ]
                },
                {
                    oathRevision: OathRevision.TurnFlow,
                    favorBank: { arcane: 3, beast: 2, discord: 0, hearth: 4, nomad: 1, order: 3, ...favorBank }
                }
            )
        )
    const row = (session: Awaited<ReturnType<typeof resting>>, cardId: string) =>
        required(session.rest.rows.find((r) => r.cardId === cardId), `${cardId} has a row`)

    it('lists every bank a power can name in the board’s order, an empty one tappable with its 0 (R-9.3)', async () => {
        const session = await resting()
        expect(session.rest.turnFlow).toBe(true)
        const banks = required(row(session, OBEDIENCE).banks, 'Vow of Obedience names banks')
        expect(banks.map((bank) => bank.suit)).toEqual([...FAVOR_BANK_ORDER])
        expect(banks.find((bank) => bank.suit === Suit.Discord)).toEqual({ suit: Suit.Discord, inBank: 0, takes: 0, enabled: true })
        expect(banks.filter((bank) => bank.enabled)).toHaveLength(6)
    })

    it('a tap on the empty bank uses the power with it, and the engine takes the 0', async () => {
        const session = await resting()
        const obedience = row(session, OBEDIENCE)
        const sent = vi.spyOn(session, 'useRestPower').mockResolvedValue()
        await session.rest.useWithBank(obedience, Suit.Discord)
        expect(sent).toHaveBeenCalledWith(OBEDIENCE, obedience.powerIndex, restBankChoice(Suit.Discord))
        expect(HydratedUseRestPower.reasonCannotUse(session.gameState, ME, OBEDIENCE, obedience.powerIndex, restBankChoice(Suit.Discord))).toBeUndefined()
    })

    it('a row is the card and its buttons: it carries no description of the power', async () => {
        const obedience = row(await resting(), OBEDIENCE)
        expect(obedience).not.toHaveProperty('does')
        expect(obedience).not.toHaveProperty('used')
    })

    it('names no more favor on a bank’s button than the bank holds (Vow of Poverty)', async () => {
        const session = await opened(table(MachineState.RestPhase, { favor: 0, advisers: [{ cardId: POVERTY, faceUp: true }] }, { oathRevision: OathRevision.TurnFlow, favorBank: { arcane: 3, beast: 2, discord: 0, hearth: 4, nomad: 1, order: 3 } }))
        const banks = required(row(session, POVERTY).banks, 'Vow of Poverty names banks')
        expect(banks.find((bank) => bank.suit === Suit.Nomad)?.takes).toBe(1)
        expect(banks.find((bank) => bank.suit === Suit.Hearth)?.takes).toBe(2)
    })

    it('lists only the banks matching a card at the site for Silver Tongue', async () => {
        const banks = required(row(await resting(), SILVER_TONGUE).banks, 'Silver Tongue names banks')
        expect(banks.map((bank) => bank.suit).sort()).toEqual([Suit.Beast, Suit.Hearth].sort())
    })

    it('a tap on a bank uses the power with it, with nothing else to press', async () => {
        const session = await resting()
        const sent = vi.spyOn(session, 'useRestPower').mockResolvedValue()
        await session.rest.useWithBank(row(session, OBEDIENCE), Suit.Hearth)
        expect(sent).toHaveBeenCalledWith(OBEDIENCE, row(session, OBEDIENCE).powerIndex, [{ kind: PowerChoiceKind.FavorBank, suit: Suit.Hearth }])
    })

    it('R-4.3.5 — a power used this turn is not listed: the History says what it did', () => {
        const state = table(MachineState.RestPhase, { advisers: [{ cardId: OBEDIENCE, faceUp: true }, { cardId: INSOMNIA, faceUp: true }] }, { oathRevision: OathRevision.TurnFlow })
        state.getPlayerState(ME).restPowersUsedThisTurn = [powerKey(INSOMNIA, powerIndexOf(INSOMNIA, PowerTiming.Rest))]
        expect(restRows(state, ME).map((r) => r.cardId)).toEqual([OBEDIENCE])
    })

    it('keeps today’s panel in a game created before the revision', async () => {
        const session = await opened(table(MachineState.RestPhase, { advisers: [{ cardId: OBEDIENCE, faceUp: true }] }))
        expect(session.rest.turnFlow).toBe(false)
    })
})

/** R-9.4 — outside this seat's Act Phase the seat card's let-peek picker is one Manual Draft Entry. */
describe('the seat card’s let-peek picker draft (docs/user-interactions.md)', () => {
    const picker = async () => (await opened(table(MachineState.ActPhase))).seatCardPeek

    it('opening it is a manual pick, and Undo takes it back', async () => {
        const draft = await picker()
        expect(draft.open).toBe(false)
        expect(draft.hasManualSelection()).toBe(false)
        draft.toggle()
        expect(draft.open).toBe(true)
        expect(draft.hasManualSelection()).toBe(true)
        expect(draft.back()).toBe(true)
        expect(draft.open).toBe(false)
        expect(draft.back()).toBe(false)
    })

    it('a second press closes it', async () => {
        const draft = await picker()
        draft.toggle()
        draft.toggle()
        expect(draft.open).toBe(false)
        expect(draft.hasManualSelection()).toBe(false)
    })

    it('the card picked in it is the next pick: Undo takes it back, then closes the picker', async () => {
        const draft = await picker()
        draft.toggle()
        expect(draft.subject).toBeUndefined()
        draft.pick('denizen.arcane.tutor')
        expect(draft.subject).toBe('denizen.arcane.tutor')
        expect(draft.back()).toBe(true)
        expect(draft.subject).toBeUndefined()
        expect(draft.open).toBe(true)
        expect(draft.back()).toBe(true)
        expect(draft.open).toBe(false)
    })
})

/** Vow of Kinship's Q&A — its bank's favor may be placed at the Wake, never forced (R-10.10-H1). */
describe('the Wake draft with the Vow of Kinship', () => {
    const VOW = 'denizen.nomad.vow-of-kinship'
    const kin = async (value: number, mobSide = false, revision = OathRevision.EngineFixes14) => {
        const session = await opened(
            table(
                MachineState.WakePhase,
                { favor: 0, advisers: [{ cardId: VOW, faceUp: true }] },
                {
                    oathRevision: revision,
                    banners: { ...testBanners(), [Banner.PeoplesFavor]: { value, mobSide, holderPlayerId: ME } }
                }
            )
        )
        const sent = vi.spyOn(session, 'resolveWake').mockResolvedValue()
        return { session, wake: session.wake, sent }
    }

    it('at 1 with an empty board, the step offers Place or none, and the Wake is not skipped', async () => {
        const { session, wake, sent } = await kin(1)
        expect(session.wakeNeedsDecision).toBe(true)
        expect(wake.question).toEqual({ kind: 'favorStep', index: 0, options: ['place', 'none'] })
        expect(wake.readyToEnd).toBe(false)
        expect(sent).not.toHaveBeenCalled()
    })

    it('"Place none" sends a Wake with no step; Place sends the place', async () => {
        const none = await kin(1)
        await none.wake.chooseKind('none')
        expect(none.sent).toHaveBeenCalledExactlyOnceWith([], undefined)
        const place = await kin(1)
        await place.wake.chooseKind('place')
        expect(place.sent).toHaveBeenCalledExactlyOnceWith([{ kind: 'place' }], undefined)
    })

    it('at 2 the step is forced: Place or Return, no none', async () => {
        const { wake } = await kin(2)
        expect(wake.question).toEqual({ kind: 'favorStep', index: 0, options: ['place', 'return'] })
    })

    it('on the Mob side at 2, a Return leaves the second step optional: none sends the Return alone', async () => {
        const { wake, sent } = await kin(2, true)
        expect(wake.stepCount).toBe(2)
        await wake.chooseKind('return')
        await wake.chooseBank(Suit.Discord)
        expect(wake.question).toEqual({ kind: 'favorStep', index: 1, options: ['place', 'none'] })
        await wake.chooseKind('none')
        expect(sent).toHaveBeenCalledExactlyOnceWith([{ kind: 'return', toSuit: Suit.Discord }], undefined)
    })

    it('before revision 18 the place is forced and taken with no tap, as recorded', async () => {
        const { wake } = await kin(1, false, OathRevision.EngineFixes13)
        expect(wake.question).toBeUndefined()
        expect(wake.answeredLines).toEqual(['Placed 1 favor.'])
        expect(wake.readyToEnd).toBe(true)
    })
})
