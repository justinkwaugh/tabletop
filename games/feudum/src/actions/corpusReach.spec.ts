import { describe, expect, it } from 'vitest'
import { RegionIds } from '../data/regionTiles.js'
import { ActionCardKinds, type ActionCardKind } from '../data/cards.js'
import { Goods, type Character, type Good, type GuildId } from '../data/components.js'
import { Mandates, type CharterId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { atWillWindow } from '../model/atWill.js'
import { conservationBreaks } from '../model/canonicalValidator.js'
import type { WritDrawSource } from '../model/flow.js'
import { queueFollowUp } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { placeMarker } from '../model/locationControl.js'
import { collectTopTile } from '../model/regionStacks.js'
import { goodCounts, type GoodCounts } from '../model/stateSchemas.js'
import { returnGoodToHaversack } from '../model/supply.js'
import {
    Charters,
    giveTile,
    returnAllGoods,
    tableInWindow,
    type WindowName
} from '../testing/atWill.js'
import { meetCharter } from '../testing/charters.js'
import {
    addPawn,
    answer,
    Battlefield,
    buildFeudum,
    commit,
    conquer,
    holdWrit,
    PawnOf,
    stackWrit,
    tableAtCombat
} from '../testing/combat.js'
import {
    ruleFarm,
    setBarn,
    setCarts,
    setJourneyman,
    setMarket,
    setMaster,
    setPawns,
    setRowMarkers,
    setScrolls,
    tableAtGuild
} from '../testing/guilds.js'
import { giveGood, giveSeal, setUp, spaceOfKind } from '../testing/improving.js'
import { giveFood, starve, tableAtStarve } from '../testing/starve.js'
import { canonicalOf } from '../testing/state.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import { writRegistry, type WritRegistration } from '../writs/writRegistry.js'
import { playMandateOffers } from './playMandate.js'
import { commitAttackOffer } from './commitAttack.js'
import { cardOf, cardPlayOffers, reasonCardPlayRefused, type RepeatMode } from './cardPlay.js'
import { feastOffers } from './feast.js'
import { harvestOffers } from './harvest.js'
import { improveOffers } from './improve.js'
import { influenceOffers } from './influence.js'
import { keepWritsOffer } from './keepWrits.js'
import { migrateOffers } from './migrate.js'
import { moveOffers } from './move.js'
import { starveOffers } from './starveThePeople.js'
import { taxPreview } from './tax.js'
import { tendLandscapeOffers } from './tendLandscape.js'

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

/** A card play as `Table.send` takes it. */
type CardMove = Record<string, unknown> & { type: ActionType }

/** One way to use a card on its owner's turn, whichever route brought the card there. */
interface CardCase {
    readonly name: string
    readonly kind: ActionCardKind
    readonly use: 'regular' | 'special'
    arrange(state: HydratedFeudumGameState, seat: string, rival: string): void
    move(state: HydratedFeudumGameState, seat: string, rival: string): CardMove
    /** Decides what the play asks before its card is done. */
    answer?(table: Table, seat: string, rival: string): void
    /** R-3.4 Its effect shows, and what a special left of the regular action. */
    fired(
        after: HydratedFeudumGameState,
        before: HydratedFeudumGameState,
        seat: string,
        rival: string
    ): void
}

const Elsewhere = 'space.forest.2'

function sumOf(counts: GoodCounts): number {
    return Goods.reduce((sum, good) => sum + counts[good], 0)
}

function firstFavours(drawn: GoodCounts, favours: number): GoodCounts {
    const chosen = goodCounts()
    let left = favours
    for (const good of Goods) {
        chosen[good] = Math.min(drawn[good], left)
        left -= chosen[good]
    }
    return chosen
}

function standAs(
    state: HydratedFeudumGameState,
    seat: string,
    n: 1 | 2,
    character: Character
): void {
    state.getPlayerState(seat).pawns[n - 1].character = character
}

function ruleFirst(state: HydratedFeudumGameState, seat: string, kind: 'outpost' | 'town'): void {
    placeMarker(state, seat, spaceOfKind(state, kind))
}

function serfOnOutpost(state: HydratedFeudumGameState, seat: string, rival: string): void {
    const spaceId = spaceOfKind(state, 'outpost')
    placeMarker(state, rival, spaceId)
    placeMarker(state, seat, spaceId)
    giveGood(state, seat, 'wood')
    collectTopTile(state, seat, RegionIds[0])
}

function keepFirst(table: Table, seat: string, extra: Record<string, unknown> = {}): void {
    const drawn = table.hydrated().flow.writDraw?.drawn ?? []
    table.send(seat, { type: ActionType.KeepWrits, keep: drawn.slice(0, 1), ...extra })
}

function fightToTheEnd(table: Table, seat: string, rival: string): void {
    table.send(rival, { type: ActionType.AnswerAttack, revealsInfo: true, flipDefend: false })
    table.send(seat, { type: ActionType.CommitAttack, saltpeter: 0, weapons: [] })
}

function noble(state: HydratedFeudumGameState, seat: string, rival: string): void {
    addPawn(state, seat, 'noble')
    buildFeudum(state, seat)
    placeMarker(state, rival, Battlefield)
    // R-3.14-H1 With no food to cover Royal Immunity the rival isn't asked.
    const { goods } = state.getPlayerState(rival)
    returnGoodToHaversack(state, 'food', goods.food)
    goods.food = 0
}

function feastReady(state: HydratedFeudumGameState, seat: string, rival: string): void {
    setPawns(state, seat, ['knight'])
    state.supply.haversack.sulfur -= 1
    state.getPlayerState(seat).barrel = 1
    setMaster(state, rival, 'merchant')
    setMarket(state, { iron: 2, wood: 3 })
    setCarts(state, { iron: 1 })
}

/** R-3.5 Every regular action and special ability played on the owner's turn. */
const CardCases: readonly CardCase[] = [
    {
        name: 'Migrate',
        kind: 'migrate',
        use: 'regular',
        arrange: (state, seat) => giveGood(state, seat, 'food'),
        move: () => ({
            type: ActionType.Migrate,
            pawn: 2,
            onto: { character: 'monk', spaceId: Battlefield }
        }),
        fired: (after, before, seat) => {
            const player = after.getPlayerState(seat)
            expect(player.pawns[1].spaceId).toBe(Battlefield)
            expect(player.goods.food).toBe(before.getPlayerState(seat).goods.food - 1)
        }
    },
    {
        // R-3.6.2 In addition: still the one pawn and its food, from any starting space.
        name: 'Migrate with Distant Kin',
        kind: 'migrate',
        use: 'special',
        arrange: (state, seat) => {
            standAs(state, seat, 1, 'alchemist')
            giveGood(state, seat, 'food')
        },
        move: () => ({
            type: ActionType.Migrate,
            pawn: 2,
            onto: { character: 'monk', spaceId: Elsewhere },
            distantKin: true
        }),
        fired: (after, before, seat) => {
            const player = after.getPlayerState(seat)
            expect(player.pawns[1].spaceId).toBe(Elsewhere)
            expect(player.pawns[2].spaceId).toBeUndefined()
            expect(player.goods.food).toBe(before.getPlayerState(seat).goods.food - 1)
        }
    },
    {
        name: 'Move',
        kind: 'move',
        use: 'regular',
        arrange: () => {},
        move: (_state, seat) => ({
            type: ActionType.Move,
            steps: [
                {
                    piece: { kind: 'pawn', playerId: seat, n: 1 },
                    to: 'space.desert.4',
                    medium: 'road'
                }
            ]
        }),
        fired: (after, before, seat) => {
            const player = after.getPlayerState(seat)
            expect(player.pawns[0].spaceId).toBe('space.desert.4')
            expect(player.successfulMoves).toBe(before.getPlayerState(seat).successfulMoves + 1)
        }
    },
    {
        // R-3.7.3 In addition: the allowance's step, then the monk's +1.
        name: 'Move with Godspeed',
        kind: 'move',
        use: 'special',
        arrange: (state, seat) => standAs(state, seat, 1, 'monk'),
        move: (_state, seat) => ({
            type: ActionType.Move,
            steps: [
                {
                    piece: { kind: 'pawn', playerId: seat, n: 1 },
                    to: 'space.desert.4',
                    medium: 'road'
                }
            ],
            godspeed: { pawn: 1, to: 'space.forest.3', medium: 'road' }
        }),
        fired: (after, _before, seat) => {
            expect(after.getPlayerState(seat).pawns[0].spaceId).toBe('space.forest.3')
        }
    },
    {
        name: 'Influence',
        kind: 'influence',
        use: 'regular',
        arrange: () => {},
        move: () => ({ type: ActionType.Influence }),
        fired: (after, _before, seat) => {
            expect(after.spaces[Battlefield].ruler?.playerId).toBe(seat)
        }
    },
    {
        // R-3.8.3 In addition: every other space still takes its marker.
        name: 'Influence with Money is Influence',
        kind: 'influence',
        use: 'special',
        arrange: (state, seat, rival) => {
            standAs(state, seat, 1, 'merchant')
            addPawn(state, seat, 'farmer', Elsewhere)
            placeMarker(state, rival, Battlefield)
        },
        move: () => ({ type: ActionType.Influence, moneyIsInfluence: Battlefield }),
        fired: (after, before, seat, rival) => {
            expect(after.spaces[Battlefield].ruler?.playerId).toBe(seat)
            expect(after.spaces[Battlefield].serf?.playerId).toBe(rival)
            expect(after.spaces[Elsewhere].ruler?.playerId).toBe(seat)
            expect(after.getPlayerState(seat).shillings).toBe(
                before.getPlayerState(seat).shillings - 1
            )
        }
    },
    {
        name: 'Improve',
        kind: 'improve',
        use: 'regular',
        arrange: (state, seat) => {
            ruleFirst(state, seat, 'outpost')
            giveGood(state, seat, 'wood')
        },
        move: (state, seat) => {
            const [offer] = improveOffers(state, seat)
            return {
                type: ActionType.Improve,
                spaceId: offer.spaceId,
                discId: offer.discs[0].discId
            }
        },
        fired: (after, before, seat) => {
            const spaceId = spaceOfKind(before, 'outpost')
            expect(after.spaces[spaceId].location.kind).toBe('farm')
            expect(after.getPlayerState(seat).goods.wood).toBe(0)
            expect(after.getPlayerState(seat).regionTiles).toHaveLength(1)
        }
    },
    {
        // R-3.9.3 Instead: the location stays as it was and no tile is taken.
        name: 'Tend Landscape',
        kind: 'improve',
        use: 'special',
        arrange: serfOnOutpost,
        move: (state, seat) => ({
            type: ActionType.TendLandscape,
            tileId: state.getPlayerState(seat).regionTiles[0],
            spaceId: spaceOfKind(state, 'outpost'),
            collect: false
        }),
        fired: (after, before, seat, rival) => {
            const spaceId = spaceOfKind(before, 'outpost')
            const player = after.getPlayerState(seat)
            expect(after.spaces[spaceId].landscape?.tileId).toBe(
                before.getPlayerState(seat).regionTiles[0]
            )
            expect(after.spaces[spaceId].location.kind).toBe('outpost')
            expect(after.spaces[spaceId].ruler?.playerId).toBe(rival)
            expect(player.regionTiles).toHaveLength(0)
            expect(player.goods.wood).toBe(0)
        }
    },
    {
        name: 'Explore',
        kind: 'explore',
        use: 'regular',
        arrange: (state, seat) => ruleFirst(state, seat, 'outpost'),
        move: () => ({ type: ActionType.Explore, revealsInfo: true }),
        answer: (table, seat) => keepFirst(table, seat),
        fired: (after, before, seat) => {
            const player = after.getPlayerState(seat)
            expect(player.writCount).toBe(before.getPlayerState(seat).writCount + 1)
            expect(player.goods.iron).toBe(before.getPlayerState(seat).goods.iron)
        }
    },
    {
        // R-3.10.2 In addition: the first keep stands, and the iron buys one more.
        name: 'Explore with Shovels & Swords',
        kind: 'explore',
        use: 'special',
        arrange: (state, seat) => ruleFirst(state, seat, 'outpost'),
        move: () => ({ type: ActionType.Explore, revealsInfo: true }),
        answer: (table, seat) => {
            keepFirst(table, seat, { shovelsAndSwords: true })
            keepFirst(table, seat)
        },
        fired: (after, before, seat) => {
            const player = after.getPlayerState(seat)
            expect(player.writCount).toBe(before.getPlayerState(seat).writCount + 2)
            expect(player.goods.iron).toBe(before.getPlayerState(seat).goods.iron - 1)
        }
    },
    {
        name: 'Harvest',
        kind: 'harvest',
        use: 'regular',
        arrange: (state, seat) => {
            ruleFarm(state, seat, {})
        },
        move: (state, seat) => ({
            type: ActionType.Harvest,
            revealsInfo: true,
            spaceId: state.ruledSpaceIds(seat)[0],
            mode: 'plain'
        }),
        fired: (after, before, seat) => {
            // R-3.11.2 A total of 5, with one farm and no bead.
            expect(sumOf(after.spaces[before.ruledSpaceIds(seat)[0]].goods)).toBe(5)
            expect(after.getPlayerState(seat).score).toBe(before.getPlayerState(seat).score + 1)
        }
    },
    {
        // R-3.11.3 In addition: the harvest and its vp stand, with the favours chosen openly.
        name: 'Inspect the Harvest',
        kind: 'harvest',
        use: 'special',
        arrange: (state, seat) => {
            ruleFarm(state, seat, {})
        },
        move: (state, seat) => ({
            type: ActionType.Harvest,
            revealsInfo: true,
            spaceId: state.ruledSpaceIds(seat)[0],
            mode: 'inspect'
        }),
        answer: (table, seat) => {
            const { harvest } = table.hydrated().flow
            table.send(seat, {
                type: ActionType.ChooseFavours,
                favours: firstFavours(harvest?.drawn ?? goodCounts(), harvest?.favours ?? 0)
            })
        },
        fired: (after, before, seat) => {
            // R-3.11.2 A total of 5 splits into a partial of 4 and 1 favour.
            expect(sumOf(after.spaces[before.ruledSpaceIds(seat)[0]].goods)).toBe(4)
            expect(after.getPlayerState(seat).score).toBe(before.getPlayerState(seat).score + 1)
        }
    },
    {
        name: 'Tax',
        kind: 'tax',
        use: 'regular',
        arrange: (state, seat) => ruleFirst(state, seat, 'town'),
        move: () => ({ type: ActionType.Tax }),
        fired: (after, before, seat) => {
            const player = after.getPlayerState(seat)
            const held = before.getPlayerState(seat)
            expect(player.shillings).toBe(held.shillings + 2)
            expect(player.influenceSupply).toBe(held.influenceSupply)
        }
    },
    {
        // R-3.12.2 In addition: the shillings, and a marker back.
        name: 'Tax with Reinforcements',
        kind: 'tax',
        use: 'special',
        arrange: (state, seat) => {
            ruleFirst(state, seat, 'town')
            standAs(state, seat, 1, 'knight')
        },
        move: () => ({ type: ActionType.Tax }),
        fired: (after, before, seat) => {
            const player = after.getPlayerState(seat)
            const held = before.getPlayerState(seat)
            expect(player.shillings).toBe(held.shillings + 2)
            expect(player.influenceSupply).toBe(held.influenceSupply + 1)
        }
    },
    {
        name: 'Conquer',
        kind: 'conquer',
        use: 'regular',
        arrange: (state, seat) => {
            // R-4.8 Three attacking pawns outfight one defending pawn.
            addPawn(state, seat)
            addPawn(state, seat)
        },
        move: (_state, _seat, rival) => ({
            type: ActionType.Conquer,
            spaceId: Battlefield,
            target: PawnOf(rival)
        }),
        answer: fightToTheEnd,
        fired: (after, before, seat, rival) => {
            expect(after.flow.combat).toBeUndefined()
            expect(after.getPlayerState(rival).pawns[0].spaceId).toBeUndefined()
            expect(after.getPlayerState(seat).score).toBe(before.getPlayerState(seat).score + 2)
        }
    },
    {
        // R-3.13.2 Instead: no contest and no vp; the rival's pawn stands, its serf goes.
        name: 'Starve the People',
        kind: 'conquer',
        use: 'special',
        arrange: noble,
        move: (_state, _seat, rival) => ({
            type: ActionType.StarveThePeople,
            spaceId: Battlefield,
            targetPlayerId: rival,
            role: 'serf'
        }),
        fired: (after, before, seat, rival) => {
            expect(after.spaces[Battlefield].serf).toBeUndefined()
            expect(after.flow.combat).toBeUndefined()
            expect(after.getPlayerState(rival).pawns[0].spaceId).toBe(Battlefield)
            expect(after.getPlayerState(seat).score).toBe(before.getPlayerState(seat).score)
        }
    },
    {
        name: 'Defend, in turn',
        kind: 'defend',
        use: 'regular',
        arrange: () => {},
        move: () => ({ type: ActionType.PlayDefend }),
        fired: (after, before, seat) => {
            expect(after.getPlayerState(seat).score).toBe(before.getPlayerState(seat).score + 1)
        }
    },
    {
        name: 'Guild',
        kind: 'guild',
        use: 'regular',
        arrange: (state, seat) => {
            setMaster(state, seat, 'farmer')
            setMarket(state, { saltpeter: 3, sulfur: 3, iron: 3, wood: 4, food: 4 })
            setBarn(state, { saltpeter: 1, sulfur: 1, iron: 1 })
        },
        move: () => ({
            type: ActionType.GuildAction,
            guildId: 'farmer',
            fn: 'push',
            params: { goods: ['saltpeter', 'sulfur', 'iron'] }
        }),
        fired: (after, _before, seat) => {
            expect(after.getPlayerState(seat).guildsUsed).toEqual(['farmer'])
            expect(after.guilds.farmer.barn).toEqual(goodCounts())
        }
    },
    {
        // R-3.16.3 Instead: the rival's own function, the barrel's sulfur and the feast's vp.
        name: 'Feast',
        kind: 'guild',
        use: 'special',
        arrange: feastReady,
        move: (_state, _seat, rival) => ({
            type: ActionType.Feast,
            spaceId: Battlefield,
            opponentId: rival,
            guildId: 'merchant',
            params: { goods: ['iron', 'wood', 'iron', 'wood'] }
        }),
        fired: (after, before, seat) => {
            const player = after.getPlayerState(seat)
            expect(player.barrel).toBe(0)
            expect(player.guildsUsed).toEqual(['merchant'])
            expect(player.score).toBeGreaterThanOrEqual(before.getPlayerState(seat).score + 3)
        }
    }
]

function caseNamed(name: string): CardCase {
    const row = CardCases.find((candidate) => candidate.name === name)
    if (!row) {
        throw new Error(`No card case ${name}`)
    }
    return row
}

/** R-3.15 What Repeat reaches, x2 by `repeat`, every other by `deja-vu`; R-3.15.2 never these. */
const Replays = CardCases.filter(({ kind }) => cardOf(kind).symbols.replay !== 'crossed-x2').map(
    (row): CardCase & { readonly mode: RepeatMode } => ({
        ...row,
        mode: cardOf(row.kind).symbols.replay === 'x2' ? 'repeat' : 'deja-vu'
    })
)

const RivalHand: ActionCardKind[] = ['tax', 'harvest', 'explore', 'influence']

/** Cards the seat holds only so the one under test is never its last. */
function fillersBeside(kind: ActionCardKind): ActionCardKind[] {
    return RivalHand.filter((filler) => filler !== kind).slice(0, 2)
}

interface CardTable {
    readonly table: Table
    readonly seat: string
    readonly rival: string
}

/** R-3.1, R-3.3 The seat asked holds this hand, a sulfur on its pouch if it will play two. */
function tableHolding(hand: ActionCardKind[], sequential = false): CardTable {
    const table = tableAtPlayingCards(() => ({ cards: RivalHand }))
    const seat = table.asked
    const [rival] = table.order.filter((playerId) => playerId !== seat)
    setUp(table, (state) => {
        const player = state.getPlayerState(seat)
        player.hand = [...hand]
        player.handCount = hand.length
        if (sequential) {
            player.goods.sulfur -= 1
            player.pouch = 'sulfur'
        }
    })
    return { table, seat, rival }
}

function arrange(row: CardCase, { table, seat, rival }: CardTable): void {
    setUp(table, (state) => {
        row.arrange(state, seat, rival)
        state.recomputeRanks()
    })
}

function forfeit(table: Table, playerId: string, kind: ActionCardKind, secondCard?: true): void {
    table.send(playerId, {
        type: ActionType.ForfeitCard,
        kind,
        ...(secondCard ? { secondCard } : {})
    })
}

/** R-3.2 The other seats forfeit until this seat is asked again. */
function roundTo(table: Table, seat: string): void {
    while (table.asked !== seat) {
        forfeit(table, table.asked, table.seat(table.asked).requireHand()[0])
    }
}

function expectTurnPassed(table: Table, seat: string): void {
    const { turn } = table.hydrated().flow
    expect(turn?.playerId).not.toBe(seat)
    expect(turn?.playerId).toBeDefined()
}

/** R-3.2 Plays the card, answers what it asks, keeps no disc; the effect and the totals hold. */
function play(
    row: CardCase,
    { table, seat, rival }: CardTable,
    input: Record<string, unknown>,
    recorded: object
): void {
    const before = table.hydrated()
    expect(table.offered(seat)).toContain(row.move(before, seat, rival).type)
    table.send(seat, { ...row.move(before, seat, rival), ...input })
    row.answer?.(table, seat, rival)
    while (table.state.machineState === MachineState.PlacingDisc) {
        table.send(seat, { type: ActionType.PlaceDisc, place: false })
    }
    expect(table.seat(seat).played.at(-1)).toEqual(recorded)
    const after = table.hydrated()
    row.fired(after, before, seat, rival)
    expect(conservationBreaks(canonicalOf(after))).toEqual([])
}

/** R-3.15, R-3.15-H1 Forfeits the card first, so a replay has a play to replay; arranges after. */
function tableToReplay(row: CardCase, sequential = false): CardTable {
    const [filler, second] = fillersBeside(row.kind)
    const held = tableHolding(['repeat', row.kind, filler, second], sequential)
    forfeit(held.table, held.seat, row.kind)
    roundTo(held.table, held.seat)
    arrange(row, held)
    return held
}

function replayRecord({ kind, use, mode }: (typeof Replays)[number]) {
    return {
        kind: 'repeat',
        use,
        replayedKind: kind,
        ...(mode === 'deja-vu' ? { dejaVu: true } : {})
    }
}

describe('corpus reach: the cards', () => {
    it('R-3.5 sweeps all eleven: ten with a play of their own, Repeat through what it replays', () => {
        const kinds = new Set(CardCases.map(({ kind }) => kind))
        expect([...kinds, 'repeat'].sort()).toEqual([...ActionCardKinds].sort())
        expect(CardCases).toHaveLength(19)
        expect(Replays).toHaveLength(16)
        expect(Replays.filter(({ mode }) => mode === 'repeat')).toHaveLength(6)
    })

    describe('R-3.2 from the hand', () => {
        it.each(CardCases)('$name is offered and fires', (row) => {
            const held = tableHolding([row.kind, ...fillersBeside(row.kind)])
            arrange(row, held)
            play(row, held, {}, { kind: row.kind, use: row.use })
            expectTurnPassed(held.table, held.seat)
        })
    })

    describe('R-3.3-H1 in a sequential turn', () => {
        it.each(CardCases)('$name is the second card', (row) => {
            const [first, last] = fillersBeside(row.kind)
            const held = tableHolding([first, row.kind, last], true)
            arrange(row, held)
            forfeit(held.table, held.seat, first, true)
            expect(held.table.asked).toBe(held.seat)

            play(row, held, {}, { kind: row.kind, use: row.use })

            expect(held.table.seat(held.seat).sequentialUsed).toBe(true)
            expectTurnPassed(held.table, held.seat)
        })

        it.each(CardCases)('$name declares the second card', (row) => {
            const [last, other] = fillersBeside(row.kind)
            const held = tableHolding([row.kind, last, other], true)
            arrange(row, held)

            play(row, held, { secondCard: true }, { kind: row.kind, use: row.use })

            expect(held.table.hydrated().flow.turn).toMatchObject({
                playerId: held.seat,
                secondCard: true
            })
            forfeit(held.table, held.seat, last)
            expectTurnPassed(held.table, held.seat)
        })
    })

    describe('R-3.15 replayed', () => {
        it.each(Replays)('$name by $mode', (row) => {
            const held = tableToReplay(row)
            const { saltpeter } = held.table.seat(held.seat).goods
            expect(cardPlayOffers(held.table.hydrated(), held.seat).repeats).toContainEqual({
                kind: row.kind,
                mode: row.mode
            })

            play(row, held, { asRepeat: row.mode }, replayRecord(row))

            const seat = held.table.seat(held.seat)
            expect(seat.repeatUsed).toBe(true)
            // R-3.11.3 The favour chosen may itself be a saltpeter.
            if (row.name !== 'Inspect the Harvest') {
                expect(seat.goods.saltpeter).toBe(
                    row.mode === 'deja-vu' ? saltpeter - 1 : saltpeter
                )
            }
            expectTurnPassed(held.table, held.seat)
        })

        it.each(Replays)('R-3.3-H1 $name by $mode as the second card', (row) => {
            const held = tableToReplay(row, true)
            const [filler] = fillersBeside(row.kind)
            forfeit(held.table, held.seat, filler, true)
            expect(held.table.asked).toBe(held.seat)

            play(row, held, { asRepeat: row.mode }, replayRecord(row))

            expectTurnPassed(held.table, held.seat)
        })

        it.each(Replays)('R-3.3-H1 $name by $mode declares the second card', (row) => {
            const held = tableToReplay(row, true)
            const [filler] = fillersBeside(row.kind)

            play(row, held, { asRepeat: row.mode, secondCard: true }, replayRecord(row))

            expect(held.table.hydrated().flow.turn).toMatchObject({
                playerId: held.seat,
                secondCard: true
            })
            forfeit(held.table, held.seat, filler)
            expectTurnPassed(held.table, held.seat)
        })

        it.each(['conquer', 'defend'] as const)(
            'R-3.15.2 %s never replays, in either mode',
            (kind) => {
                const [filler] = fillersBeside(kind)
                const { table, seat } = tableHolding(['repeat', kind, filler])
                forfeit(table, seat, kind)
                roundTo(table, seat)
                const state = table.hydrated()
                expect(cardPlayOffers(state, seat).repeats).toEqual([])
                for (const asRepeat of ['repeat', 'deja-vu'] as const) {
                    expect(reasonCardPlayRefused(state, seat, kind, { asRepeat })).toBe(
                        `${cardOf(kind).printedName} can't be replayed.`
                    )
                }
            }
        )

        it.each(Replays.filter(({ use, mode }) => use === 'regular' && mode === 'deja-vu'))(
            'R-3.15.1 $name has no x2, so Repeat alone refuses it',
            (row) => {
                const held = tableToReplay(row)
                expect(
                    reasonCardPlayRefused(held.table.hydrated(), held.seat, row.kind, {
                        asRepeat: 'repeat'
                    })
                ).toBe(`${cardOf(row.kind).printedName} has no x2: only Déjà Vu replays it.`)
            }
        )

        it.each(Replays.filter(({ use, mode }) => use === 'regular' && mode === 'repeat'))(
            'R-3.15.2 $name has x2: the offer lights Repeat, and Déjà Vu is still legal for a saltpeter',
            (row) => {
                const held = tableToReplay(row)
                const state = held.table.hydrated()
                expect(cardPlayOffers(state, held.seat).repeats).toContainEqual({
                    kind: row.kind,
                    mode: 'repeat'
                })
                expect(
                    reasonCardPlayRefused(state, held.seat, row.kind, { asRepeat: 'deja-vu' })
                ).toBeUndefined()
            }
        )
    })

    describe('R-3.2 forfeited', () => {
        function scores(table: Table): number[] {
            return table.order.map((playerId) => table.seat(playerId).score)
        }

        it.each(ActionCardKinds)('%s plays and does nothing, its turn then passing', (kind) => {
            const { table, seat } = tableHolding([kind, ...fillersBeside(kind)])
            const goods = { ...table.seat(seat).goods }
            const points = scores(table)

            expect(table.offered(seat)).toContain(ActionType.ForfeitCard)
            forfeit(table, seat, kind)

            expect(table.seat(seat).played).toEqual([{ kind, use: 'forfeited' }])
            expect(table.seat(seat).goods).toEqual(goods)
            expect(scores(table)).toEqual(points)
            expect(table.seat(seat).repeatUsed).toBe(false)
            expectTurnPassed(table, seat)
        })

        it.each(ActionCardKinds)('R-3.3-H1 %s forfeited declares the second card', (kind) => {
            const [last, other] = fillersBeside(kind)
            const { table, seat } = tableHolding([kind, last, other], true)
            forfeit(table, seat, kind, true)
            expect(table.hydrated().flow.turn).toMatchObject({ playerId: seat, secondCard: true })
            forfeit(table, seat, last)
            expectTurnPassed(table, seat)
        })

        it.each(ActionCardKinds)('R-3.3-H1 %s forfeited is the second card', (kind) => {
            const [first, other] = fillersBeside(kind)
            const { table, seat } = tableHolding([first, kind, other], true)
            forfeit(table, seat, first, true)
            forfeit(table, seat, kind)
            expect(table.seat(seat).played.at(-1)).toEqual({ kind, use: 'forfeited' })
            expectTurnPassed(table, seat)
        })

        it.each(ActionCardKinds)(
            'R-3.13-H1 %s alone in the hand can still be forfeited',
            (kind) => {
                const { table, seat } = tableHolding([kind])
                const [offer] = cardPlayOffers(table.hydrated(), seat).cards
                expect(offer.forfeitOnly).toBe(kind === 'conquer' || kind === 'repeat')
                forfeit(table, seat, kind)
                expect(table.seat(seat).played).toEqual([{ kind, use: 'forfeited' }])
            }
        )
    })

    describe('R-3.4, R-3.5 each special wants its need', () => {
        it('R-3.4 either/or replaces the action; every other ability adds to it', () => {
            const instead = ActionCardKinds.filter(
                (kind) => cardOf(kind).special.mode === 'instead'
            )
            expect(instead).toEqual(['improve', 'conquer', 'defend', 'guild'])
        })

        const Needs: readonly {
            readonly name: string
            readonly lack: (state: HydratedFeudumGameState, seat: string) => void
            readonly refusal: string
            readonly offered: (
                state: HydratedFeudumGameState,
                seat: string,
                rival: string
            ) => boolean
        }[] = [
            {
                name: 'Migrate with Distant Kin',
                lack: (state, seat) => standAs(state, seat, 1, 'farmer'),
                refusal: 'Distant Kin needs an Alchemist pawn on the board.',
                offered: (state, seat) => migrateOffers(state, seat).distantKinSpaces.length > 0
            },
            {
                name: 'Move with Godspeed',
                lack: (state, seat) => standAs(state, seat, 1, 'farmer'),
                refusal: 'Godspeed needs a Monk pawn on the board.',
                offered: (state, seat) => moveOffers(state, seat).godspeed.length > 0
            },
            {
                name: 'Influence with Money is Influence',
                lack: (state, seat) => standAs(state, seat, 1, 'farmer'),
                refusal: 'Money is Influence needs a Merchant pawn at the location.',
                offered: (state, seat) => influenceOffers(state, seat).moneyIsInfluence.length > 0
            },
            {
                name: 'Influence with Money is Influence',
                lack: (state, seat) => {
                    const player = state.getPlayerState(seat)
                    state.supply.shillings += player.shillings
                    player.shillings = 0
                },
                refusal: 'Money is Influence needs 1 shilling.',
                offered: (state, seat) => influenceOffers(state, seat).moneyIsInfluence.length > 0
            },
            {
                name: 'Tend Landscape',
                lack: (state, seat) => {
                    returnGoodToHaversack(state, 'wood')
                    state.getPlayerState(seat).goods.wood -= 1
                },
                refusal: 'Tend Landscape needs a wood.',
                offered: (state, seat) => tendLandscapeOffers(state, seat).spaceIds.length > 0
            },
            {
                name: 'Inspect the Harvest',
                lack: (state, seat) => standAs(state, seat, 1, 'knight'),
                refusal: 'Inspect the Harvest needs a Farmer pawn on the board.',
                offered: (state, seat) => harvestOffers(state, seat).inspect
            },
            {
                name: 'Starve the People',
                lack: (state, seat) => standAs(state, seat, 2, 'farmer'),
                refusal: 'Starve the People needs a Noble pawn at the location.',
                offered: (state, seat) => starveOffers(state, seat).length > 0
            },
            {
                name: 'Feast',
                lack: (state, seat) => {
                    returnGoodToHaversack(state, 'sulfur')
                    state.getPlayerState(seat).barrel = 0
                },
                refusal: 'Feast needs a sulfur in your barrel.',
                offered: (state, seat) => feastOffers(state, seat).length > 0
            }
        ]

        it.each(Needs)('$name: "$refusal"', ({ name, lack, refusal, offered }) => {
            const row = caseNamed(name)
            const held = tableHolding([row.kind, ...fillersBeside(row.kind)])
            const { table, seat, rival } = held
            arrange(row, held)
            const specialOffer = () =>
                cardPlayOffers(table.hydrated(), seat).cards.find(({ kind }) => kind === row.kind)
                    ?.special

            expect(specialOffer()).toBe(true)
            expect(offered(table.hydrated(), seat, rival)).toBe(true)

            const move = row.move(table.hydrated(), seat, rival)
            setUp(table, (state) => {
                lack(state, seat)
                state.recomputeRanks()
            })

            expect(specialOffer()).toBe(false)
            expect(() => table.send(seat, move)).toThrow(refusal)
            expect(offered(table.hydrated(), seat, rival)).toBe(false)
        })

        it('R-3.10.2 Shovels & Swords wants an iron at the keep', () => {
            const row = caseNamed('Explore with Shovels & Swords')
            const held = tableHolding(['explore', 'tax', 'guild'])
            const { table, seat, rival } = held
            arrange(row, held)
            const specialOffer = () => cardPlayOffers(table.hydrated(), seat).cards[0].special
            expect(specialOffer()).toBe(true)
            setUp(table, (state) => {
                returnGoodToHaversack(state, 'iron')
                state.getPlayerState(seat).goods.iron -= 1
            })
            expect(specialOffer()).toBe(false)

            table.send(seat, row.move(table.hydrated(), seat, rival))

            expect(keepWritsOffer(table.hydrated(), seat)?.shovelsAndSwords).toBeUndefined()
            expect(() => keepFirst(table, seat, { shovelsAndSwords: true })).toThrow(
                'Shovels & Swords needs an iron.'
            )
        })

        it('R-3.10.2 Shovels & Swords is offered at the keep with the iron', () => {
            const row = caseNamed('Explore with Shovels & Swords')
            const held = tableHolding(['explore', 'tax', 'guild'])
            arrange(row, held)
            held.table.send(held.seat, row.move(held.table.hydrated(), held.seat, held.rival))
            expect(keepWritsOffer(held.table.hydrated(), held.seat)?.shovelsAndSwords).toBeDefined()
        })

        it('R-3.12-H1 Reinforcements comes with a Knight pawn and not without', () => {
            const row = caseNamed('Tax with Reinforcements')
            const held = tableHolding(['tax', 'guild', 'move'])
            const { table, seat } = held
            arrange(row, held)
            expect(cardPlayOffers(table.hydrated(), seat).cards[0].special).toBe(true)
            expect(taxPreview(table.hydrated(), seat).reinforcements).toBeDefined()

            setUp(table, (state) => {
                standAs(state, seat, 1, 'farmer')
                state.recomputeRanks()
            })

            expect(cardPlayOffers(table.hydrated(), seat).cards[0].special).toBe(false)
            expect(taxPreview(table.hydrated(), seat).reinforcements).toBeUndefined()
        })

        it('R-3.15.2 Déjà Vu wants a saltpeter; Repeat still replays an x2 card without one', () => {
            const held = tableHolding(['repeat', 'move', 'explore', 'tax'])
            const { table, seat } = held
            forfeit(table, seat, 'move')
            roundTo(table, seat)
            forfeit(table, seat, 'explore')
            roundTo(table, seat)
            expect(cardPlayOffers(table.hydrated(), seat).cards[0].special).toBe(true)
            expect(cardPlayOffers(table.hydrated(), seat).repeats).toEqual([
                { kind: 'move', mode: 'repeat' },
                { kind: 'explore', mode: 'deja-vu' }
            ])

            setUp(table, (state) => {
                const player = state.getPlayerState(seat)
                returnGoodToHaversack(state, 'saltpeter', player.goods.saltpeter)
                player.goods.saltpeter = 0
            })

            expect(cardPlayOffers(table.hydrated(), seat).cards[0].special).toBe(false)
            expect(cardPlayOffers(table.hydrated(), seat).repeats).toEqual([
                { kind: 'move', mode: 'repeat' }
            ])
            expect(() =>
                table.send(seat, {
                    type: ActionType.Explore,
                    revealsInfo: true,
                    asRepeat: 'deja-vu'
                })
            ).toThrow('Déjà Vu needs a saltpeter.')
        })
    })

    describe('R-3.14 Defend out of turn', () => {
        it('R-3.14.1 flips when its owner is conquered: +1 defence and its vp', () => {
            const combat = tableAtCombat(['defend', 'tax'])
            const { defenderId } = combat
            const { score } = combat.table.seat(defenderId)
            conquer(combat, PawnOf(defenderId))

            answer(combat, true)

            const seat = combat.table.seat(defenderId)
            expect(seat.played).toEqual([{ kind: 'defend', use: 'defend-flip' }])
            expect(seat.score).toBe(score + 1)
        })

        it('R-3.14.2 Royal Immunity is never played in turn, food or not', () => {
            const { table, seat } = tableHolding(['defend', 'tax'])
            setUp(table, (state) => giveFood(state, seat))
            expect(cardPlayOffers(table.hydrated(), seat).cards[0].special).toBe(false)
        })

        it('R-3.14.2 Royal Immunity instead: the Starve is cancelled, no vp, the food goes', () => {
            const combat = tableAtStarve('serf')
            const { table, defenderId } = combat
            setUp(table, (state) => giveFood(state, defenderId))
            const { score } = table.seat(defenderId)
            starve(combat)
            expect(table.state.machineState).toBe(MachineState.AwaitingImmunity)

            table.send(defenderId, {
                type: ActionType.AnswerStarve,
                revealsInfo: true,
                royalImmunity: true
            })

            const seat = table.seat(defenderId)
            expect(seat.played).toEqual([{ kind: 'defend', use: 'special' }])
            expect(seat.goods.food).toBe(0)
            expect(seat.score).toBe(score)
            expect(table.state.spaces[Battlefield].serf).toMatchObject({
                playerId: defenderId,
                immune: true
            })
        })

        it('R-3.14-H1 Royal Immunity without a food: nobody is asked and the Starve stands', () => {
            const combat = tableAtStarve('serf')
            starve(combat)
            expect(combat.table.state.flow.starve).toBeUndefined()
            expect(combat.table.state.spaces[Battlefield].serf).toBeUndefined()
        })
    })
})
