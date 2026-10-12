import { describe, expect, it } from 'vitest'
import { cardDefinitions } from '../data/cardRegistry.js'
import { PowerTiming, powersWithTiming } from '../data/cardPowers.js'
import { isFreeGain, isMandatoryModifier } from '../util/modifiers.js'
import '../powers/index.js'

const MODIFIERS = cardDefinitions().flatMap((card) =>
    powersWithTiming(card.id, PowerTiming.Modifier)
)

const FREE_GAINS = [
    'denizen.arcane.secret-signal',
    'denizen.beast.animal-playmates',
    'denizen.beast.birdsong',
    'denizen.beast.the-old-oak',
    'denizen.beast.wild-cry',
    'denizen.discord.downtrodden',
    'denizen.hearth.rowdy-pub',
    'denizen.hearth.welcoming-party',
    'relic.cup-of-plenty',
    'relic.dragonskin-drum'
]

describe('R-7.4.1 — the free gains, which a menu may start in use', () => {
    it('are the ten optional modifiers that cost nothing, ask nothing and only gain', () => {
        const free = MODIFIERS.filter(isFreeGain)
        expect(free.map((power) => power.cardId).sort()).toEqual(FREE_GAINS)
        for (const power of free) {
            expect(isMandatoryModifier(power), power.cardId).toBe(false)
            expect(power.cost, power.cardId).toEqual({
                placeFavor: 0,
                burnFavor: 0,
                placeSecret: 0,
                burnSecret: 0
            })
        }
    })

    it('are told apart from the modifiers the engine applies by itself', () => {
        const mandatory = MODIFIERS.filter(isMandatoryModifier).map((power) => power.cardId)
        expect(mandatory.length).toBeGreaterThan(0)
        expect(mandatory).toContain('denizen.order.tyrant')
        expect(mandatory).toContain('denizen.beast.vow-of-beastkin')
        expect(mandatory.filter((cardId) => FREE_GAINS.includes(cardId))).toEqual([])
    })
})
