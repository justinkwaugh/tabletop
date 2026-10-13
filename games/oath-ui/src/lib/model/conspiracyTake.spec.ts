import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, OathRevision } from '@tabletop/oath'
import { testBanners, testPlayer, testState } from '@tabletop/oath/testing'
import { conspiracyNoTake, conspiracyTargets, type ConspiracyNoTakeLine } from './conspiracyTake.js'
import type { ReasonPart } from './names.js'

type Seat = Partial<Parameters<typeof testPlayer>[0]>

const ORDER_A = 'denizen.order.wrestlers'
const ORDER_B = 'denizen.order.longbows'
const ORDER_C = 'denizen.order.captains'
const BEAST = 'denizen.beast.rangers'
const RELIC = 'relic.grand-scepter'
const BREAKER = 'denizen.nomad.spell-breaker'
const TONGUE = 'denizen.nomad.lost-tongue'
const TOME = 'denizen.order.tome-guardians'
const SILENCE = 'denizen.arcane.vow-of-silence'
const RENEWAL = 'denizen.discord.vow-of-renewal'

const faceup = (cardIds: string[]) => cardIds.map((cardId) => ({ cardId, faceUp: true }))

/** Dana plays the Conspiracy at c1; Rhys stands there with an Order adviser and a relic. */
function scene(
    dana: Seat = {},
    rhys: Seat = {},
    holders: Partial<Record<Banner, string>> = {},
    oathRevision?: OathRevision
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
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Yellow,
                siteId: 'h1',
                relicIds: ['relic.cup-of-plenty'],
                advisers: faceup(['denizen.order.scouts'])
            })
        ],
        { banners: testBanners(holders), ...(oathRevision === undefined ? {} : { oathRevision }) }
    )
}

const lines = (state: ReturnType<typeof scene>) => conspiracyNoTake(state, 'dana')
const text = (value: string): ReasonPart => ({ kind: 'text', text: value })
const seat = (playerId: string, possessive: boolean): ReasonPart => ({
    kind: 'seat',
    playerId,
    possessive
})
const words = (...parts: ReasonPart[]): ConspiracyNoTakeLine => ({ kind: 'words', parts })

describe('R-5.1.4.IV — why no one at the site can be taken from, one line per player there', () => {
    it('a player the take can reach is a target, and nothing is said', () => {
        const state = scene()
        expect(conspiracyTargets(state, 'dana')).toEqual(['rhys'])
        expect(lines(state)).toEqual([])
    })

    it('no faceup secret: "Needs 1 secret; you have 0."', () => {
        const state = scene({ secrets: 0, secretsFacedown: 1 })
        expect(conspiracyTargets(state, 'dana')).toEqual([])
        expect(lines(state)).toEqual([words(text('Needs 1 secret; you have 0.'))])
    })

    it('Spell Breaker: "Spell Breaker: no secret costs."', () => {
        const state = scene({}, { advisers: faceup([ORDER_C, BREAKER]) })
        expect(lines(state)).toEqual([words(text('Spell Breaker: no secret costs.'))])
    })

    it('the suit match, with the count: "Needs 2 advisers matching <Rhys>\'s; you have 1."', () => {
        const state = scene({ advisers: faceup([ORDER_A, BEAST]) })
        expect(lines(state)).toEqual([
            words(text('Needs 2 advisers matching '), seat('rhys', true), text('; you have 1.'))
        ])
    })

    it('nothing held: "<Rhys> holds no relic or banner."', () => {
        const state = scene({}, { relicIds: [] })
        expect(lines(state)).toEqual([
            words(seat('rhys', false), text(' holds no relic or banner.'))
        ])
    })

    it('Lost Tongue: "Lost Tongue: <Rhys>\'s can’t be taken."', () => {
        const state = scene(
            {},
            { advisers: faceup([ORDER_C, TONGUE]) },
            { [Banner.PeoplesFavor]: 'rhys' }
        )
        expect(lines(state)).toEqual([
            words(text('Lost Tongue: '), seat('rhys', true), text(' can’t be taken.'))
        ])
    })

    it('Tome Guardians: "Tome Guardians: the Darkest Secret can’t be taken."', () => {
        const state = scene(
            {},
            { relicIds: [], advisers: faceup([ORDER_C, TOME]) },
            { [Banner.DarkestSecret]: 'rhys' }
        )
        expect(lines(state)).toEqual([
            words(text('Tome Guardians: the Darkest Secret can’t be taken.'))
        ])
    })

    it('alone at the site: "No one else is here."', () => {
        const state = scene({}, { siteId: 'h1' })
        expect(conspiracyTargets(state, 'dana')).toEqual([])
        expect(lines(state)).toEqual([words(text('No one else is here.'))])
    })

    it('one line per other player there; a cause of yours is said once', () => {
        const state = scene({ advisers: faceup([ORDER_A, BEAST]) })
        state.getPlayerState('ann').siteId = 'c1'
        expect(lines(state)).toEqual([
            words(text('Needs 2 advisers matching '), seat('rhys', true), text('; you have 1.')),
            words(text('Needs 2 advisers matching '), seat('ann', true), text('; you have 1.'))
        ])
        const broke = scene({ secrets: 0 })
        broke.getPlayerState('ann').siteId = 'c1'
        expect(lines(broke)).toEqual([words(text('Needs 1 secret; you have 0.'))])
    })

    it('when anyone here can be taken from, only they are targets and no line is said', () => {
        const state = scene()
        state.getPlayerState('ann').siteId = 'c1'
        state.getPlayerState('ann').relicIds = []
        expect(conspiracyTargets(state, 'dana')).toEqual(['rhys'])
        expect(lines(state)).toEqual([])
    })

    it('Vow of Silence, in a game before the card fixes: "Vow of Silence: the Darkest Secret can’t be taken."', () => {
        const silent = (oathRevision: OathRevision) =>
            scene(
                { advisers: faceup([ORDER_A, ORDER_B, SILENCE]) },
                { relicIds: [] },
                { [Banner.DarkestSecret]: 'rhys' },
                oathRevision
            )
        const before = silent(OathRevision.PlanCostsAndSearchPlays)
        expect(conspiracyTargets(before, 'dana')).toEqual([])
        expect(lines(before)).toEqual([
            words(text('Vow of Silence: the Darkest Secret can’t be taken.'))
        ])
        // Since the card fixes the vow forbids only a Recover, so the take is open.
        const now = silent(OathRevision.CardFixes1)
        expect(conspiracyTargets(now, 'dana')).toEqual(['rhys'])
        expect(lines(now)).toEqual([])
    })

    it('Vow of Renewal, in a game before the card fixes: "Vow of Renewal: the People’s Favor can’t be taken."', () => {
        const state = scene(
            { advisers: faceup([ORDER_A, ORDER_B, RENEWAL]) },
            { relicIds: [] },
            { [Banner.PeoplesFavor]: 'rhys' },
            OathRevision.PlanCostsAndSearchPlays
        )
        expect(conspiracyTargets(state, 'dana')).toEqual([])
        expect(lines(state)).toEqual([
            words(text('Vow of Renewal: the People’s Favor can’t be taken.'))
        ])
    })

    it('each prize guarded by a different card: one line per card, in the same form', () => {
        const state = scene(
            { advisers: faceup([ORDER_A, ORDER_B, RENEWAL]) },
            { relicIds: [], advisers: faceup([ORDER_C, TOME]) },
            { [Banner.PeoplesFavor]: 'rhys', [Banner.DarkestSecret]: 'rhys' },
            OathRevision.PlanCostsAndSearchPlays
        )
        expect(conspiracyTargets(state, 'dana')).toEqual([])
        expect(lines(state)).toEqual([
            words(text('Vow of Renewal: the People’s Favor can’t be taken.')),
            words(text('Tome Guardians: the Darkest Secret can’t be taken.'))
        ])
    })

    it('Lost Tongue guards all its holder holds, so its line is said even where another card refused first', () => {
        // Tome Guardians is met first and refuses the Darkest Secret; Lost Tongue refuses the rest.
        const state = scene(
            {},
            { relicIds: [], advisers: faceup([ORDER_C, TOME, TONGUE]) },
            { [Banner.PeoplesFavor]: 'rhys', [Banner.DarkestSecret]: 'rhys' }
        )
        expect(conspiracyTargets(state, 'dana')).toEqual([])
        expect(lines(state)).toEqual([
            words(text('Lost Tongue: '), seat('rhys', true), text(' can’t be taken.'))
        ])
    })

    it('a player who matches but holds nothing the take may reach is not a target', () => {
        expect(conspiracyTargets(scene({}, { relicIds: [] }), 'dana')).toEqual([])
        expect(
            conspiracyTargets(scene({}, { advisers: faceup([ORDER_C, TONGUE]) }), 'dana')
        ).toEqual([])
    })
})
