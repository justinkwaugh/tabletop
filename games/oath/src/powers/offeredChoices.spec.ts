import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, PlayerStatus, Suit } from '../model/oathEnums.js'
import { cardPower, PowerTiming, powerIndexOf, type CardPower } from '../data/cardPowers.js'
import { required } from '../testing/required.js'
import { testBanners, testPlayer, testState } from '../testing/fixture.js'
import {
    legalChoices,
    offeredChoices,
    PowerChoiceKind,
    reasonChoicesInvalid
} from '../util/powerChoice.js'
import { effectFor } from './registry.js'
import type { OathProjectedState } from '../model/gameState.js'
import './index.js'

function powerOf(cardId: string, timing: PowerTiming): CardPower {
    return required(cardPower(cardId, powerIndexOf(cardId, timing)), cardId)
}

function reasonCannotResolve(
    state: ReturnType<typeof table>,
    of: CardPower,
    choices: { kind: PowerChoiceKind.Yes }[]
): string | undefined {
    return effectFor(of)?.reasonCannotResolve?.({ state, playerId: 'dana', power: of, choices })
}

const ALCHEMIST = powerOf('denizen.arcane.alchemist', PowerTiming.Action)
const MEMORY = powerOf('denizen.beast.memory-of-nature', PowerTiming.Action)
const VAULT = powerOf('denizen.arcane.forgotten-vault', PowerTiming.Action)
const GIANT = powerOf('denizen.nomad.mountain-giant', PowerTiming.BattlePlan)
const BRACKEN = powerOf('denizen.beast.bracken', PowerTiming.Modifier)
const HEIR = powerOf('denizen.beast.long-lost-heir', PowerTiming.WhenPlayed)
const BEWITCH = powerOf('denizen.arcane.bewitch', PowerTiming.WhenPlayed)
const AMBITIONS = powerOf('denizen.discord.royal-ambitions', PowerTiming.WhenPlayed)
const PACT = powerOf('denizen.nomad.ancient-pact', PowerTiming.WhenPlayed)

const BANKS: Record<Suit, number> = {
    [Suit.Discord]: 2,
    [Suit.Arcane]: 2,
    [Suit.Order]: 4,
    [Suit.Hearth]: 3,
    [Suit.Beast]: 1,
    [Suit.Nomad]: 0
}

/**
 * Dana, an Exile, at the first Cradle site with 3 secrets; Rhys the Chancellor at the second.
 * Three Beast cards are on the map. `over` changes the table.
 */
function table(
    dana: Partial<Parameters<typeof testPlayer>[0]> = {},
    over: Partial<OathProjectedState> = {}
) {
    return testState(
        [
            testPlayer({ playerId: 'dana', color: Color.Red, siteId: 'c1', secrets: 3, ...dana }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c2',
                secrets: 1
            })
        ],
        {
            chancellorPlayerId: 'rhys',
            favorBank: BANKS,
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.mountain' },
            denizensBySite: {
                c1: ['denizen.beast.wolves', 'denizen.beast.rangers'],
                c2: ['denizen.beast.birdsong']
            },
            warbandsBySite: { c1: { dana: 2 } },
            ...over
        }
    )
}

const options = (cardPower: CardPower, state = table()) =>
    offeredChoices(state, 'dana', cardPower).map((legal) => legal.options)

describe('a run of favor picks: the banks it may name and what it comes to', () => {
    it('Alchemist: every bank, four together', () => {
        const offered = offeredChoices(table(), 'dana', ALCHEMIST)
        expect(offered).toHaveLength(4)
        for (const legal of offered) {
            expect(legal.total).toBe(4)
            expect(legal.options).toHaveLength(6)
        }
    })

    it('Alchemist: all the banks hold when they hold fewer than four', () => {
        const scarce = { ...BANKS, [Suit.Order]: 0, [Suit.Hearth]: 0, [Suit.Arcane]: 0 }
        const [legal] = offeredChoices(table({}, { favorBank: scarce }), 'dana', ALCHEMIST)
        expect(legal?.total).toBe(3)
    })

    it('Memory of Nature: never the Beast bank; X, the Beast cards on the map', () => {
        const offered = offeredChoices(table(), 'dana', MEMORY)
        // A pick per favor the map's cards could hold: 8 slots of at most 3.
        expect(offered).toHaveLength(24)
        for (const legal of offered) {
            expect(legal.total).toBe(3)
            expect(legal.options).not.toContainEqual({ kind: PowerChoiceKind.FavorBank, suit: Suit.Beast })
            expect(legal.options).toHaveLength(5)
        }
    })

    it('Memory of Nature: all the other banks hold when they hold fewer than X', () => {
        const scarce = { ...BANKS, [Suit.Order]: 0, [Suit.Hearth]: 0, [Suit.Arcane]: 0, [Suit.Discord]: 1 }
        const [legal] = offeredChoices(table({}, { favorBank: scarce }), 'dana', MEMORY)
        expect(legal?.total).toBe(1)
    })

    it('reads no total for a power without a run', () => {
        expect(offeredChoices(table(), 'dana', BRACKEN).map((legal) => legal.total)).toEqual([undefined, undefined])
    })
})

describe('the "or": its second branch, marked; offered only while it does anything', () => {
    it('Forgotten Vault, Mountain Giant and Bracken mark their yes as the second branch', () => {
        for (const cardPower of [VAULT, GIANT, BRACKEN]) {
            const yes = legalChoices(table(), 'dana', cardPower).find((legal) => legal.spec.kind === PowerChoiceKind.Yes)
            expect(yes?.spec.or).toBe(true)
        }
        for (const cardPower of [HEIR, BEWITCH, AMBITIONS, PACT]) {
            const yes = legalChoices(table(), 'dana', cardPower).find((legal) => legal.spec.kind === PowerChoiceKind.Yes)
            expect(yes?.spec.or).toBeUndefined()
        }
    })

    it('Forgotten Vault: Burn is offered while the Darkest Secret holds more than its last secret', () => {
        const three = table({}, { banners: testBanners({ [Banner.DarkestSecret]: 'rhys' }, 3) })
        expect(options(VAULT, three)).toEqual([[{ kind: PowerChoiceKind.Yes }]])
        const last = table({}, { banners: testBanners({ [Banner.DarkestSecret]: 'rhys' }, 1) })
        expect(options(VAULT, last)).toEqual([[]])
    })

    it('the doorway still judges a Burn sent at the last secret as before', () => {
        const last = table({}, { banners: testBanners({ [Banner.DarkestSecret]: 'rhys' }, 1) })
        expect(reasonChoicesInvalid(last, 'dana', VAULT, [{ kind: PowerChoiceKind.Yes }])).toBeUndefined()
        expect(legalChoices(last, 'dana', VAULT)[0]?.options).toEqual([{ kind: PowerChoiceKind.Yes }])
    })
})

describe('the "may": offered only when the card would let the seat take it', () => {
    const yes = [{ kind: PowerChoiceKind.Yes }]

    it('Long-Lost Heir: to an Exile, never to a Citizen or the Chancellor', () => {
        expect(options(HEIR)).toEqual([yes])
        expect(options(HEIR, table({ status: PlayerStatus.Citizen }))).toEqual([[]])
    })

    it('Bewitch: to an Exile with more secrets than the Chancellor', () => {
        expect(options(BEWITCH)).toEqual([yes])
        expect(options(BEWITCH, table({ secrets: 1 }))).toEqual([[]])
        expect(options(BEWITCH, table({ status: PlayerStatus.Citizen }))).toEqual([[]])
    })

    it('Royal Ambitions: the yes and its relic to an Exile who rules more sites than the Chancellor', () => {
        const reliquary = { reliquary: [{ slotId: 'reliquary.0' }, { slotId: 'reliquary.1' }] }
        const ruling = table({}, reliquary)
        const [offeredYes, relics] = options(AMBITIONS, ruling)
        expect(offeredYes).toEqual(yes)
        expect(relics).toHaveLength(2)
        const ruled = table({}, { ...reliquary, warbandsBySite: {} })
        expect(options(AMBITIONS, ruled)).toEqual([[], []])
    })

    it('Ancient Pact: the yes and its relic to an Exile who holds the Darkest Secret', () => {
        const reliquary = { reliquary: [{ slotId: 'reliquary.0' }] }
        const holds = table({}, { ...reliquary, banners: testBanners({ [Banner.DarkestSecret]: 'dana' }) })
        expect(options(PACT, holds)).toEqual([yes, [{ kind: PowerChoiceKind.RelicSlot, slotId: 'reliquary.0' }]])
        expect(options(PACT, table({}, reliquary))).toEqual([[], []])
    })

    it('a yes sent where it is not offered is refused for the reason it was before', () => {
        const citizen = table({ status: PlayerStatus.Citizen })
        expect(reasonCannotResolve(citizen, HEIR, [{ kind: PowerChoiceKind.Yes }])).toBe(
            'only an Exile can become a Citizen'
        )
        expect(
            reasonCannotResolve(table({ secrets: 1 }), BEWITCH, [{ kind: PowerChoiceKind.Yes }])
        ).toBe("you have 1 secrets, not more than the Chancellor's 1")
    })
})
