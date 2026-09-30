import { getPrng } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import {
    createOathVault,
    discardOnto,
    drawFromDiscard,
    drawFromWorldDeck,
    topBackType
} from './vault.js'
import { CardKind, Region } from './oathEnums.js'

const D1 = 'denizen.order.one'
const D2 = 'denizen.hearth.two'
const D3 = 'denizen.beast.three'
const D4 = 'denizen.nomad.four'
const V1 = 'vision.conquest'

function vaultWith(worldDeck: string[], discardPiles: Partial<Record<Region, string[]>> = {}) {
    const vault = createOathVault({ discardPiles }, getPrng(1))
    vault.worldDeck = [...worldDeck]
    return vault
}

describe('vault construction', () => {
    it('R-2.1.5 — shuffles the world deck deterministically from the vault seed', () => {
        const cards = Array.from({ length: 20 }, (_, i) => `denizen.order.c${i}`)
        const a = createOathVault({ worldDeck: cards }, getPrng(99))
        const b = createOathVault({ worldDeck: cards }, getPrng(99))
        const c = createOathVault({ worldDeck: cards }, getPrng(100))

        expect(a.worldDeck).toEqual(b.worldDeck)
        expect(a.worldDeck).not.toEqual(c.worldDeck)
        expect([...a.worldDeck].sort()).toEqual([...cards].sort())
    })

    it('does not alias the caller arrays', () => {
        const cards = [D1, D2]
        const vault = createOathVault({ worldDeck: cards }, getPrng(1))
        vault.worldDeck.pop()
        expect(cards).toHaveLength(2)
    })

    it('R-8.5 — the Dispossessed starts empty in a first game', () => {
        expect(createOathVault({}, getPrng(1)).dispossessed).toEqual([])
    })

    it('starts with all three discard piles present (R-2.1.2)', () => {
        const vault = createOathVault({}, getPrng(1))
        expect(Object.keys(vault.discardPiles).sort()).toEqual(
            [...Object.values(Region)].sort()
        )
    })
})

describe('world deck draws (R-5.1.2, R-10.6)', () => {
    it('draws three from the top, in order', () => {
        const vault = vaultWith([D1, D2, D3, D4])
        const result = drawFromWorldDeck(vault, 3)

        expect(result.drawn).toEqual([D1, D2, D3])
        expect(result.stoppedOnVision).toBe(false)
        expect(vault.worldDeck).toEqual([D4])
    })

    it('stops the moment a Vision is drawn, keeping the Vision (R-5.1.2)', () => {
        const vault = vaultWith([D1, V1, D2, D3])
        const result = drawFromWorldDeck(vault, 3)

        expect(result.drawn).toEqual([D1, V1])
        expect(result.stoppedOnVision).toBe(true)
        expect(vault.worldDeck).toEqual([D2, D3])
    })

    it('yields a single card when the Vision is on top', () => {
        const vault = vaultWith([V1, D1, D2])
        const result = drawFromWorldDeck(vault, 3)

        expect(result.drawn).toEqual([V1])
        expect(result.stoppedOnVision).toBe(true)
    })

    it('does not interrupt on a Vision drawn as the third card', () => {
        const vault = vaultWith([D1, D2, V1, D3])
        const result = drawFromWorldDeck(vault, 3)

        expect(result.drawn).toEqual([D1, D2, V1])
        expect(result.stoppedOnVision).toBe(true)
        expect(vault.worldDeck).toEqual([D3])
    })

    it('takes as many as possible from a short deck (R-9.3)', () => {
        const vault = vaultWith([D1, D2])
        const result = drawFromWorldDeck(vault, 3)

        expect(result.drawn).toEqual([D1, D2])
        expect(result.stoppedOnVision).toBe(false)
        expect(vault.worldDeck).toEqual([])
    })

    it('reports the new top card back type after the draw (R-9.4)', () => {
        const vault = vaultWith([D1, V1, D2])
        expect(topBackType(vault)).toBe(CardKind.Denizen)

        const result = drawFromWorldDeck(vault, 1)
        expect(result.drawn).toEqual([D1])
        expect(result.topBackType).toBe(CardKind.Vision)
    })

    it('reports no top back type once the deck is empty', () => {
        const vault = vaultWith([D1])
        expect(drawFromWorldDeck(vault, 3).topBackType).toBeUndefined()
        expect(topBackType(vault)).toBeUndefined()
    })
})

describe('discard pile draws (R-5.1.2, R-10.6)', () => {
    it('draws from the top of the pile', () => {
        const vault = vaultWith([], { [Region.Provinces]: [D1, D2, D3, D4] })
        expect(drawFromDiscard(vault, Region.Provinces, 3)).toEqual([D1, D2, D3])
        expect(vault.discardPiles[Region.Provinces]).toEqual([D4])
    })

    it('does not interrupt on a Vision — the interrupt is world deck only', () => {
        const vault = vaultWith([], { [Region.Cradle]: [D1, V1, D2] })
        expect(drawFromDiscard(vault, Region.Cradle, 3)).toEqual([D1, V1, D2])
    })

    it('takes as many as possible from a short pile (R-9.3)', () => {
        const vault = vaultWith([], { [Region.Hinterland]: [D1] })
        expect(drawFromDiscard(vault, Region.Hinterland, 3)).toEqual([D1])
        expect(vault.discardPiles[Region.Hinterland]).toEqual([])
    })
})

describe('discarding onto a pile (R-10.5)', () => {
    it('places cards on top', () => {
        const vault = vaultWith([], { [Region.Hinterland]: [D4] })
        discardOnto(vault, Region.Hinterland, [D1])
        expect(vault.discardPiles[Region.Hinterland]).toEqual([D1, D4])
    })

    it('applies the given order, leaving the last id on top', () => {
        const vault = vaultWith([], { [Region.Cradle]: [] })
        discardOnto(vault, Region.Cradle, [D1, D2])
        expect(vault.discardPiles[Region.Cradle]).toEqual([D2, D1])
    })

    it('round-trips: what you discard is what you draw back, in that order', () => {
        const vault = vaultWith([], { [Region.Provinces]: [D4] })
        discardOnto(vault, Region.Provinces, [D1, D2])
        expect(drawFromDiscard(vault, Region.Provinces, 3)).toEqual([D2, D1, D4])
    })
})
