import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
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
    type LegalPowerUse,
    type UseRestPower
} from '@tabletop/oath'
import { openTurn, required, testBanners, testPlayer, testState } from '@tabletop/oath/testing'
import { emptyPicks } from './powerChoices.js'
import { restRows } from './restRows.js'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { IMPERIAL_WARBANDS } from '@tabletop/oath'

afterEach(disposeSessions)

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

function opened(state: HydratedOathGameState) {
    return openSessionOn(tableOf(state))
}

/** R-4.1.1 — the People's Favor steps and the site power's take are one entry. */
describe('the Wake draft (docs/user-interactions.md)', () => {
    const waking = () =>
        opened(
            table(MachineState.WakePhase, {}, { banners: testBanners({ [Banner.PeoplesFavor]: ME }, 3) })
        ).wake

    it('a step’s kind and its bank are kept together, and changing the kind keeps the other steps', () => {
        const wake = waking()
        expect(wake.stepCount).toBeGreaterThan(0)
        wake.setKind(0, 'return')
        const [bank] = wake.leastBanksAt(0)
        wake.setSuit(0, bank)
        expect(wake.kinds[0]).toBe('return')
        expect(wake.suits[0]).toBe(bank)
    })

    it('Back clears every step at once, and the defaults return', () => {
        const wake = waking()
        wake.setKind(0, 'return')
        expect(wake.back()).toBe(true)
        expect(wake.kinds[0]).toBe('place')
        expect(wake.back()).toBe(false)
    })

    it('the defaults are not picks: before any tap there is nothing for Back or Undo to take', () => {
        const wake = waking()
        expect(wake.kinds[0]).toBe('place')
        expect(wake.hasManualSelection()).toBe(false)
    })

    it('a step beyond the count, or a kind not offered, is never chosen', () => {
        const wake = waking()
        wake.setKind(wake.stepCount, 'return')
        expect(wake.hasManualSelection()).toBe(false)
    })

    it('choosing the kind again keeps the bank chosen for it', () => {
        const wake = waking()
        wake.setKind(0, 'return')
        const [bank] = wake.leastBanksAt(0)
        wake.setSuit(0, bank)
        wake.setKind(0, 'return')
        expect(wake.suits[0]).toBe(bank)
    })
})

/** R-4.1.1.I, R-4.1.1-H1 — on the Mob side the second step is judged after the first. */
describe('the Mob-side Wake', () => {
    it("the second return's tied banks follow the first return", () => {
        const wake = opened(
            table(
                MachineState.WakePhase,
                {},
                {
                    banners: {
                        [Banner.PeoplesFavor]: { value: 4, mobSide: true, holderPlayerId: ME },
                        [Banner.DarkestSecret]: { value: 1 }
                    },
                    favorBank: {
                        [Suit.Discord]: 0,
                        [Suit.Arcane]: 1,
                        [Suit.Order]: 2,
                        [Suit.Hearth]: 2,
                        [Suit.Beast]: 2,
                        [Suit.Nomad]: 2
                    }
                }
            )
        ).wake
        expect(wake.stepCount).toBe(2)
        wake.setKind(0, 'return')
        wake.setKind(1, 'return')
        expect(wake.leastBanksAt(0)).toEqual([Suit.Discord])
        expect(wake.leastBanksAt(1).sort()).toEqual([Suit.Arcane, Suit.Discord].sort())
        wake.setSuit(1, Suit.Arcane)
        expect(wake.favorSteps).toEqual([
            { kind: 'return', toSuit: Suit.Discord },
            { kind: 'return', toSuit: Suit.Arcane }
        ])
    })
})

/** R-4.3.5 — each Rest power's bank, one entry for all of them. */
describe('the Rest draft (docs/user-interactions.md)', () => {
    const resting = () =>
        opened(
            table(MachineState.RestPhase, {
                advisers: [
                    { cardId: OBEDIENCE, faceUp: true },
                    { cardId: SILVER_TONGUE, faceUp: true }
                ]
            })
        ).rest
    const power = (draft: ReturnType<typeof resting>, cardId: string) =>
        required(draft.powers.find((p) => p.cardId === cardId), `${cardId} offered at Rest`)

    it('a bank for one power keeps the bank chosen for the other', () => {
        const rest = resting()
        rest.pickBank(power(rest, OBEDIENCE), Suit.Arcane)
        rest.pickBank(power(rest, SILVER_TONGUE), Suit.Beast)
        expect(rest.pickedSuit(power(rest, OBEDIENCE))).toBe(Suit.Arcane)
        expect(rest.pickedSuit(power(rest, SILVER_TONGUE))).toBe(Suit.Beast)
    })

    it('Back clears every bank at once', () => {
        const rest = resting()
        rest.pickBank(power(rest, SILVER_TONGUE), Suit.Beast)
        expect(rest.back()).toBe(true)
        expect(rest.hasManualSelection()).toBe(false)
        expect(rest.back()).toBe(false)
    })

    it('the first bank offered is the default, not a pick', () => {
        const rest = resting()
        expect(rest.pickedSuit(power(rest, OBEDIENCE))).toBeDefined()
        expect(rest.hasManualSelection()).toBe(false)
    })

    it('a bank the power does not offer is never picked', () => {
        const rest = resting()
        rest.pickBank(power(rest, SILVER_TONGUE), Suit.Arcane)
        expect(rest.hasManualSelection()).toBe(false)
    })

    it('picking a power’s bank again replaces it', () => {
        const rest = resting()
        rest.pickBank(power(rest, SILVER_TONGUE), Suit.Beast)
        rest.pickBank(power(rest, SILVER_TONGUE), Suit.Hearth)
        expect(rest.pickedSuit(power(rest, SILVER_TONGUE))).toBe(Suit.Hearth)
    })
})

/** Visual contract scenario 33 — what the Rest panel does not offer. */
describe('a Rest power whose choice the panel does not offer', () => {
    const NOT_OFFERED = 'this power asks a choice this panel does not offer'

    it('is refused with that reason, while a bank-only power is not', () => {
        const rest = opened(
            table(MachineState.RestPhase, { advisers: [{ cardId: OBEDIENCE, faceUp: true }] })
        ).rest
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
    const usingIn = () => {
        const session = opened(table(MachineState.ActPhase, {}, { denizensBySite: { c1: [INN, SNARE], c2: [], h1: [] } }))
        session.chooseAction(ActionType.UseActionPower)
        return session
    }
    const using = () => usingIn().actionPowers
    const INN_USE = { cardId: INN, powerIndex: 0 }
    const SNARE_USE = { cardId: SNARE, powerIndex: 0 }
    const ticked = { ...emptyPicks(), count: [1] }

    it('picks for one power keep the picks for the other', () => {
        const draft = using()
        expect(draft.powers.map((p) => p.cardId).sort()).toEqual([SNARE, INN].sort())
        draft.setPicks(INN_USE, ticked)
        draft.setPicks(SNARE_USE, ticked)
        expect(draft.picksOf(INN_USE)).toEqual(ticked)
        expect(draft.picksOf(SNARE_USE)).toEqual(ticked)
    })

    it('Back clears every power’s picks at once', () => {
        const draft = using()
        draft.setPicks(INN_USE, ticked)
        expect(draft.back()).toBe(true)
        expect(draft.picksOf(INN_USE)).toEqual(emptyPicks())
        expect(draft.back()).toBe(false)
    })

    it('before any pick there is nothing for Back or Undo to take', () => {
        expect(using().hasManualSelection()).toBe(false)
    })

    it('a power not in reach is never given picks', () => {
        const draft = using()
        draft.setPicks({ cardId: OBEDIENCE, powerIndex: 0 }, ticked)
        expect(draft.hasManualSelection()).toBe(false)
    })

    it("a refusal names the other seat, not their id, and the reader reads “you”", () => {
        const STEVE = 'Qx7_pL2mWb9-Rk4tYc1nZ'
        const BARGAIN = { cardId: WITCHS_BARGAIN, powerIndex: 0 }
        const session = opened(
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

    it('choosing another action ends its picks', () => {
        const session = usingIn()
        session.actionPowers.setPicks(INN_USE, ticked)
        session.chooseAction(ActionType.Travel)
        session.chooseAction(ActionType.UseActionPower)
        expect(session.actionPowers.picksOf(INN_USE)).toEqual(emptyPicks())
    })
})

/** R-6.6.1 — the Exile, then the relic space, then the terms. */
describe('the Citizenship offer draft (docs/user-interactions.md)', () => {
    const offeringIn = () => {
        const state = table(MachineState.ActPhase, { status: PlayerStatus.Chancellor, relicIds: ['relic.grand-scepter'] }, {}, [
            testPlayer({ playerId: 'exile2', color: Color.Blue, status: PlayerStatus.Exile, siteId: 'c2' })
        ])
        state.getPlayerState(CHANCELLOR).status = PlayerStatus.Exile
        state.chancellorPlayerId = ME
        state.reliquary = state.reliquary.map((slot, index) => ({ ...slot, cardId: `relic.fixture-${index}` }))
        state.getPlayerState(CHANCELLOR).relicIds = ['relic.cup-of-plenty']
        state.banners[Banner.DarkestSecret] = { value: 1, holderPlayerId: ME }
        const session = opened(state)
        session.chooseAction(ActionType.OfferCitizenship)
        return session
    }
    const offering = () => offeringIn().citizenship
    const [SLOT_A, SLOT_B] = ['reliquary.0', 'reliquary.1']

    it('a refusal of the terms names the Exile, and the offerer reads “you”', () => {
        const session = offeringIn()
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

    it('choosing the Exile clears the relic space and terms chosen for the last one', () => {
        const offer = offering()
        offer.chooseExile(CHANCELLOR)
        offer.chooseReliquarySlot(SLOT_A)
        offer.setTerm('givenFavor', 1)
        expect(offer.offerTerms.givenFavor).toBe(1)

        offer.chooseExile('exile2')
        expect(offer.reliquarySlotId).toBeUndefined()
        expect(offer.offerTerms.givenFavor).toBe(0)
    })

    it('Back takes the terms, then the space, then the Exile', () => {
        const offer = offering()
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

    it('before any pick there is nothing for Back or Undo to take', () => {
        const offer = offering()
        expect(offer.exiles).toEqual([CHANCELLOR, 'exile2'])
        expect(offer.hasManualSelection()).toBe(false)
    })

    it('a space is chosen only after an Exile, and terms only after a space', () => {
        const offer = offering()
        offer.chooseReliquarySlot(SLOT_A)
        offer.setTerm('givenFavor', 1)
        expect(offer.hasManualSelection()).toBe(false)
    })

    it('choosing another space clears the terms under it', () => {
        const offer = offering()
        offer.chooseExile(CHANCELLOR)
        offer.chooseReliquarySlot(SLOT_A)
        offer.setTerm('askedFavor', 2)
        offer.chooseReliquarySlot(SLOT_B)
        expect(offer.reliquarySlotId).toBe(SLOT_B)
        expect(offer.offerTerms.askedFavor).toBe(0)
    })
    it('R-6.6.1 — terms may carry held relics and banners each way, and only held ones', () => {
        const offer = offering()
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
})

/** R-6.6.2 — which warbands become Imperial, one entry for every group. */
describe('the Citizenship replacement draft (docs/user-interactions.md)', () => {
    const answering = () => {
        const state = table(MachineState.ActPhase)
        state.pendingConsent = {
            request: { kind: ConsentRequestKind.CitizenshipOffer, exilePlayerId: ME, reliquarySlotId: 'reliquary.0' },
            askingPlayerId: CHANCELLOR,
            askedPlayerId: ME
        }
        state.activePlayerIds = [ME]
        return opened(state).consent
    }

    it('a count on one group keeps the counts on the others', () => {
        const consent = answering()
        expect(consent.mustChoose).toBe(true)
        consent.setPicked(0, 0)
        consent.setPicked(1, 1)
        expect(consent.picked).toEqual([0, 1])
    })

    it('Back clears every count at once, and the default returns', () => {
        const consent = answering()
        const fallback = consent.picked
        consent.setPicked(0, 0)
        expect(consent.back()).toBe(true)
        expect(consent.picked).toEqual(fallback)
        expect(consent.back()).toBe(false)
    })

    it('the default fill is not a pick', () => {
        const consent = answering()
        expect(consent.pickedTotal).toBe(1)
        expect(consent.hasManualSelection()).toBe(false)
    })

    it('a count is held to its group', () => {
        const consent = answering()
        consent.setPicked(0, 9)
        expect(consent.picked[0]).toBeLessThanOrEqual(consent.groups[0].count)
    })

    it('recounting a group replaces its count only', () => {
        const consent = answering()
        consent.setPicked(0, 1)
        consent.setPicked(1, 0)
        consent.setPicked(0, 0)
        expect(consent.picked).toEqual([0, 0])
    })
})

/** R-4.3.5, R-4.3-H1 — from the turn-flow revision, a row per usable power and a button per bank. */
describe('the Rest panel’s rows (turn-flow revision)', () => {
    const resting = (favorBank: Partial<Record<Suit, number>> = {}) =>
        opened(
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
    const row = (session: ReturnType<typeof resting>, cardId: string) =>
        required(session.rest.rows.find((r) => r.cardId === cardId), `${cardId} has a row`)

    it('lists every bank a power can name in the board’s order, an empty one not tappable', () => {
        const session = resting()
        expect(session.rest.turnFlow).toBe(true)
        const banks = required(row(session, OBEDIENCE).banks, 'Vow of Obedience names banks')
        expect(banks.map((bank) => bank.suit)).toEqual([...FAVOR_BANK_ORDER])
        expect(banks.find((bank) => bank.suit === Suit.Discord)).toEqual({ suit: Suit.Discord, inBank: 0, takes: 0, enabled: false })
        expect(banks.filter((bank) => bank.enabled)).toHaveLength(5)
    })

    it('names no more favor on a bank’s button than the bank holds (Vow of Poverty)', () => {
        const session = opened(table(MachineState.RestPhase, { favor: 0, advisers: [{ cardId: POVERTY, faceUp: true }] }, { oathRevision: OathRevision.TurnFlow, favorBank: { arcane: 3, beast: 2, discord: 0, hearth: 4, nomad: 1, order: 3 } }))
        const banks = required(row(session, POVERTY).banks, 'Vow of Poverty names banks')
        expect(banks.find((bank) => bank.suit === Suit.Nomad)?.takes).toBe(1)
        expect(banks.find((bank) => bank.suit === Suit.Hearth)?.takes).toBe(2)
    })

    it('lists only the banks matching a card at the site for Silver Tongue', () => {
        const banks = required(row(resting(), SILVER_TONGUE).banks, 'Silver Tongue names banks')
        expect(banks.map((bank) => bank.suit).sort()).toEqual([Suit.Beast, Suit.Hearth].sort())
    })

    it('a tap on a bank uses the power with it, with nothing else to press', async () => {
        const session = resting()
        const sent = vi.spyOn(session, 'useRestPower').mockResolvedValue()
        await session.rest.useWithBank(row(session, OBEDIENCE), Suit.Hearth)
        expect(sent).toHaveBeenCalledWith(OBEDIENCE, row(session, OBEDIENCE).powerIndex, [{ kind: PowerChoiceKind.FavorBank, suit: Suit.Hearth }])
    })

    it('a power used this turn stays as a dimmed line saying what it did', () => {
        const state = table(MachineState.RestPhase, { advisers: [{ cardId: OBEDIENCE, faceUp: true }, { cardId: INSOMNIA, faceUp: true }] }, { oathRevision: OathRevision.TurnFlow })
        state.getPlayerState(ME).restPowersUsedThisTurn = [powerKey(INSOMNIA, powerIndexOf(INSOMNIA, PowerTiming.Rest))]
        const used: UseRestPower = { id: 'a0', gameId: state.gameId, source: ActionSource.User, type: ActionType.UseRestPower, playerId: ME, index: 0, cardId: INSOMNIA, powerIndex: powerIndexOf(INSOMNIA, PowerTiming.Rest), metadata: { summary: 'Insomnia: gained 1 secret' } }
        const rows = restRows(state, ME, [used])
        expect(rows.map((r) => [r.cardId, r.used])).toEqual([[OBEDIENCE, undefined], [INSOMNIA, 'used: gained 1 secret']])
    })

    it('keeps today’s panel in a game created before the revision', () => {
        const session = opened(table(MachineState.RestPhase, { advisers: [{ cardId: OBEDIENCE, faceUp: true }] }))
        expect(session.rest.turnFlow).toBe(false)
    })
})
