import { describe, expect, it } from 'vitest'
import type { Good, GuildId } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { conservationBreaks } from '../model/canonicalValidator.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import {
    Charters,
    giveTile,
    returnAllGoods,
    tableInWindow,
    type WindowName
} from '../testing/atWill.js'
import { answer, commit, conquer, holdWrit, PawnOf, tableAtCombat } from '../testing/combat.js'
import { setPawns } from '../testing/guilds.js'
import { giveGood, setUp } from '../testing/improving.js'
import { canonicalOf } from '../testing/state.js'
import { writRegistry, type WritRegistration } from '../writs/writRegistry.js'
import { playMandateOffers } from './playMandate.js'
import { commitAttackOffer } from './commitAttack.js'

const Windows: readonly WindowName[] = [
    'before a card',
    'hand selection',
    'nourishing',
    'writ limit'
]

const registered = writRegistry.registrations()

function isTiming<Timing extends WritRegistration['timing']>(timing: Timing) {
    return (row: WritRegistration): row is Extract<WritRegistration, { timing: Timing }> =>
        row.timing === timing
}

/** R-4.4.2 Every alternative of every at-will mandate. */
const AtWill = registered.filter(isTiming('at-will')).flatMap(({ writId, alternatives }) =>
    alternatives.map(({ turnedIn, rewardGuild }, alternative) => ({
        name: `${writId} ${rewardGuild ?? alternative}`,
        writId,
        input: rewardGuild ? { alternative: 0, rewardGuild } : { alternative },
        turnedIn,
        rewardGuild
    }))
)

/** R-4.4-H1 Every alternative of every weapon. */
const WeaponBonuses = registered.filter(isTiming('attack')).flatMap(({ writId, bonuses }) =>
    bonuses.map(({ turnedIn, attack }, alternative) => ({
        name: `${writId} ${alternative}`,
        writId,
        alternative,
        turnedIn,
        attack
    }))
)

const Weapons = registered.filter(isTiming('attack')).map(({ writId }) => writId)
const AtWillMandates = registered.filter(isTiming('at-will')).map(({ writId }) => writId)

/** R-4.4.4 The writ limit's seat is over it by three charters beside the writ it holds. */
function fillTheLimit(state: HydratedFeudumGameState, seat: string, window: WindowName): void {
    if (window === 'writ limit') {
        for (const charter of Charters.slice(0, 3)) {
            holdWrit(state, seat, charter)
        }
    }
}

function setStars(state: HydratedFeudumGameState, seat: string, guild?: GuildId): void {
    if (guild) {
        setPawns(state, seat, [guild, guild, guild])
    }
}

describe('corpus reach: the mandates', () => {
    it('sweeps all eight: six at will with 14 alternatives, two weapons with 4', () => {
        expect(AtWillMandates).toHaveLength(6)
        expect(AtWill).toHaveLength(14)
        expect(Weapons).toHaveLength(2)
        expect(WeaponBonuses).toHaveLength(4)
    })

    describe.each(Windows)('R-4.4-H1 in the at-will window: %s', (window) => {
        it.each(AtWill)('R-4.4.2 $name is usable', ({ writId, input, turnedIn, rewardGuild }) => {
            const { table, playerId } = tableInWindow(window, (state, seat) => {
                returnAllGoods(state, seat)
                holdWrit(state, seat, writId)
                fillTheLimit(state, seat, window)
                setStars(state, seat, rewardGuild)
                for (const good of turnedIn) {
                    giveGood(state, seat, good)
                }
            })
            expect(table.offered(playerId)).toContain(ActionType.PlayMandate)
            const slot = table.hydrated().writDeck.nextBottom

            table.send(playerId, { type: ActionType.PlayMandate, writId, ...input })

            const state = table.hydrated()
            expect(state.publicDeckWrits).toContainEqual({ slot, writId })
            expect(state.getPlayerState(playerId).requireWrits()).not.toContain(writId)
            expect(conservationBreaks(canonicalOf(state))).toEqual([])
        })

        it.each(AtWill.filter(({ turnedIn }) => turnedIn.length > 0))(
            'R-4.3.3 $name is covered by tiles when short of every good',
            ({ writId, input, turnedIn }) => {
                const { table, playerId } = tableInWindow(window, (state, seat) => {
                    returnAllGoods(state, seat)
                    holdWrit(state, seat, writId)
                    fillTheLimit(state, seat, window)
                    for (const _good of turnedIn) {
                        giveTile(state, seat)
                    }
                })
                const tiles = table.seat(playerId).regionTiles
                const offer = playMandateOffers(table.hydrated(), playerId).find(
                    ({ alternative }) => alternative === input.alternative
                )
                expect(offer).toMatchObject({ wildTileNeeded: true })
                expect(offer?.refused).toBeUndefined()

                table.send(playerId, {
                    type: ActionType.PlayMandate,
                    writId,
                    ...input,
                    wildTiles: turnedIn.map((good, index) => ({ tileId: tiles[index], good }))
                })

                const state = table.hydrated()
                expect(state.tilesOutOfGame).toEqual(expect.arrayContaining(tiles))
                expect(conservationBreaks(canonicalOf(state))).toEqual([])
            }
        )

        it.each(Weapons)('R-4.4-H1 %s is refused at will', (writId) => {
            const { table, playerId } = tableInWindow(window, (state, seat) => {
                holdWrit(state, seat, writId)
                fillTheLimit(state, seat, window)
            })
            expect(table.offered(playerId)).not.toContain(ActionType.PlayMandate)
            expect(playMandateOffers(table.hydrated(), playerId)).toEqual([])
            for (const alternative of [0, 1]) {
                expect(() =>
                    table.send(playerId, { type: ActionType.PlayMandate, writId, alternative })
                ).toThrow(`${writId} has no at-will effect`)
            }
        })
    })

    describe('R-4.8.2 in CommitAttack', () => {
        function atCommit(writId: (typeof Weapons)[number], goods: readonly Good[], tiles = 0) {
            const combat = tableAtCombat()
            setUp(combat.table, (state) => {
                returnAllGoods(state, combat.attackerId)
                holdWrit(state, combat.attackerId, writId)
                for (const good of goods) {
                    giveGood(state, combat.attackerId, good)
                }
                for (let tile = 0; tile < tiles; tile++) {
                    giveTile(state, combat.attackerId)
                }
            })
            conquer(combat, PawnOf(combat.defenderId))
            answer(combat)
            return combat
        }

        it.each(WeaponBonuses)(
            'R-4.4-H1 $name is usable',
            ({ writId, alternative, turnedIn, attack }) => {
                const combat = atCommit(writId, turnedIn)
                const [action] = commit(combat, { weapons: [{ writId, alternative }] })
                expect(action).toMatchObject({
                    metadata: { weaponStrengths: [{ writId, attack }] }
                })
            }
        )

        it.each(WeaponBonuses.filter(({ turnedIn }) => turnedIn.length > 0))(
            'R-4.3.3 $name is covered by a tile when short of its good',
            ({ writId, alternative, turnedIn, attack }) => {
                const combat = atCommit(writId, [], turnedIn.length)
                const { table, attackerId } = combat
                expect(commitAttackOffer(table.hydrated(), attackerId)?.weapons).toContainEqual(
                    expect.objectContaining({ writId, alternative })
                )
                const tiles = table.seat(attackerId).regionTiles
                const [action] = commit(combat, {
                    weapons: [{ writId, alternative }],
                    wildTiles: turnedIn.map((good, index) => ({ tileId: tiles[index], good }))
                })
                expect(action).toMatchObject({
                    metadata: { weaponStrengths: [{ writId, attack }] }
                })
                expect(table.state.tilesOutOfGame).toEqual(expect.arrayContaining(tiles))
            }
        )

        it.each(AtWillMandates)('R-4.4-H1 %s has no effect in an attack', (writId) => {
            const combat = tableAtCombat()
            setUp(combat.table, (state) => holdWrit(state, combat.attackerId, writId))
            conquer(combat, PawnOf(combat.defenderId))
            answer(combat)
            expect(commitAttackOffer(combat.table.hydrated(), combat.attackerId)?.weapons).toEqual(
                []
            )
            expect(() => commit(combat, { weapons: [{ writId, alternative: 0 }] })).toThrow(
                `${writId} has no effect in an attack`
            )
        })
    })
})
