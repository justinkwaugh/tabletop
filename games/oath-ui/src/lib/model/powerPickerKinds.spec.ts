import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    Banner,
    PlayerStatus,
    PowerChoiceKind,
    PowerTiming,
    SearchPlay,
    Suit,
    cardPower,
    offeredChoices,
    powerIndexOf,
    type CardPower,
    type OathProjectedState
} from '@tabletop/oath'
import { required, testBanners, testPlayer, testState } from '@tabletop/oath/testing'
import {
    FIRST_BRANCH,
    NO_OPTION,
    asked,
    bankRuns,
    emptyPicks,
    isMay,
    isOr,
    openRunBanks,
    optionIndexOf,
    picksComplete,
    powerChoicesFrom,
    runCeilingAt,
    runSuits,
    withBranch,
    withMay,
    withOptionPick,
    withRunCount,
    withRunToggled,
    type BankRun
} from './powerChoices.js'
import { whenPlayedChoices } from './whenPlayed.js'

function powerOf(cardId: string, timing: PowerTiming): CardPower {
    return required(cardPower(cardId, powerIndexOf(cardId, timing)), cardId)
}

const ALCHEMIST = powerOf('denizen.arcane.alchemist', PowerTiming.Action)
const MEMORY = powerOf('denizen.beast.memory-of-nature', PowerTiming.Action)
const SALAD = powerOf('denizen.hearth.salad-days', PowerTiming.WhenPlayed)
const VAULT = powerOf('denizen.arcane.forgotten-vault', PowerTiming.Action)
const GIANT = powerOf('denizen.nomad.mountain-giant', PowerTiming.BattlePlan)
const AMBITIONS = powerOf('denizen.discord.royal-ambitions', PowerTiming.WhenPlayed)

const BANKS: Record<Suit, number> = {
    [Suit.Discord]: 2,
    [Suit.Arcane]: 2,
    [Suit.Order]: 4,
    [Suit.Hearth]: 3,
    [Suit.Beast]: 1,
    [Suit.Nomad]: 0
}

/** Rhys, an Exile, at the first Cradle site, ruling it; Dana the Chancellor; three Beast cards on the map. */
function table(rhys: Partial<Parameters<typeof testPlayer>[0]> = {}, over: Partial<OathProjectedState> = {}) {
    return testState(
        [
            testPlayer({ playerId: 'rhys', color: Color.Red, siteId: 'c1', secrets: 3, ...rhys }),
            testPlayer({ playerId: 'dana', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c2' })
        ],
        {
            chancellorPlayerId: 'dana',
            favorBank: BANKS,
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.mountain' },
            denizensBySite: { c1: ['denizen.beast.wolves', 'denizen.beast.rangers'], c2: ['denizen.beast.birdsong'] },
            warbandsBySite: { c1: { rhys: 2 } },
            reliquary: [{ slotId: 'reliquary.0' }, { slotId: 'reliquary.1' }],
            ...over
        }
    )
}

const offered = (power: CardPower, state = table()) => offeredChoices(state, 'rhys', power)

function onlyRun(runs: BankRun[]): BankRun {
    const [run, ...rest] = runs
    expect(rest).toEqual([])
    return required(run, 'the choices make a run')
}

describe('R-7.1.3 — a run of favor picks: a favor row per bank, held to the card’s total', () => {
    it('Alchemist: four picks counted together, four in all', () => {
        const choices = offered(ALCHEMIST)
        expect(onlyRun(bankRuns(choices))).toEqual({ specs: [0, 1, 2, 3], distinct: false, total: 4 })
    })

    it('Memory of Nature: X (the Beast cards on the map), and no Beast bank to take from', () => {
        const choices = offered(MEMORY)
        const run = onlyRun(bankRuns(choices))
        expect(run.total).toBe(3)
        expect(choices[0]?.options).not.toContainEqual({ kind: PowerChoiceKind.FavorBank, suit: Suit.Beast })
    })

    it('a bank’s row is held to what it holds and what the total leaves; Use waits for the total', () => {
        const choices = offered(ALCHEMIST)
        const run = onlyRun(bankRuns(choices))
        let picks = withRunCount(run, choices, emptyPicks(), Suit.Order, 3, BANKS[Suit.Order])
        expect(runSuits(run, choices, picks)).toEqual([Suit.Order, Suit.Order, Suit.Order])
        expect(picksComplete(choices, picks)).toBe(false)
        expect(runCeilingAt(run, runSuits(run, choices, picks), Suit.Hearth, BANKS[Suit.Hearth])).toBe(1)
        picks = withRunCount(run, choices, picks, Suit.Hearth, 3, BANKS[Suit.Hearth])
        expect(runSuits(run, choices, picks)).toEqual([Suit.Order, Suit.Order, Suit.Order, Suit.Hearth])
        expect(picksComplete(choices, picks)).toBe(true)
    })

    it('sends one bank per favor, in the board’s bank order, the first to the first spec', () => {
        const choices = offered(ALCHEMIST)
        const run = onlyRun(bankRuns(choices))
        let picks = withRunCount(run, choices, emptyPicks(), Suit.Hearth, 1, BANKS[Suit.Hearth])
        picks = withRunCount(run, choices, picks, Suit.Discord, 2, BANKS[Suit.Discord])
        picks = withRunCount(run, choices, picks, Suit.Arcane, 1, BANKS[Suit.Arcane])
        expect(powerChoicesFrom(choices, picks)).toEqual(
            [Suit.Discord, Suit.Discord, Suit.Arcane, Suit.Hearth].map((suit) => ({ kind: PowerChoiceKind.FavorBank, suit }))
        )
    })

    it('a total over what a bank holds is kept to it; a count set to none frees the rest', () => {
        const choices = offered(MEMORY)
        const run = onlyRun(bankRuns(choices))
        let picks = withRunCount(run, choices, emptyPicks(), Suit.Discord, 5, BANKS[Suit.Discord])
        expect(runSuits(run, choices, picks)).toEqual([Suit.Discord, Suit.Discord])
        picks = withRunCount(run, choices, picks, Suit.Discord, 0, BANKS[Suit.Discord])
        expect(runSuits(run, choices, picks)).toEqual([])
    })
})

describe('Salad Days — one row of the banks, three different, an empty one shut while three hold favor', () => {
    it('is a distinct run of three; three taps fill it, a fourth changes nothing, a tap on a picked one frees it', () => {
        const choices = offered(SALAD)
        const run = onlyRun(bankRuns(choices))
        expect(run).toEqual({ specs: [0, 1, 2], distinct: true, total: 3 })
        let picks = [Suit.Hearth, Suit.Discord, Suit.Order].reduce((p, suit) => withRunToggled(run, choices, p, suit), emptyPicks())
        expect(runSuits(run, choices, picks)).toEqual([Suit.Discord, Suit.Order, Suit.Hearth])
        expect(picksComplete(choices, picks)).toBe(true)
        expect(withRunToggled(run, choices, picks, Suit.Arcane)).toBe(picks)
        picks = withRunToggled(run, choices, picks, Suit.Order)
        expect(runSuits(run, choices, picks)).toEqual([Suit.Discord, Suit.Hearth])
        expect(picksComplete(choices, picks)).toBe(false)
    })

    it('an empty bank is shut while three banks hold favor, and open when fewer do', () => {
        const choices = offered(SALAD)
        const run = onlyRun(bankRuns(choices))
        const all = [Suit.Discord, Suit.Arcane, Suit.Order, Suit.Hearth, Suit.Beast, Suit.Nomad]
        expect(openRunBanks(run, all, [], BANKS)).toEqual([Suit.Discord, Suit.Arcane, Suit.Order, Suit.Hearth, Suit.Beast])
        const two = { ...BANKS, [Suit.Discord]: 0, [Suit.Arcane]: 0, [Suit.Beast]: 0 }
        expect(openRunBanks(run, all, [], two)).toEqual(all)
    })

    // Revision 8: "while fewer than three banks hold favor, every bank that holds favor must be named".
    it('with two banks holding favor, one empty bank fills the third and no more, so three empty banks are never picked', () => {
        const two = { ...BANKS, [Suit.Discord]: 0, [Suit.Arcane]: 0, [Suit.Beast]: 0 }
        const choices = offered(SALAD, table({}, { favorBank: two }))
        const run = onlyRun(bankRuns(choices))
        const all = [Suit.Discord, Suit.Arcane, Suit.Order, Suit.Hearth, Suit.Beast, Suit.Nomad]
        const oneEmpty = withRunToggled(run, choices, emptyPicks(), Suit.Discord)
        expect(openRunBanks(run, all, runSuits(run, choices, oneEmpty), two)).toEqual([Suit.Order, Suit.Hearth])
        // Tapping the empty banks first, each only while it is open, still names both banks that hold favor.
        const tapped = [Suit.Discord, Suit.Arcane, Suit.Beast, Suit.Nomad, Suit.Order, Suit.Hearth].reduce(
            (picks, suit) =>
                openRunBanks(run, all, runSuits(run, choices, picks), two).includes(suit)
                    ? withRunToggled(run, choices, picks, suit)
                    : picks,
            emptyPicks()
        )
        expect(runSuits(run, choices, tapped)).toEqual([Suit.Discord, Suit.Order, Suit.Hearth])
        expect(picksComplete(choices, tapped)).toBe(true)
    })

    it('with no bank holding favor, any three are named', () => {
        const none = { ...BANKS, [Suit.Order]: 0, [Suit.Hearth]: 0, [Suit.Discord]: 0, [Suit.Arcane]: 0, [Suit.Beast]: 0 }
        const choices = offered(SALAD, table({}, { favorBank: none }))
        const run = onlyRun(bankRuns(choices))
        const all = [Suit.Discord, Suit.Arcane, Suit.Order, Suit.Hearth, Suit.Beast, Suit.Nomad]
        const twoEmpty = [Suit.Discord, Suit.Arcane].reduce((p, suit) => withRunToggled(run, choices, p, suit), emptyPicks())
        expect(openRunBanks(run, all, runSuits(run, choices, twoEmpty), none)).toEqual([Suit.Order, Suit.Hearth, Suit.Beast, Suit.Nomad])
    })
})

describe('a card’s "or": two answers, neither picked; the one legal starts picked', () => {
    it('Mountain Giant: nothing picked, the plan waits; ±1 sends no yes, ±3 sends it', () => {
        const choices = offered(GIANT)
        expect(isOr(choices[0])).toBe(true)
        expect(optionIndexOf(required(choices[0], 'the or'), 0, emptyPicks())).toBe(NO_OPTION)
        expect(picksComplete(choices, emptyPicks())).toBe(false)
        const one = withBranch(emptyPicks(), 0, false)
        expect(picksComplete(choices, one)).toBe(true)
        expect(powerChoicesFrom(choices, one)).toEqual([])
        expect(powerChoicesFrom(choices, withBranch(one, 0, true))).toEqual([{ kind: PowerChoiceKind.Yes }])
    })

    it('Forgotten Vault at the Darkest Secret’s last secret: Burn is not offered, so Place starts picked', () => {
        const last = table({}, { banners: testBanners({ [Banner.DarkestSecret]: 'dana' }, 1) })
        const choices = offered(VAULT, last)
        expect(choices[0]?.options).toEqual([])
        expect(optionIndexOf(required(choices[0], 'the or'), 0, emptyPicks())).toBe(FIRST_BRANCH)
        expect(picksComplete(choices, emptyPicks())).toBe(true)
        expect(powerChoicesFrom(choices, emptyPicks())).toEqual([])
    })

    it('Forgotten Vault with more secrets: both answers, neither picked', () => {
        const three = table({}, { banners: testBanners({ [Banner.DarkestSecret]: 'dana' }, 3) })
        const choices = offered(VAULT, three)
        expect(choices[0]?.options).toEqual([{ kind: PowerChoiceKind.Yes }])
        expect(picksComplete(choices, emptyPicks())).toBe(false)
    })
})

describe('a card’s "may": a toggle, off; what only its yes asks for waits while it is on', () => {
    it('Royal Ambitions: off sends nothing; on, Play waits for a relic; off again takes the relic back', () => {
        const choices = offered(AMBITIONS)
        expect(isMay(choices[0])).toBe(true)
        expect(asked(choices, 1, emptyPicks())).toBe(false)
        expect(picksComplete(choices, emptyPicks())).toBe(true)
        expect(powerChoicesFrom(choices, emptyPicks())).toEqual([])

        const on = withMay(choices, emptyPicks(), 0, true)
        expect(asked(choices, 1, on)).toBe(true)
        expect(picksComplete(choices, on)).toBe(false)
        const relic = withOptionPick(on, required(choices[1], 'the relic'), 1, 1)
        expect(picksComplete(choices, relic)).toBe(true)
        expect(powerChoicesFrom(choices, relic)).toEqual([
            { kind: PowerChoiceKind.Yes },
            { kind: PowerChoiceKind.RelicSlot, slotId: 'reliquary.1' }
        ])

        const off = withMay(choices, relic, 0, false)
        expect(off.option).toEqual({})
        expect(powerChoicesFrom(choices, off)).toEqual([])
    })

    it('when the card does not offer its yes, the When Played step asks nothing', () => {
        const citizen = table({ status: PlayerStatus.Citizen })
        expect(whenPlayedChoices(citizen, 'rhys', AMBITIONS.cardId, SearchPlay.Adviser, true)).toEqual([])
        const fewer = table({}, { warbandsBySite: {} })
        expect(whenPlayedChoices(fewer, 'rhys', AMBITIONS.cardId, SearchPlay.Adviser, true)).toEqual([])
        expect(whenPlayedChoices(table(), 'rhys', AMBITIONS.cardId, SearchPlay.Adviser, true)).toHaveLength(2)
        expect(
            whenPlayedChoices(citizen, 'rhys', 'denizen.beast.long-lost-heir', SearchPlay.Adviser, true)
        ).toEqual([])
    })
})
