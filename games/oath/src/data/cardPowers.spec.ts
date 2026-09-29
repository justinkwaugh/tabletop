import { describe, expect, it } from 'vitest'
import { assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import {
    allPowers,
    allPowersWithTiming,
    BattlePlanSide,
    cardPower,
    cardPowers,
    isFree,
    isPersistent,
    isUsableTiming,
    parsePowers,
    PowerTiming,
    powersWithTiming,
    registerCardPowers,
    type CardPower,
    type PowerRecord
} from './cardPowers.js'
import arcane from './denizens.arcane.data.js'
import beast from './denizens.beast.data.js'
import discord from './denizens.discord.data.js'
import hearth from './denizens.hearth.data.js'
import nomad from './denizens.nomad.data.js'
import order from './denizens.order.data.js'
import relics from './relics.data.js'
import visions from './visions.data.js'
import { required } from '../testing/required.js'

const ALL_RECORDS: Array<PowerRecord & { id: string; powerText: string }> = [
    ...arcane,
    ...beast,
    ...discord,
    ...hearth,
    ...nomad,
    ...order,
    ...relics,
    ...visions
]

function allUnits(): Array<{ id: string; timing: PowerRecord['timing'] }> {
    return ALL_RECORDS.map((r) => ({ id: r.id, timing: r.timing }))
}

function costTotal(power: CardPower): number {
    return (
        power.cost.placeFavor +
        power.cost.burnFavor +
        power.cost.placeSecret +
        power.cost.burnSecret
    )
}

describe('R-7 — the corpus, counted from the cards', () => {
    it('R-2.6.3 — is 224 card units, of which 220 print a power', () => {
        expect(allUnits()).toHaveLength(224)

        const withPower = allUnits().filter((u) => cardPowers(u.id).length > 0)
        expect(withPower).toHaveLength(220)
    })

    // Pinned by id rather than by count, so a blank power box cannot hide missing data.
    it('the four printing nothing are the Oath Visions, and only those', () => {
        const blank = allUnits()
            .filter((u) => cardPowers(u.id).length === 0)
            .map((u) => u.id)
            .sort()

        expect(blank).toEqual([
            'vision.conquest',
            'vision.faith',
            'vision.rebellion',
            'vision.sanctuary'
        ])
    })

    it('R-7.3.1 — no card in the game has a Wake power', () => {
        expect(allPowersWithTiming(PowerTiming.Wake)).toEqual([])

        // R-4.1.2 — the four Oath Visions' wake records print a goal, not a power.
        const wakeRecords = ALL_RECORDS.filter((r) => r.timing === 'wake')
        expect(wakeRecords).toHaveLength(4)
    })

    it('231 powers, split across the seven timings with a customer; The Tribunal adds the one site Action (R-11.9)', () => {
        const census = Object.fromEntries(
            Object.values(PowerTiming).map((t) => [t, allPowersWithTiming(t).length])
        )

        expect(census).toEqual({
            [PowerTiming.Action]: 58,
            [PowerTiming.BattlePlan]: 51,
            [PowerTiming.Modifier]: 41,
            [PowerTiming.Persistent]: 37,
            [PowerTiming.WhenPlayed]: 28,
            [PowerTiming.Continuous]: 11,
            [PowerTiming.Rest]: 5,
            [PowerTiming.Wake]: 0
        })
        expect(allPowers()).toHaveLength(231)
    })

    it('R-7.3.2 — 57 cards print an Action power (The Tribunal among them); the Grand Scepter prints two', () => {
        const cards = new Set(allPowersWithTiming(PowerTiming.Action).map((p) => p.cardId))
        expect(cards.size).toBe(57)
        expect(powersWithTiming('relic.grand-scepter', PowerTiming.Action)).toHaveLength(2)
    })
})

describe('R-7 — one record can print more than one power', () => {
    const MULTI = [
        'denizen.beast.pied-piper',
        'denizen.beast.vow-of-poverty',
        'denizen.discord.assassin',
        'denizen.discord.insomnia',
        'denizen.discord.salt-the-earth',
        'denizen.discord.silver-tongue',
        'denizen.order.vow-of-obedience',
        'relic.grand-scepter',
        'relic.obsidian-cage'
    ]

    it('nine records do, and the data has not grown a tenth', () => {
        const arrays = allUnits()
            .filter((u) => Array.isArray(u.timing))
            .map((u) => u.id)
            .sort()
        expect(arrays).toEqual([...MULTI].sort())
    })

    it('a multi-power record prints one line per power, in order', () => {
        for (const id of MULTI) {
            const rec = required(ALL_RECORDS.find((r) => r.id === id), id)
            const powers = cardPowers(id)
            const lines = rec.powerText.split('\n')

            assert(Array.isArray(rec.timing), `${id} prints one timing per power`)
            expect(powers).toHaveLength(rec.timing.length)
            expect(powers.map((p) => p.text)).toEqual(lines.map((l) => l.trim()))
        }
    })

    it('R-6.2 — the Grand Scepter’s two Action powers are addressed by index', () => {
        expect(cardPower('relic.grand-scepter', 1)?.text).toContain('Peek in the Imperial')
        expect(cardPower('relic.grand-scepter', 2)?.text).toContain('Offer Citizenship')
        expect(cardPower('relic.grand-scepter', 3)).toBeUndefined()

        expect(cardPower('relic.grand-scepter', 0)?.timing).toBe(PowerTiming.Continuous)
    })

    it('R-7.5 — the Obsidian Cage’s side describes its battle plan, not its Action', () => {
        const [plan, action] = cardPowers('relic.obsidian-cage')
        expect(plan?.timing).toBe(PowerTiming.BattlePlan)
        expect(plan?.battlePlanSide).toBe(BattlePlanSide.Either)
        expect(action?.timing).toBe(PowerTiming.Action)
        expect(action?.battlePlanSide).toBeUndefined()
    })

    it('R-7.5 — a side is set on exactly the 51 battle plans', () => {
        for (const power of allPowers()) {
            expect(power.battlePlanSide !== undefined).toBe(power.timing === PowerTiming.BattlePlan)
        }
        expect(allPowers().filter((p) => p.battlePlanSide)).toHaveLength(51)
    })
})

describe('R-7.1.2 — a printed cost reaches the power that charges it', () => {
    it('all 81 printed costs land on a power', () => {
        const costedUnits = allUnits().filter((u) =>
            cardPowers(u.id).some((p) => !isFree(p.cost))
        )
        expect(costedUnits).toHaveLength(81)
    })

    // R-9.1 — both print "you may use this power" beside a cost, so the cost is kept.
    it('R-7.1.4 — a persistent power that prints a cost keeps it', () => {
        const jinx = required(cardPowers('denizen.arcane.jinx')[0], 'Jinx power')
        expect(jinx.timing).toBe(PowerTiming.Persistent)
        expect(jinx.cost.placeSecret).toBe(1)

        const thief = required(cardPowers('denizen.discord.relic-thief')[0], 'Relic Thief power')
        expect(thief.timing).toBe(PowerTiming.Persistent)
        expect(thief.cost).toMatchObject({ placeFavor: 1, placeSecret: 1 })
    })

    it('on a two-power record, the cost goes to the usable power', () => {
        const [continuous, action] = cardPowers('denizen.beast.pied-piper')
        expect(continuous?.timing).toBe(PowerTiming.Continuous)
        expect(isFree(required(continuous, 'a continuous power').cost)).toBe(true)
        expect(action?.cost.placeSecret).toBe(1)

        const [restriction, assassinate] = cardPowers('denizen.discord.assassin')
        expect(isFree(required(restriction, 'a restriction').cost)).toBe(true)
        expect(assassinate?.cost.placeFavor).toBe(1)
    })

    it('no record prints a cost alongside more than one usable power', () => {
        for (const unit of allUnits()) {
            const powers = cardPowers(unit.id)
            if (powers.every((p) => isFree(p.cost))) continue
            expect(powers.filter((p) => isUsableTiming(p.timing)).length).toBeLessThanOrEqual(1)
        }
    })

    it('R-7.1.2 — 19 costs exceed the legend’s singular', () => {
        const plural = allPowers().filter((p) => costTotal(p) > 1)
        expect(plural.length).toBe(19)

        expect(cardPowers('denizen.hearth.hearts-and-minds')[0]?.cost.placeFavor).toBe(3)
        expect(cardPowers('denizen.arcane.alchemist')[0]?.cost).toMatchObject({
            placeSecret: 1,
            burnSecret: 1
        })
    })

    it('R-5.5.3 — 28 of the 51 battle plans are free', () => {
        const free = allPowersWithTiming(PowerTiming.BattlePlan).filter((p) => isFree(p.cost))
        expect(free).toHaveLength(28)
    })
})

describe('R-7.4 — the modifier tab', () => {
    it('names one of the six major actions, and maps to that action type', () => {
        const modifiers = allPowers().filter((p) => p.modifiesAction)
        expect(modifiers).toHaveLength(61)

        const targets = new Set(modifiers.map((p) => p.modifiesAction))
        expect([...targets].sort()).toEqual(
            [
                ActionType.Campaign,
                ActionType.Muster,
                ActionType.Recover,
                ActionType.Search,
                ActionType.Trade,
                ActionType.Travel
            ].sort()
        )
    })

    it('R-7.1.4 — 20 of them are persistent, not modifier-timed', () => {
        const modifiers = allPowers().filter((p) => p.modifiesAction)
        const byTiming = modifiers.filter((p) => p.timing === PowerTiming.Modifier)
        const persistent = modifiers.filter(isPersistent)

        expect(byTiming).toHaveLength(41)
        expect(persistent).toHaveLength(20)
        expect(allPowersWithTiming(PowerTiming.Modifier).every((p) => p.modifiesAction)).toBe(true)
        expect(byTiming.length + persistent.length).toBe(modifiers.length)
    })
})

describe('the data still says what this file reads it as', () => {
    it('R-7.1.4 — the `persistent` flag and the timing are one fact', () => {
        for (const rec of ALL_RECORDS) {
            const timings = Array.isArray(rec.timing) ? rec.timing : [rec.timing]
            expect(rec.persistent ?? false).toBe(timings.includes('persistent'))
        }
    })

    // R-7.1.4, R-7.1.4-H1
    it('exactly the always-on timings are unusable', () => {
        for (const timing of Object.values(PowerTiming)) {
            expect(isUsableTiming(timing)).toBe(
                timing !== PowerTiming.Persistent && timing !== PowerTiming.Continuous
            )
        }
    })

    it('every power carries its own card id back', () => {
        for (const unit of allUnits()) {
            for (const [index, power] of cardPowers(unit.id).entries()) {
                expect(power.cardId).toBe(unit.id)
                expect(power.powerIndex).toBe(index)
                expect(power.text.length).toBeGreaterThan(0)
            }
        }
    })

    it('an unknown id has no powers', () => {
        expect(cardPowers('denizen.arcane.no-such-card')).toEqual([])
        expect(cardPower('denizen.arcane.no-such-card', 0)).toBeUndefined()
    })
})

describe('the parser refuses data it cannot model', () => {
    const COST = { placeFavor: 0, burnFavor: 0, placeSecret: 0, burnSecret: 0 }

    it('a multi-power record whose text does not split to match', () => {
        expect(() =>
            parsePowers('test.card', {
                powerText: 'Action: one line only.',
                timing: ['continuous', 'action'],
                cost: COST
            })
        ).toThrow(/2 timings but powerText splits into 1/)
    })

    it('but a blank power box is data, not an error', () => {
        expect(parsePowers('test.card', { powerText: '', timing: 'wake' })).toEqual([])
    })
})

describe('registerCardPowers — the seam a test supplies a power through', () => {
    it('registers a power the corpus does not print, and re-addresses it', () => {
        const id = 'denizen.test.fixture-card'
        registerCardPowers(id, [
            {
                cardId: 'ignored',
                powerIndex: 99,
                timing: PowerTiming.Action,
                text: 'Action: do the thing under test.',
                cost: { placeFavor: 1, burnFavor: 0, placeSecret: 0, burnSecret: 0 }
            }
        ])

        const power = cardPower(id, 0)
        expect(power?.cardId).toBe(id)
        expect(power?.powerIndex).toBe(0)
        expect(power?.cost.placeFavor).toBe(1)

        registerCardPowers(id, [])
        expect(cardPowers(id)).toEqual([])
    })
})
