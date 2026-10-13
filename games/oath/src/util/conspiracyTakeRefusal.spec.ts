import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    conspiracyMatchCount,
    conspiracyTakeRefusal,
    reasonCannotPlayConspiracy
} from './cardPlay.js'
import { Banner } from '../model/oathEnums.js'
import { testBanners, testPlayer, testState } from '../testing/fixture.js'
import { CONSPIRACY_ID } from '../data/cardRegistry.js'
import type { OathPlayerState } from '../model/playerState.js'
import '../powers/index.js'

const ORDER_A = 'denizen.order.wrestlers'
const ORDER_B = 'denizen.order.longbows'
const ORDER_C = 'denizen.order.captains'
const BEAST = 'denizen.beast.rangers'
const HEARTH = 'denizen.hearth.storyteller'
const THEIR_HEARTH = 'denizen.hearth.marriage'
const RELIC = 'relic.grand-scepter'
const CIRCLET = 'relic.circlet-of-command'
const BREAKER = 'denizen.nomad.spell-breaker'
const TONGUE = 'denizen.nomad.lost-tongue'
const TOME = 'denizen.order.tome-guardians'

const faceup = (cardIds: string[]) => cardIds.map((cardId) => ({ cardId, faceUp: true }))

/** Dana takes from Rhys at c1: two Order advisers against his Order adviser, a relic to take. */
function scene(
    dana: Partial<OathPlayerState> = {},
    rhys: Partial<OathPlayerState> = {},
    holders: Partial<Record<Banner, string>> = {}
) {
    return testState(
        [
            testPlayer({
                playerId: 'dana',
                siteId: 'c1',
                secrets: 1,
                advisers: faceup([ORDER_A, ORDER_B]),
                ...dana
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: 'c1',
                relicIds: [RELIC],
                advisers: faceup([ORDER_C]),
                ...rhys
            })
        ],
        { banners: testBanners(holders) }
    )
}

const refusal = (state: ReturnType<typeof scene>) => conspiracyTakeRefusal(state, 'dana', 'rhys')

describe('R-5.1.4.IV — the Conspiracy take: the match count', () => {
    it('counts every faceup adviser of yours matching one of their suits', () => {
        expect(conspiracyMatchCount(scene(), 'dana', 'rhys')).toBe(2)
        expect(
            conspiracyMatchCount(scene({ advisers: faceup([ORDER_A, BEAST]) }), 'dana', 'rhys')
        ).toBe(1)
        expect(
            conspiracyMatchCount(
                scene(
                    { advisers: faceup([HEARTH, ORDER_A, BEAST]) },
                    { advisers: faceup([THEIR_HEARTH, ORDER_C]) }
                ),
                'dana',
                'rhys'
            )
        ).toBe(2)
    })

    it('counts no facedown adviser on either side', () => {
        const yours = scene({
            advisers: [
                { cardId: ORDER_A, faceUp: true },
                { cardId: ORDER_B, faceUp: false }
            ]
        })
        expect(conspiracyMatchCount(yours, 'dana', 'rhys')).toBe(1)
        const theirs = scene({}, { advisers: [{ cardId: ORDER_C, faceUp: false }] })
        expect(conspiracyMatchCount(theirs, 'dana', 'rhys')).toBe(0)
    })
})

describe("R-5.1.4.IV — why the Conspiracy take is refused, by cause, in the play's order", () => {
    it('refuses nothing when the take is open', () => {
        expect(refusal(scene())).toBeUndefined()
    })

    it('no faceup secret to burn (R-7.1.2.a)', () => {
        expect(refusal(scene({ secrets: 0, secretsFacedown: 2 }))).toEqual({
            cause: 'secret',
            has: 0
        })
    })

    it('Spell Breaker bars the secret cost', () => {
        const state = scene({}, { advisers: faceup([ORDER_C, BREAKER]) })
        expect(refusal(state)).toEqual({ cause: 'secretCost', cardId: BREAKER })
    })

    it('fewer than two matching advisers, with the count', () => {
        expect(refusal(scene({ advisers: faceup([ORDER_A, BEAST]) }))).toEqual({
            cause: 'match',
            needs: 2,
            has: 1
        })
    })

    it('nothing held', () => {
        expect(refusal(scene({}, { relicIds: [] }))).toEqual({ cause: 'nothingHeld' })
    })

    it('Lost Tongue guards everything they hold', () => {
        const state = scene(
            {},
            { advisers: faceup([ORDER_C, TONGUE]) },
            { [Banner.PeoplesFavor]: 'rhys' }
        )
        expect(refusal(state)).toMatchObject({
            cause: 'guarded',
            guards: [
                { take: { kind: 'relic', cardId: RELIC }, cardId: TONGUE },
                { take: { kind: 'banner', banner: Banner.PeoplesFavor }, cardId: TONGUE }
            ]
        })
    })

    it('Tome Guardians guards the Darkest Secret, all they hold', () => {
        const state = scene(
            {},
            { relicIds: [], advisers: faceup([ORDER_C, TOME]) },
            { [Banner.DarkestSecret]: 'rhys' }
        )
        expect(refusal(state)).toMatchObject({
            cause: 'guarded',
            guards: [
                {
                    take: { kind: 'banner', banner: Banner.DarkestSecret },
                    cardId: TOME,
                    reason: expect.stringMatching(/^Tome Guardians/)
                }
            ]
        })
    })

    it('Circlet of Command never leaves its holder with nothing to take', () => {
        const state = scene({}, { relicIds: [CIRCLET, RELIC] }, { [Banner.PeoplesFavor]: 'rhys' })
        expect(refusal(state)).toBeUndefined()
    })

    it('takes the first cause in the order reasonCannotPlayConspiracy checks', () => {
        // No secret and Spell Breaker: the secret first.
        expect(
            refusal(scene({ secrets: 0 }, { advisers: faceup([ORDER_C, BREAKER]) }))?.cause
        ).toBe('secret')
        // Spell Breaker and one match: Spell Breaker first.
        expect(
            refusal(
                scene(
                    { advisers: faceup([ORDER_A, BEAST]) },
                    { advisers: faceup([ORDER_C, BREAKER]) }
                )
            )?.cause
        ).toBe('secretCost')
        // One match and nothing held: the match first.
        expect(
            refusal(scene({ advisers: faceup([ORDER_A, BEAST]) }, { relicIds: [] }))?.cause
        ).toBe('match')
    })

    it('agrees with the play: a refused take is refused by reasonCannotPlayConspiracy too', () => {
        const cases = [
            scene({ secrets: 0 }),
            scene({}, { advisers: faceup([ORDER_C, BREAKER]) }),
            scene({ advisers: faceup([ORDER_A, BEAST]) }),
            scene({}, { advisers: faceup([ORDER_C, TONGUE]) })
        ]
        for (const state of cases) {
            expect(refusal(state)).toBeDefined()
            expect(
                reasonCannotPlayConspiracy(state, 'dana', {
                    keptCardId: CONSPIRACY_ID,
                    conspiracy: { targetPlayerId: 'rhys', take: { kind: 'relic', cardId: RELIC } }
                })
            ).toBeDefined()
        }
        expect(
            reasonCannotPlayConspiracy(scene(), 'dana', {
                keptCardId: CONSPIRACY_ID,
                conspiracy: { targetPlayerId: 'rhys', take: { kind: 'relic', cardId: RELIC } }
            })
        ).toBeUndefined()
    })
})
