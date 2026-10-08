import { describe, expect, it } from 'vitest'
import { machineContext } from '../testing/actions.js'
import { Color, assert, assertExists } from '@tabletop/common'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { MachineState } from '../definition/states.js'
import { ActPhaseStateHandler } from '../stateHandlers/actPhase.js'
import { Banner, CardKind, PlayerStatus, Suit } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { legalChoices, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { cardPowers, PowerTiming, powerIndexOf, registerCardPowers } from '../data/cardPowers.js'
import { registerCards } from '../data/cardRegistry.js'
import '../powers/index.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import { PowerQuestionKind, RerolledRollKind } from '../model/question.js'
import { answerQuestion } from '../testing/steps.js'
import { actionPowerUse, bank, boardWarbands, card, player, site, siteWarbands } from '../testing/choices.js'
import { OathVisibility } from '../definition/runtime.js'
import { spectator } from '../testing/projection.js'

const JINX = 'denizen.arcane.jinx'

/** An Action power with a cost and no effect, so the doorway's last refusal is reached. */
const UNBUILT = 'denizen.test.unbuilt'
registerCards([{ id: UNBUILT, name: 'Unbuilt', kind: CardKind.Denizen, suit: Suit.Nomad }])
registerCardPowers(UNBUILT, [
    {
        cardId: UNBUILT,
        powerIndex: 0,
        timing: PowerTiming.Action,
        text: 'Action: nothing yet.',
        cost: { placeFavor: 2, burnFavor: 0, placeSecret: 0, burnSecret: 1 }
    }
])

function boardNoTurn(cards: string[], over: Record<string, Record<string, unknown>> = {}) {
    return testState(
        [
            testPlayer({
                playerId: 'ruler',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 3,
                warbandsOnBoard: { ruler: 2 },
                warbandsInPersonalBank: { ruler: 5 },
                ...over['ruler']
            }),
            testPlayer({
                playerId: 'other',
                color: Color.Blue,
                siteId: 'c1',
                favor: 2,
                secrets: 2,
                warbandsOnBoard: { other: 2 },
                warbandsInPersonalBank: { other: 5 },
                ...over['other']
            }),
            testPlayer({ playerId: 'away', color: Color.Yellow, siteId: 'h1', favor: 1, secrets: 3, ...over['away'] })
        ],
        {
            denizensBySite: { c1: cards, c2: [], h1: [] },
            warbandsBySite: { c1: { ruler: 1 }, c2: { other: 3, ruler: 1 } },
            siteCards: { c1: 'site.mine', c2: 'site.river', p1: 'site.plains', h1: 'site.wastes' }
        }
    )
}

/** The ruler is on turn: R-7.1.2.a routes an out-of-turn payment elsewhere. */
function board(cards: string[], over: Record<string, Record<string, unknown>> = {}) {
    const s = boardNoTurn(cards, over)
    openTurn(s, 'ruler')
    return s
}

describe('Hearth', () => {
    it('Wayside Inn — gains 2 Supply, capped at the track, and pays its favor onto the card', () => {
        const s = board(['denizen.hearth.wayside-inn'])
        const a = actionPowerUse('ruler', 'denizen.hearth.wayside-inn')
        a.apply(s)
        expect(s.getPlayerState('ruler').supply).toBe(5)
        expect(s.getPlayerState('ruler').favor).toBe(2)
        expect(s.tokensOn('denizen.hearth.wayside-inn').favor).toBe(1)
        expect(a.metadata?.summary).toMatch(/gained 2 Supply/)
        expect(a.revealsInfo).toBe(false)
    })

    it('Storyteller — places a secret on the Darkest Secret', () => {
        const s = board(['denizen.hearth.storyteller'])
        actionPowerUse('ruler', 'denizen.hearth.storyteller').apply(s)
        expect(s.banners[Banner.DarkestSecret].value).toBe(2)
    })

    it('Charming Friend — takes a favor from a player at your site, as much as they have', () => {
        const s = board(['denizen.hearth.charming-friend'])
        actionPowerUse('ruler', 'denizen.hearth.charming-friend', [player('other')]).apply(s)
        expect(s.getPlayerState('other').favor).toBe(1)
        expect(s.getPlayerState('ruler').favor).toBe(4)
        expect(s.getPlayerState('ruler').secrets).toBe(1)
        expect(s.tokensOn('denizen.hearth.charming-friend').secrets).toBe(1)

        const broke = board(['denizen.hearth.charming-friend'], { other: { favor: 0 } })
        const a = actionPowerUse('ruler', 'denizen.hearth.charming-friend', [player('other')])
        a.apply(broke)
        expect(a.metadata?.summary).toMatch(/took 0 favor/)
    })

    it('Charming Friend — a player elsewhere is not among the options', () => {
        const s = board(['denizen.hearth.charming-friend'])
        expect(() => actionPowerUse('ruler', 'denizen.hearth.charming-friend', [player('away')]).apply(s)).toThrow(
            /away is not among the options for a player at your site/
        )
    })
})

describe('Arcane', () => {
    it('Tutor — gains a secret, paying a favor and a secret onto the card', () => {
        const s = board(['denizen.arcane.tutor'])
        actionPowerUse('ruler', 'denizen.arcane.tutor').apply(s)
        expect(s.getPlayerState('ruler').secrets).toBe(2)
        expect(s.tokensOn('denizen.arcane.tutor')).toEqual({ favor: 1, secrets: 1 })
    })

    it('Spirit Snare — takes one favor from the chosen bank', () => {
        const s = board(['denizen.arcane.spirit-snare'])
        actionPowerUse('ruler', 'denizen.arcane.spirit-snare', [bank(Suit.Beast)]).apply(s)
        expect(s.favorBank[Suit.Beast]).toBe(2)
        expect(s.getPlayerState('ruler').favor).toBe(4)
        expect(s.getPlayerState('ruler').secrets).toBe(1)
    })

    it('Alchemist — four favor from any banks, a bank repeatable; fewer only when the banks run dry', () => {
        const s = board(['denizen.arcane.alchemist'])
        actionPowerUse('ruler', 'denizen.arcane.alchemist', [bank(Suit.Beast), bank(Suit.Beast), bank(Suit.Nomad), bank(Suit.Order)]).apply(s)
        expect(s.favorBank[Suit.Beast]).toBe(1)
        expect(s.getPlayerState('ruler').favor).toBe(7)
        expect(s.getPlayerState('ruler').secrets).toBe(0)

        // R-7.1.3 — "gain four" is not "gain up to four" while the banks still hold favor.
        const two = board(['denizen.arcane.alchemist'])
        expect(() => actionPowerUse('ruler', 'denizen.arcane.alchemist', [bank(Suit.Beast), bank(Suit.Nomad)]).apply(two)).toThrow(
            /yield 2, and 4 can be had/
        )
        expect(() =>
            actionPowerUse('ruler', 'denizen.arcane.alchemist', [bank(Suit.Beast), bank(Suit.Beast), bank(Suit.Beast), bank(Suit.Beast)]).apply(two)
        ).toThrow(/yield 3, and 4 can be had/)
        const dry = board(['denizen.arcane.alchemist'])
        for (const suit of Object.values(Suit)) dry.favorBank[suit] = 0
        dry.favorBank[Suit.Beast] = 1
        dry.favorBank[Suit.Nomad] = 1
        const a = actionPowerUse('ruler', 'denizen.arcane.alchemist', [bank(Suit.Beast), bank(Suit.Nomad)])
        a.apply(dry)
        expect(a.metadata?.summary).toMatch(/gained 2 favor/)
    })

    it('Wizard School — gains a secret and ends the Act Phase through the handler', () => {
        const s = board(['denizen.arcane.wizard-school'])
        const a = actionPowerUse('ruler', 'denizen.arcane.wizard-school')
        a.apply(s)
        expect(s.getPlayerState('ruler').secrets).toBe(3)
        expect(a.metadata?.endsActPhase).toBe(true)
        expect(new ActPhaseStateHandler().onAction(a, machineContext(s))).toBe(MachineState.RestPhase)
    })

    it('Forgotten Vault — places by default, burns on a yes, never below the floor', () => {
        const place = board(['denizen.arcane.forgotten-vault'])
        actionPowerUse('ruler', 'denizen.arcane.forgotten-vault').apply(place)
        expect(place.banners[Banner.DarkestSecret].value).toBe(2)

        const burn = board(['denizen.arcane.forgotten-vault'])
        burn.banners[Banner.DarkestSecret].value = 3
        actionPowerUse('ruler', 'denizen.arcane.forgotten-vault', [{ kind: PowerChoiceKind.Yes }]).apply(burn)
        expect(burn.banners[Banner.DarkestSecret].value).toBe(2)

        const floor = board(['denizen.arcane.forgotten-vault'])
        const a = actionPowerUse('ruler', 'denizen.arcane.forgotten-vault', [{ kind: PowerChoiceKind.Yes }])
        a.apply(floor)
        expect(floor.banners[Banner.DarkestSecret].value).toBe(1)
        expect(a.metadata?.summary).toMatch(/burned 0/)
    })
})

describe('Beast', () => {
    it('Wolves — kills one warband on any board, even yours, returning it to its bank', () => {
        const s = board(['denizen.beast.wolves'])
        actionPowerUse('ruler', 'denizen.beast.wolves', [player('other')]).apply(s)
        expect(s.getPlayerState('other').warbandsOnBoard['other']).toBe(1)
        expect(s.getPlayerState('other').warbandsInPersonalBank['other']).toBe(6)

        const self = board(['denizen.beast.wolves'])
        actionPowerUse('ruler', 'denizen.beast.wolves', [player('ruler')]).apply(self)
        expect(self.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(1)

        const empty = board(['denizen.beast.wolves'], { away: { warbandsOnBoard: {} } })
        const a = actionPowerUse('ruler', 'denizen.beast.wolves', [player('away')])
        a.apply(empty)
        expect(a.metadata?.summary).toMatch(/held no warbands/)
    })
})

describe('a power that acts on one seat records it, for the History to name', () => {
    it('Wolves records the board it hit, whoever holds it, and whether or not a warband died', () => {
        const other = actionPowerUse('ruler', 'denizen.beast.wolves', [player('other')])
        other.apply(board(['denizen.beast.wolves']))
        expect(other.metadata?.targetPlayerId).toBe('other')

        const self = actionPowerUse('ruler', 'denizen.beast.wolves', [player('ruler')])
        self.apply(board(['denizen.beast.wolves']))
        expect(self.metadata?.targetPlayerId).toBe('ruler')

        const empty = actionPowerUse('ruler', 'denizen.beast.wolves', [player('away')])
        empty.apply(board(['denizen.beast.wolves'], { away: { warbandsOnBoard: {} } }))
        expect(empty.metadata?.targetPlayerId).toBe('away')
        expect(OathVisibility.actions.project(empty.dehydrate(), spectator)).toHaveProperty('metadata.targetPlayerId', 'away')
    })

    it('Sleight of Hand and Charming Friend record the player they took from', () => {
        const sleight = actionPowerUse('ruler', 'denizen.discord.sleight-of-hand', [player('other')])
        sleight.apply(board(['denizen.discord.sleight-of-hand']))
        expect(sleight.metadata?.targetPlayerId).toBe('other')

        const friend = actionPowerUse('ruler', 'denizen.hearth.charming-friend', [player('other')])
        friend.apply(board(['denizen.hearth.charming-friend']))
        expect(friend.metadata?.targetPlayerId).toBe('other')
    })

    it('a power acting on no seat records none', () => {
        const a = actionPowerUse('ruler', 'denizen.hearth.storyteller')
        a.apply(board(['denizen.hearth.storyteller']))
        expect(a.metadata?.targetPlayerId).toBeUndefined()
    })
})

describe('Discord', () => {
    it('Sleight of Hand — takes a secret from a player at your site, never their last', () => {
        const s = board(['denizen.discord.sleight-of-hand'])
        actionPowerUse('ruler', 'denizen.discord.sleight-of-hand', [player('other')]).apply(s)
        expect(s.getPlayerState('other').secrets).toBe(1)
        expect(s.getPlayerState('ruler').secrets).toBe(3)

        const last = board(['denizen.discord.sleight-of-hand'], { other: { secrets: 1 } })
        const a = actionPowerUse('ruler', 'denizen.discord.sleight-of-hand', [player('other')])
        a.apply(last)
        expect(last.getPlayerState('other').secrets).toBe(1)
        expect(a.metadata?.summary).toMatch(/took 0 secret/)

        // A facedown secret is still theirs, so the faceup one is not their last.
        const facedown = board(['denizen.discord.sleight-of-hand'], { other: { secrets: 1, secretsFacedown: 1 } })
        actionPowerUse('ruler', 'denizen.discord.sleight-of-hand', [player('other')]).apply(facedown)
        expect(facedown.getPlayerState('other').secrets).toBe(0)
        expect(facedown.getPlayerState('other').secretsFacedown).toBe(1)
    })

    it('Gambling Hall — rolls from state.prng, takes the shields from the chosen bank, and is not undoable', () => {
        const s = board(['denizen.discord.gambling-hall'], { ruler: { favor: 4 } })
        s.favorBank[Suit.Beast] = 10
        const before = s.prng.invocations
        const a = actionPowerUse('ruler', 'denizen.discord.gambling-hall', [bank(Suit.Beast)])
        a.apply(s)
        expect(s.prng.invocations).toBeGreaterThan(before)
        expect(a.revealsInfo).toBe(true)
        const m = /rolled (\d+) shields and took (\d+) favor/.exec(a.metadata?.summary ?? '')
        expect(m).not.toBeNull()
        assertExists(m, 'the summary names the roll and the take')
        const [, rolled, took] = m
        expect(Number(took)).toBe(Number(rolled))
        expect(s.favorBank[Suit.Beast]).toBe(10 - Number(took))
    })

    it('Gambling Hall — Jinx may reroll the four dice, and the favor waits on the answer', () => {
        const jinxed = () => {
            const s = board(['denizen.discord.gambling-hall'], { ruler: { favor: 4, advisers: [{ cardId: JINX, faceUp: true }] } })
            s.favorBank[Suit.Beast] = 10
            actionPowerUse('ruler', 'denizen.discord.gambling-hall', [bank(Suit.Beast)]).apply(s)
            return s
        }
        const kept = jinxed()
        expect(kept.favorBank[Suit.Beast]).toBe(10)
        const question = kept.pendingQuestions?.queue[0]
        expect(question).toMatchObject({ kind: PowerQuestionKind.RerollDice, askedPlayerId: 'ruler', roll: { kind: RerolledRollKind.GamblingHall, bank: Suit.Beast } })
        assert(question?.kind === PowerQuestionKind.RerollDice && question.roll.kind === RerolledRollKind.GamblingHall, 'a Gambling Hall reroll')
        answerQuestion(kept, 'ruler', { kind: PowerQuestionKind.RerollDice, reroll: false })
        expect(kept.favorBank[Suit.Beast]).toBe(10 - question.roll.shields)

        const rerolled = jinxed()
        const answer = answerQuestion(rerolled, 'ruler', { kind: PowerQuestionKind.RerollDice, reroll: true })
        expect(rerolled.tokensOn(JINX).secrets).toBe(1)
        expect(answer.revealsInfo).toBe(true)
        const m = /took (\d+) favor/.exec(answer.metadata?.summary ?? '')
        assertExists(m, 'the reroll settles the take')
        expect(rerolled.favorBank[Suit.Beast]).toBe(10 - Number(m[1]))
    })

    it('Assassin — discards a faceup adviser of a player at your site; the cross-check binds card to player', () => {
        const s = board(['denizen.discord.assassin'])
        s.getPlayerState('other').setAdvisers([
            { cardId: 'denizen.beast.rangers', faceUp: true },
            { cardId: 'denizen.hearth.ballot-box', faceUp: false }
        ])
        // A third player's faceup adviser is in the domain, so only the cross-check can refuse it.
        s.getPlayerState('away').siteId = 'c1'
        s.getPlayerState('away').setAdvisers([{ cardId: 'denizen.order.wrestlers', faceUp: true }])

        expect(() =>
            actionPowerUse('ruler', 'denizen.discord.assassin', [player('other'), card('denizen.hearth.ballot-box')]).apply(s)
        ).toThrow(/not among the options/)
        expect(() =>
            actionPowerUse('ruler', 'denizen.discord.assassin', [player('other'), card('denizen.order.wrestlers')]).apply(s)
        ).toThrow(/denizen.order.wrestlers is not a faceup adviser of other/)
        expect(s.tokensOn('denizen.discord.assassin').favor).toBe(0)

        actionPowerUse('ruler', 'denizen.discord.assassin', [player('other'), card('denizen.beast.rangers')]).apply(s)
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual(['denizen.hearth.ballot-box'])
        // R-10.5 — to the pile one region along from the actor (Cradle → Provinces).
        expect(s.discardPileCounts.provinces).toBe(1)
    })

    it('Assassin — a locked adviser cannot be discarded (R-7.2.2)', () => {
        const s = board(['denizen.discord.assassin'])
        s.getPlayerState('other').setAdvisers([{ cardId: 'denizen.nomad.faithful-friend', faceUp: true }])
        expect(() =>
            actionPowerUse('ruler', 'denizen.discord.assassin', [player('other'), card('denizen.nomad.faithful-friend')]).apply(s)
        ).toThrow(/not among the options/)
    })
})

describe('Nomad', () => {
    it('Elders — gains a secret for two placed favor', () => {
        const s = board(['denizen.nomad.elders'])
        actionPowerUse('ruler', 'denizen.nomad.elders').apply(s)
        expect(s.getPlayerState('ruler').secrets).toBe(3)
        expect(s.tokensOn('denizen.nomad.elders').favor).toBe(2)
    })

    it('Resettle — moves a faceup Nomad adviser of any player to a site with room', () => {
        const s = board(['denizen.nomad.resettle'])
        s.getPlayerState('away').setAdvisers([{ cardId: 'denizen.nomad.tents', faceUp: true }])
        actionPowerUse('ruler', 'denizen.nomad.resettle', [card('denizen.nomad.tents'), site('c2')]).apply(s)
        expect(s.getPlayerState('away').advisers).toEqual([])
        expect(s.denizensBySite['c2']).toContain('denizen.nomad.tents')
    })

    it('Resettle — never an adviser-only or locked card (R-7.2.1, R-7.2.2); a full Great Slum takes it after a discard there', () => {
        const refused = board(['denizen.nomad.resettle'])
        refused.getPlayerState('away').setAdvisers([{ cardId: 'denizen.nomad.ancient-bloodline', faceUp: true }, { cardId: 'denizen.nomad.faithful-friend', faceUp: true }])
        for (const cardId of ['denizen.nomad.ancient-bloodline', 'denizen.nomad.faithful-friend']) {
            expect(() => actionPowerUse('ruler', 'denizen.nomad.resettle', [card(cardId), site('c2')]).apply(refused)).toThrow(/not among the options/)
        }
        const slum = board(['denizen.nomad.resettle'])
        slum.siteCards = { ...slum.siteCards, c2: 'site.great-slums' }
        const residents = ['denizen.order.scouts', 'denizen.beast.wolves', 'denizen.hearth.wayside-inn', 'denizen.discord.naysayers', 'denizen.arcane.tutor']
        slum.denizensBySite['c2'] = residents.slice(0, effectiveSiteCapacity(slum, 'c2'))
        slum.getPlayerState('away').setAdvisers([{ cardId: 'denizen.nomad.tents', faceUp: true }])
        expect(() => actionPowerUse('ruler', 'denizen.nomad.resettle', [card('denizen.nomad.tents'), site('c2')]).apply(slum)).toThrow(/no room/)
        actionPowerUse('ruler', 'denizen.nomad.resettle', [card('denizen.nomad.tents'), site('c2'), card('denizen.order.scouts')]).apply(slum)
        expect(slum.denizensBySite['c2']).toContain('denizen.nomad.tents')
        expect(slum.denizensBySite['c2']).not.toContain('denizen.order.scouts')
    })

    it('Ancient Binding — every player burns down to one secret; a facedown secret counts as the one kept', () => {
        const s = board(['denizen.nomad.ancient-binding'], { away: { secrets: 0, secretsFacedown: 1 } })
        actionPowerUse('ruler', 'denizen.nomad.ancient-binding').apply(s)
        expect(s.getPlayerState('ruler').secrets).toBe(0)
        expect(s.tokensOn('denizen.nomad.ancient-binding').secrets).toBe(1)
        expect(s.getPlayerState('other').secrets).toBe(1)
        expect(s.getPlayerState('away').secrets).toBe(0)
        expect(s.getPlayerState('away').secretsFacedown).toBe(1)

        const rich = board(['denizen.nomad.ancient-binding'], { ruler: { secrets: 4 } })
        actionPowerUse('ruler', 'denizen.nomad.ancient-binding').apply(rich)
        expect(rich.getPlayerState('ruler').secrets).toBe(0)
        expect(rich.tokensOn('denizen.nomad.ancient-binding').secrets).toBe(1)
        expect(rich.getPlayerState('other').secrets).toBe(1)
    })
})

describe('a power records whose warbands its summary counts', () => {
    it('Wolves on a Citizen\'s board of Imperial warbands records the Empire\'s', () => {
        const a = actionPowerUse('ruler', 'denizen.beast.wolves', [player('other')])
        a.apply(board(['denizen.beast.wolves'], {
            ruler: { status: PlayerStatus.Chancellor, warbandsOnBoard: {}, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 } },
            other: { status: PlayerStatus.Citizen, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 } }
        }))
        expect(a.metadata?.warbandOwner).toBe(IMPERIAL_WARBANDS)
        expect(OathVisibility.actions.project(a.dehydrate(), spectator)).toHaveProperty('metadata.warbandOwner', IMPERIAL_WARBANDS)
    })

    it('Wolves on an Exile\'s board records theirs', () => {
        const a = actionPowerUse('ruler', 'denizen.beast.wolves', [player('other')])
        a.apply(board(['denizen.beast.wolves']))
        expect(a.metadata?.warbandOwner).toBe('other')
    })

    it('Wolves on the Chancellor\'s board records the Empire\'s', () => {
        const a = actionPowerUse('ruler', 'denizen.beast.wolves', [player('ruler')])
        a.apply(board(['denizen.beast.wolves'], {
            ruler: { status: PlayerStatus.Chancellor, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 }, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 } }
        }))
        expect(a.metadata?.warbandOwner).toBe(IMPERIAL_WARBANDS)
    })

    it('records no owner when the warbands killed were two owners\' or none died', () => {
        const s = board(['denizen.order.siege-engines'])
        s.warbandsBySite['c2'] = { other: 1, ruler: 1 }
        const mixed = actionPowerUse('ruler', 'denizen.order.siege-engines', [site('c2')])
        mixed.apply(s)
        expect(mixed.metadata?.summary).toBe('killed 2 warbands at c2')
        expect(mixed.metadata?.warbandOwner).toBeUndefined()

        const empty = actionPowerUse('ruler', 'denizen.beast.wolves', [player('away')])
        empty.apply(board(['denizen.beast.wolves'], { away: { warbandsOnBoard: {} } }))
        expect(empty.metadata?.warbandOwner).toBeUndefined()
    })
})

describe('Order', () => {
    it('Siege Engines — kills two warbands at a site in your region, largest owner\'s group first', () => {
        const s = board(['denizen.order.siege-engines'])
        actionPowerUse('ruler', 'denizen.order.siege-engines', [site('c2')]).apply(s)
        expect(s.warbandsBySite['c2']).toEqual({ other: 1, ruler: 1 })
        expect(s.getPlayerState('other').warbandsInPersonalBank['other']).toBe(7)
    })

    it('Siege Engines — a site outside your region is not among the options', () => {
        const s = board(['denizen.order.siege-engines'])
        expect(() => actionPowerUse('ruler', 'denizen.order.siege-engines', [site('h1')]).apply(s)).toThrow(
            /h1 is not among the options for a site in your region/
        )
    })
})

describe('The doorway with the room furnished', () => {
    it('a card outside the playtest deck still refuses, unimplemented, and pays nothing', () => {
        const s = board([UNBUILT])
        expect(() => actionPowerUse('ruler', UNBUILT).apply(s)).toThrow(/not implemented yet/)
        expect(s.tokensOn(UNBUILT).favor).toBe(0)
        expect(s.getPlayerState('ruler')).toMatchObject({ favor: 3, secrets: 2 })
    })

    it('canDo is real: offered when a built, affordable power is in reach', () => {
        const s = board(['denizen.hearth.wayside-inn'])
        expect(HydratedUseActionPower.canDoUseActionPower(s, 'ruler')).toBe(true)
        const legal = HydratedUseActionPower.legalActionPowers(s, 'ruler')
        expect(legal.map((l) => l.cardId)).toEqual(['denizen.hearth.wayside-inn'])

        const broke = board(['denizen.hearth.wayside-inn'], { ruler: { favor: 0 } })
        expect(HydratedUseActionPower.canDoUseActionPower(broke, 'ruler')).toBe(false)

        const unbuilt = board([UNBUILT])
        expect(HydratedUseActionPower.canDoUseActionPower(unbuilt, 'ruler')).toBe(false)
    })

    it('legalActionPowers carries each power’s choices for the panel', () => {
        const s = board(['denizen.arcane.spirit-snare'])
        const [snare] = HydratedUseActionPower.legalActionPowers(s, 'ruler')
        expect(snare.choices).toHaveLength(1)
        expect(snare.choices[0].spec.kind).toBe(PowerChoiceKind.FavorBank)
        expect(snare.choices[0].options).toHaveLength(6)
    })

    it('a power that does not end the Act Phase leaves the handler in ActPhase', () => {
        const s = board(['denizen.hearth.wayside-inn'])
        const a = actionPowerUse('ruler', 'denizen.hearth.wayside-inn')
        a.apply(s)
        expect(new ActPhaseStateHandler().onAction(a, machineContext(s))).toBe(MachineState.ActPhase)
    })
})

describe('Slice 2 — the two deferred Action powers', () => {
    it('Memory of Nature — moves up to X favor (beast cards on the map) into the beast bank', () => {
        const s = board(['denizen.beast.memory-of-nature'])
        s.denizensBySite['c2'] = ['denizen.beast.rangers']
        s.denizensBySite['h1'] = ['denizen.beast.wolves']
        // X = 3, Memory of Nature itself included.
        actionPowerUse('ruler', 'denizen.beast.memory-of-nature', [bank(Suit.Nomad), bank(Suit.Order), bank(Suit.Hearth)]).apply(s)
        expect(s.favorBank[Suit.Beast]).toBe(6)
        expect(s.favorBank[Suit.Nomad]).toBe(2)
        expect(s.getPlayerState('ruler').secrets).toBe(1)

        const four = board(['denizen.beast.memory-of-nature'])
        four.denizensBySite['c2'] = ['denizen.beast.rangers']
        expect(() =>
            actionPowerUse('ruler', 'denizen.beast.memory-of-nature', [bank(Suit.Nomad), bank(Suit.Order), bank(Suit.Hearth)]).apply(four)
        ).toThrow(/only 2 beast cards are on the map/)
        expect(() => actionPowerUse('ruler', 'denizen.beast.memory-of-nature', [bank(Suit.Beast)]).apply(four)).toThrow(
            /cannot be a source for itself/
        )
        // "A total of X": X = 2 here, so naming one bank falls one short.
        expect(() => actionPowerUse('ruler', 'denizen.beast.memory-of-nature', [bank(Suit.Nomad)]).apply(four)).toThrow(
            /yield 1, and 2 can be moved/
        )
    })

    it('Messenger — moves warbands board ⇄ ruled sites, never the last one from a site', () => {
        const s = board(['denizen.order.messenger'])
        s.warbandsBySite['c2'] = { other: 3, ruler: 2 }
        const move = (at: { kind: 'board'; playerId: string } | { kind: 'site'; siteId: string }, count: number): PowerChoice => ({
            kind: PowerChoiceKind.Warbands,
            group: { at, owner: 'ruler', count }
        })
        actionPowerUse('ruler', 'denizen.order.messenger', [move({ kind: 'board', playerId: 'ruler' }, 1), site('c2')]).apply(s)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(1)
        expect(s.warbandsBySite['c2']['ruler']).toBe(3)

        const back = board(['denizen.order.messenger'])
        back.warbandsBySite['c2'] = { other: 3, ruler: 3 }
        expect(() =>
            actionPowerUse('ruler', 'denizen.order.messenger', [move({ kind: 'site', siteId: 'c2' }, 3)]).apply(back)
        ).toThrow(/only 2 are there/)
        actionPowerUse('ruler', 'denizen.order.messenger', [move({ kind: 'site', siteId: 'c2' }, 2)]).apply(back)
        expect(back.warbandsBySite['c2']['ruler']).toBe(1)
        expect(back.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(4)

        const elsewhere = board(['denizen.order.messenger'])
        expect(() =>
            actionPowerUse('ruler', 'denizen.order.messenger', [move({ kind: 'board', playerId: 'ruler' }, 1), site('h1')]).apply(elsewhere)
        ).toThrow(/not among the options/)
    })
})

const MESSENGER = 'denizen.order.messenger'

describe('Messenger — each move is read on the state the earlier moves leave', () => {
    const fromBoard = (count: number) => boardWarbands('ruler', 'ruler', count)
    const fromSite = (siteId: string, count: number) => siteWarbands(siteId, 'ruler', count)
    const where = (s: ReturnType<typeof board>) => ({
        board: s.getPlayerState('ruler').warbandsOnBoard['ruler'] ?? 0,
        c1: s.warbandsBySite['c1']['ruler'],
        c2: s.warbandsBySite['c2']['ruler']
    })
    const use = (s: ReturnType<typeof board>, choices: PowerChoice[]) => {
        const action = actionPowerUse('ruler', MESSENGER, choices)
        action.apply(s)
        return action.metadata?.summary
    }

    it('Messenger chains a move: site A to the board, then the board to site B, with the board empty before', () => {
        const s = board([MESSENGER], { ruler: { warbandsOnBoard: {} } })
        s.warbandsBySite['c2'] = { other: 3, ruler: 3 }
        expect(use(s, [fromSite('c2', 2), fromBoard(2), site('c1')])).toBe('moved 2 c2 → board; 2 board → c1')
        expect(where(s)).toEqual({ board: 0, c1: 3, c2: 1 })
    })

    it('Messenger takes from the board warbands an earlier move brought there', () => {
        const s = board([MESSENGER], { ruler: { warbandsOnBoard: { ruler: 1 } } })
        s.warbandsBySite['c2'] = { other: 3, ruler: 3 }
        expect(use(s, [fromSite('c2', 2), fromBoard(3), site('c1')])).toBe('moved 2 c2 → board; 3 board → c1')
        expect(where(s)).toEqual({ board: 0, c1: 4, c2: 1 })
    })

    it('Messenger lifts from a site warbands an earlier move placed there', () => {
        const s = board([MESSENGER])
        expect(where(s)).toEqual({ board: 2, c1: 1, c2: 1 })
        expect(use(s, [fromBoard(2), site('c2'), fromSite('c2', 2)])).toBe('moved 2 board → c2; 2 c2 → board')
        expect(where(s)).toEqual({ board: 2, c1: 1, c2: 1 })
    })

    it('Messenger keeps the last warband at every step', () => {
        const s = board([MESSENGER])
        expect(() => use(s, [fromBoard(2), site('c2'), fromSite('c2', 2), fromSite('c2', 1)])).toThrow(
            /1 of ruler's warbands is not among the options for more warbands to move/
        )
        expect(() => use(s, [fromBoard(2), site('c2'), fromSite('c2', 3)])).toThrow(
            /3 of ruler's warbands chosen for more warbands to move, but only 2 are there/
        )
        expect(where(s)).toEqual({ board: 2, c1: 1, c2: 1 })
    })

    it('Messenger refuses another player\'s board and an owner the player does not rule with', () => {
        const s = board([MESSENGER])
        const before = s.dehydrate()
        const theirBoard = boardWarbands('other', 'other', 1)
        const theirWarbands = siteWarbands('c2', 'other', 1)
        const empireOnMyBoard = boardWarbands('ruler', IMPERIAL_WARBANDS, 1)
        for (const foreign of [theirBoard, theirWarbands, empireOnMyBoard]) {
            expect(() => use(s, [foreign, site('c1')])).toThrow(/is not among the options for warbands to move/)
            expect(() => use(s, [fromBoard(1), site('c2'), foreign, site('c1')])).toThrow(
                /is not among the options for more warbands to move/
            )
        }
        expect(s.dehydrate()).toEqual(before)
    })

    it('Messenger offers the next move\'s sources on the state the earlier moves leave', () => {
        const s = board([MESSENGER], { ruler: { warbandsOnBoard: {} } })
        s.warbandsBySite['c2'] = { other: 3, ruler: 3 }
        const before = s.dehydrate()
        const power = cardPowers(MESSENGER)[powerIndexOf(MESSENGER, PowerTiming.Action)]
        const sources = (earlier?: PowerChoice[]) => legalChoices(s, 'ruler', power, earlier)[2].options

        expect(sources()).toEqual([fromSite('c2', 2)])
        expect(legalChoices(s, 'ruler', power, [])).toEqual(legalChoices(s, 'ruler', power))
        expect(sources([fromSite('c2', 2)])).toEqual([fromBoard(2)])
        expect(sources([fromSite('c2', 1), site('c1')])).toEqual([fromSite('c1', 1), fromSite('c2', 1)])
        expect(s.dehydrate()).toEqual(before)
    })

    it('Messenger replays every four-pair list the old check accepted unchanged', () => {
        const accepted: { choices: PowerChoice[]; summary: string; after: ReturnType<typeof where> }[] = [
            { choices: [fromBoard(2), site('c2')], summary: 'moved 2 board → c2', after: { board: 0, c1: 3, c2: 5 } },
            { choices: [fromSite('c1', 2)], summary: 'moved 2 c1 → board', after: { board: 4, c1: 1, c2: 3 } },
            { choices: [fromSite('c1', 2), site('c2')], summary: 'moved 2 c1 → c2', after: { board: 2, c1: 1, c2: 5 } },
            {
                choices: [fromBoard(1), site('c1'), fromSite('c2', 2), site('c1'), fromSite('c1', 1), fromBoard(1), site('c2')],
                summary: 'moved 1 board → c1; 2 c2 → c1; 1 c1 → board; 1 board → c2',
                after: { board: 1, c1: 5, c2: 2 }
            },
            { choices: [fromBoard(1), site('c1'), site('c2')], summary: 'moved 1 board → c1', after: { board: 1, c1: 4, c2: 3 } }
        ]
        for (const { choices, summary, after } of accepted) {
            const s = board([MESSENGER])
            s.warbandsBySite['c1'] = { ruler: 3 }
            s.warbandsBySite['c2'] = { other: 3, ruler: 3 }
            expect(use(s, choices), summary).toBe(summary)
            expect(where(s), summary).toEqual(after)
        }
    })
})
