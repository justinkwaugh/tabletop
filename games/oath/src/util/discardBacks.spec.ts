import { describe, expect, it } from 'vitest'
import { Color, getPrng } from '@tabletop/common'
import { CardKind, IMPERIAL_COLOR, PlayerStatus, Region } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { discardCards } from '../util/discard.js'
import { buildSetupVault, resolveSetupDeal, applySetupDeal } from '../model/setup.js'
import { drawFromDiscard } from '../model/vault.js'

/** R-9.4 — a pile's top back is public though its fronts are private. */

const DENIZEN = 'denizen.hearth.herald'
const VISION = 'vision.conspiracy'

function board() {
    return testState(
        [
            testPlayer({
                playerId: 'p1',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                warbandsOnBoard: { [IMPERIAL_COLOR]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_COLOR]: 20 }
            })
        ],
        {}
    )
}

describe('R-9.4 — the back showing on a discard pile', () => {
    it('R-10.5 — a discard sets the back on the pile it actually lands in', () => {
        const state = board()
        discardCards(state, 'p1', [DENIZEN], Region.Cradle)
        expect(state.discardTopBackIn(Region.Provinces)).toBe(CardKind.Denizen)
        expect(state.discardTopBackIn(Region.Cradle)).toBeUndefined()
    })

    it('R-2.7 — a discarded Vision shows a Vision back', () => {
        const state = board()
        discardCards(state, 'p1', [VISION], Region.Cradle)
        expect(state.discardTopBackIn(Region.Provinces)).toBe(CardKind.Vision)
    })

    it('R-10.5 — the LAST card placed is the one showing', () => {
        const state = board()
        discardCards(state, 'p1', [VISION, DENIZEN], Region.Cradle)
        expect(state.discardTopBackIn(Region.Provinces)).toBe(CardKind.Denizen)

        const other = board()
        discardCards(other, 'p1', [DENIZEN, VISION], Region.Cradle)
        expect(other.discardTopBackIn(Region.Provinces)).toBe(CardKind.Vision)
    })

    it('an empty pile shows nothing, whatever the field says', () => {
        const state = board()
        state.discardTopBackType = { [Region.Provinces]: CardKind.Denizen }
        expect(state.discardPileCountIn(Region.Provinces)).toBe(0)
        expect(state.discardTopBackIn(Region.Provinces)).toBeUndefined()
    })

    it('R-1.19 — the setup deal publishes a back for every seeded pile', () => {
        const state = board()
        const vault = buildSetupVault(state, getPrng(1))
        const result = resolveSetupDeal(vault, ['p1'])

        applySetupDeal(state, result)

        const seeded = Object.values(Region).filter((region) => state.discardPileCountIn(region) > 0)
        expect(seeded.length).toBeGreaterThan(0)
        for (const region of seeded) {
            expect(state.discardTopBackIn(region)).toBeDefined()
        }
    })

    it('R-10.5 — "the pile I discard to" is not "the pile in my band"', () => {
        const state = board()
        discardCards(state, 'p1', [DENIZEN], Region.Cradle)

        expect(state.discardPileCountIn(Region.Provinces)).toBe(1)
        expect(state.discardPileCountIn(Region.Cradle)).toBe(0)

        expect(state.discardPileCountFor(Region.Cradle)).toBe(1)
        expect(state.discardPileCountFor(Region.Cradle)).not.toBe(
            state.discardPileCountIn(Region.Cradle)
        )
    })

    it('R-10.6 — drawing from a pile uncovers the card beneath', () => {
        const state = board()
        const vault = buildSetupVault(state, getPrng(1))
        vault.discardPiles[Region.Cradle] = [VISION, DENIZEN]

        const drawn = drawFromDiscard(vault, Region.Cradle, 1)
        expect(drawn).toEqual([VISION])
        expect(vault.discardPiles[Region.Cradle][0]).toBe(DENIZEN)
    })
})
