import { describe, expect, it } from 'vitest'
import type { ActionCardKind } from '../data/cards.js'
import type { Good, GuildId } from '../data/components.js'
import { Mandates, type CharterId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { atWillWindow } from '../model/atWill.js'
import { conservationBreaks } from '../model/canonicalValidator.js'
import type { WritDrawSource } from '../model/flow.js'
import { queueFollowUp } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { placeMarker } from '../model/locationControl.js'
import {
    Charters,
    giveTile,
    returnAllGoods,
    tableInWindow,
    type WindowName
} from '../testing/atWill.js'
import { meetCharter } from '../testing/charters.js'
import {
    answer,
    commit,
    conquer,
    holdWrit,
    PawnOf,
    stackWrit,
    tableAtCombat
} from '../testing/combat.js'
import {
    setJourneyman,
    setPawns,
    setRowMarkers,
    setScrolls,
    tableAtGuild
} from '../testing/guilds.js'
import { giveGood, giveSeal, setUp, spaceOfKind } from '../testing/improving.js'
import { canonicalOf } from '../testing/state.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
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

/** R-4.4.3, R-6.2 What a charter met in full pays. */
const TopScore: Readonly<Record<CharterId, number>> = {
    'writ.charter.sulfur-barrel': 7,
    'writ.charter.eastern-kingdom': 9,
    'writ.charter.monster-defeat': 7,
    'writ.charter.western-kingdom': 9,
    'writ.charter.northern-kingdom': 9,
    'writ.charter.central-kingdom': 9,
    'writ.charter.southern-kingdom': 9,
    'writ.charter.isolated-kingdom': 17
}

const CharterCases = registered
    .filter(isTiming('end-scoring'))
    .map(({ writId }) => ({ writId, vp: TopScore[writId] }))

/** R-4.4.4 What takes a seat holding one charter over the writ limit. */
const LimitFiller = Mandates.slice(0, 3).map(({ id }) => id)

const ExploreHand: ActionCardKind[] = ['explore', 'tax', 'guild']

/** R-3.10.1 The seat rules an outpost, holds a seal and an iron, and has Explore's draw before it. */
function afterExplore(writId: CharterId, position: number) {
    const table = tableAtPlayingCards(() => ({ cards: ExploreHand }))
    const playerId = table.asked
    setUp(table, (state) => {
        stackWrit(state, writId, position)
        giveSeal(state, playerId)
        giveGood(state, playerId, 'iron')
        placeMarker(state, playerId, spaceOfKind(state, 'outpost'))
        state.recomputeRanks()
    })
    table.send(playerId, { type: ActionType.Explore, revealsInfo: true })
    return { table, playerId }
}

/** R-3.10.1, R-3.10.2, R-3.7.5, R-4.6.4 Each way a writ is drawn, leaving the seat to keep it. */
const DrawRoutes: Readonly<
    Record<WritDrawSource, (writId: CharterId) => { table: Table; playerId: string }>
> = {
    explore: (writId) => afterExplore(writId, 0),
    shovels: (writId) => {
        const { table, playerId } = afterExplore(writId, 2)
        const [first] = table.hydrated().flow.writDraw?.drawn ?? []
        table.send(playerId, {
            type: ActionType.KeepWrits,
            revealsInfo: true,
            keep: [first],
            shovelsAndSwords: true
        })
        return { table, playerId }
    },
    voyage: (writId) => {
        const table = tableAtPlayingCards(() => ({ cards: ExploreHand }))
        const playerId = table.asked
        table.moveTo((state) => {
            stackWrit(state, writId)
            giveSeal(state, playerId)
            state.voyageTrack[playerId] = 1
            queueFollowUp(state, { kind: 'voyage', playerId })
            return MachineState.PlacingDisc
        })
        table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        return { table, playerId }
    },
    pull: (writId) => {
        const { table, playerId } = tableAtGuild((state, seat, others) => {
            setJourneyman(state, seat, 'noble', others[0])
            setScrolls(state, [
                'guild.noble.scroll.r1c1',
                'guild.noble.scroll.r1c3',
                'guild.noble.scroll.r2c2',
                'guild.noble.scroll.r3c1'
            ])
            setRowMarkers(state, [2, 2, 2, 2])
            stackWrit(state, writId)
            giveSeal(state, seat)
        })
        table.send(playerId, {
            type: ActionType.GuildAction,
            guildId: 'noble',
            fn: 'pull',
            params: {
                knightRows: [0, 1],
                scrollSpaces: ['guild.noble.scroll.r1c2', 'guild.noble.scroll.r2c1']
            }
        })
        return { table, playerId }
    }
}

const DrawSources = ['explore', 'shovels', 'voyage', 'pull'] as const

/** R-3.2 Every other seat gives up a card until the turn comes back to this one. */
function untilItsWindow(table: Table, playerId: string): void {
    while (atWillWindow(table.hydrated(), playerId) === undefined) {
        const asked = table.asked
        if (table.hydrated().machineState === MachineState.PlacingDisc) {
            table.send(asked, { type: ActionType.PlaceDisc, place: false })
        } else {
            table.send(asked, { type: ActionType.ForfeitCard, kind: table.seat(asked).hand?.[0] })
        }
    }
}

describe('corpus reach: the charters', () => {
    it('R-4.4.3 sweeps all eight', () => {
        expect(CharterCases).toHaveLength(8)
    })

    describe.each(DrawSources)('R-4.4.1 drawn by %s', (source) => {
        it.each(CharterCases)(
            'R-4.4.3, R-6.2 $writId is kept, sealed and scored',
            ({ writId, vp }) => {
                const { table, playerId } = DrawRoutes[source](writId)
                const { writDraw } = table.hydrated().flow
                expect(writDraw).toMatchObject({ playerId, source })
                expect(writDraw?.drawn).toContain(writId)

                table.send(playerId, { type: ActionType.KeepWrits, keep: [writId] })
                expect(table.seat(playerId).requireWrits()).toContain(writId)

                untilItsWindow(table, playerId)
                setUp(table, (state) => meetCharter(state, playerId, writId))
                expect(writRegistry.sealedCharterScores(table.hydrated(), playerId)).toEqual([])

                table.send(playerId, { type: ActionType.SealCharter, writId })

                const state = table.hydrated()
                expect(state.getPlayerState(playerId).requireSealedCharters()).toEqual([writId])
                expect(writRegistry.sealedCharterScores(state, playerId)).toEqual([{ writId, vp }])
                expect(conservationBreaks(canonicalOf(state))).toEqual([])
            }
        )
    })

    describe.each(Windows)('R-4.4-H1 sealed in the at-will window: %s', (window) => {
        it.each(CharterCases)('R-4.4.3, R-6.2 $writId is sealed and scored', ({ writId, vp }) => {
            const { table, playerId } = tableInWindow(window, (state, seat) => {
                holdWrit(state, seat, writId)
                giveSeal(state, seat)
                meetCharter(state, seat, writId)
                if (window === 'writ limit') {
                    for (const filler of LimitFiller) {
                        holdWrit(state, seat, filler)
                    }
                }
            })
            expect(table.offered(playerId)).toContain(ActionType.SealCharter)
            expect(writRegistry.sealedCharterScores(table.hydrated(), playerId)).toEqual([])

            table.send(playerId, { type: ActionType.SealCharter, writId })

            const state = table.hydrated()
            expect(writRegistry.sealedCharterScores(state, playerId)).toEqual([{ writId, vp }])
            expect(conservationBreaks(canonicalOf(state))).toEqual([])
        })
    })
})
