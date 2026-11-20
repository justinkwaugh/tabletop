import { expect } from 'vitest'
import { cardOf, type RepeatMode } from '../actions/cardPlay.js'
import { improveOffers } from '../actions/improve.js'
import type { PlayMandateInput, TakenReward } from '../actions/playMandate.js'
import type { ActionCardKind } from '../data/cards.js'
import {
    Goods,
    VesselTypes,
    type Character,
    type Good,
    type GuildId,
    type VesselType
} from '../data/components.js'
import { RegionIds } from '../data/regionTiles.js'
import type { CharterId, MandateId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { conservationBreaks } from '../model/canonicalValidator.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { placeMarker } from '../model/locationControl.js'
import { collectTopTile } from '../model/regionStacks.js'
import { goodCounts, type GoodCounts } from '../model/stateSchemas.js'
import { returnGoodToHaversack } from '../model/supply.js'
import { writRegistry, type WritRegistration } from '../writs/writRegistry.js'
import { addPawn, Battlefield, buildFeudum, PawnOf } from './combat.js'
import { ruleFarm, setBarn, setCarts, setMarket, setMaster, setPawns } from './guilds.js'
import { giveGood, setUp, spaceOfKind } from './improving.js'
import { writKey } from './corpusWalk.js'
import { canonicalOf } from './state.js'
import { tableAtPlayingCards, type Table } from './table.js'
import { cardTurnSeat } from '../model/turns.js'
import { locationKindOf } from '../model/locationDiscs.js'

/** The components the corpus sweeps go through: the reach sweep's routes and the playthrough's. */

export const registered = writRegistry.registrations()

export function isTiming<Timing extends WritRegistration['timing']>(timing: Timing) {
    return (row: WritRegistration): row is Extract<WritRegistration, { timing: Timing }> =>
        row.timing === timing
}

export interface AtWillCase {
    readonly name: string
    readonly writId: MandateId
    readonly input: Omit<PlayMandateInput, 'writId'>
    readonly turnedIn: readonly Good[]
    readonly reward: TakenReward
    readonly rewardGuild?: GuildId
    readonly vessel?: VesselType
}

/** R-4.4.2, R-4.4-H4 Every alternative of every at-will mandate, an any-vessel reward per vessel. */
export const AtWill = registered.filter(isTiming('at-will')).flatMap(({ writId, alternatives }) =>
    alternatives.flatMap(({ alternative, turnedIn, reward, rewardGuild }): AtWillCase[] => {
        const name = writKey(writId, { alternative, rewardGuild })
        const input = rewardGuild ? { rewardGuild } : { alternative }
        const guild = rewardGuild ? { rewardGuild } : {}
        return reward.kind === 'any-vessel'
            ? VesselTypes.map((vessel) => ({
                  name: `${name} ${vessel}`,
                  writId,
                  input: { ...input, vessel },
                  turnedIn,
                  reward: { kind: 'vessel', vessel },
                  ...guild,
                  vessel
              }))
            : [{ name, writId, input, turnedIn, reward, ...guild }]
    })
)

/** R-4.4-H1 Every alternative of every weapon. */
export const WeaponBonuses = registered.filter(isTiming('attack')).flatMap(({ writId, bonuses }) =>
    bonuses.map(({ alternative, turnedIn, attack }) => ({
        name: writKey(writId, { alternative }),
        writId,
        alternative,
        turnedIn,
        attack
    }))
)

export const Weapons = registered.filter(isTiming('attack')).map(({ writId }) => writId)
export const AtWillMandates = registered.filter(isTiming('at-will')).map(({ writId }) => writId)

export function setStars(state: HydratedFeudumGameState, seat: string, guild?: GuildId): void {
    if (guild) {
        setPawns(state, seat, [guild, guild, guild])
    }
}

/** R-4.4.3, R-6.2 What a charter met in full pays. */
export const TopScore: Readonly<Record<CharterId, number>> = {
    'writ.charter.sulfur-barrel': 7,
    'writ.charter.eastern-kingdom': 9,
    'writ.charter.monster-defeat': 7,
    'writ.charter.western-kingdom': 9,
    'writ.charter.northern-kingdom': 9,
    'writ.charter.central-kingdom': 9,
    'writ.charter.southern-kingdom': 9,
    'writ.charter.isolated-kingdom': 17
}

export const CharterCases = registered
    .filter(isTiming('end-scoring'))
    .map(({ writId }) => ({ writId, vp: TopScore[writId] }))

/** R-4.4.4 What takes a seat holding one charter over the writ limit. */
/** A card play as `Table.send` takes it. */
export type CardMove = Record<string, unknown> & { type: ActionType }

/** One way to use a card on its owner's turn, whichever route brought the card there. */
export interface CardCase {
    readonly name: string
    /** The rule the row proves. */
    readonly rule: string
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

export const Elsewhere = 'space.forest.2'

export function sumOf(counts: GoodCounts): number {
    return Goods.reduce((sum, good) => sum + counts[good], 0)
}

export function firstFavours(drawn: GoodCounts, favours: number): GoodCounts {
    const chosen = goodCounts()
    let left = favours
    for (const good of Goods) {
        chosen[good] = Math.min(drawn[good], left)
        left -= chosen[good]
    }
    return chosen
}

export function standAs(
    state: HydratedFeudumGameState,
    seat: string,
    n: 1 | 2,
    character: Character
): void {
    state.getPlayerState(seat).pawns[n - 1].character = character
}

export function ruleFirst(
    state: HydratedFeudumGameState,
    seat: string,
    kind: 'outpost' | 'town'
): void {
    placeMarker(state, seat, spaceOfKind(state, kind))
}

export function serfOnOutpost(state: HydratedFeudumGameState, seat: string, rival: string): void {
    const spaceId = spaceOfKind(state, 'outpost')
    placeMarker(state, rival, spaceId)
    placeMarker(state, seat, spaceId)
    giveGood(state, seat, 'wood')
    collectTopTile(state, seat, RegionIds[0])
}

export function keepFirst(table: Table, seat: string, extra: Record<string, unknown> = {}): void {
    const drawn = table.hydrated().flow.writDraw?.drawn ?? []
    table.send(seat, { type: ActionType.KeepWrits, keep: drawn.slice(0, 1), ...extra })
}

export function fightToTheEnd(table: Table, seat: string, rival: string): void {
    table.send(rival, { type: ActionType.AnswerAttack, revealsInfo: true, flipDefend: false })
    table.send(seat, { type: ActionType.CommitAttack, saltpeter: 0, weapons: [] })
}

export function noble(state: HydratedFeudumGameState, seat: string, rival: string): void {
    addPawn(state, seat, 'noble')
    buildFeudum(state, seat)
    placeMarker(state, rival, Battlefield)
    // R-3.14-H1 With no food to cover Royal Immunity the rival isn't asked.
    const { goods } = state.getPlayerState(rival)
    returnGoodToHaversack(state, 'food', goods.food)
    goods.food = 0
}

export function feastReady(state: HydratedFeudumGameState, seat: string, rival: string): void {
    setPawns(state, seat, ['knight'])
    state.supply.haversack.sulfur -= 1
    state.getPlayerState(seat).barrel = 1
    setMaster(state, rival, 'merchant')
    setMarket(state, { iron: 2, wood: 3 })
    setCarts(state, { iron: 1 })
}

/** R-3.5 Every regular action and special ability played on the owner's turn. */
export const CardCases: readonly CardCase[] = [
    {
        name: 'Migrate',
        rule: 'R-3.6.1',
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
        rule: 'R-3.6.2',
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
        rule: 'R-3.7.1',
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
        rule: 'R-3.7.3',
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
        rule: 'R-3.8.1',
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
        rule: 'R-3.8.3',
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
        rule: 'R-3.9.1',
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
            expect(locationKindOf(after.spaces[spaceId].location)).toBe('farm')
            expect(after.getPlayerState(seat).goods.wood).toBe(0)
            expect(after.getPlayerState(seat).regionTiles).toHaveLength(1)
        }
    },
    {
        // R-3.9.3 Instead: the location stays as it was and no tile is taken.
        name: 'Tend Landscape',
        rule: 'R-3.9.3',
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
            expect(locationKindOf(after.spaces[spaceId].location)).toBe('outpost')
            expect(after.spaces[spaceId].ruler?.playerId).toBe(rival)
            expect(player.regionTiles).toHaveLength(0)
            expect(player.goods.wood).toBe(0)
        }
    },
    {
        name: 'Explore',
        rule: 'R-3.10.1',
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
        rule: 'R-3.10.2',
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
        rule: 'R-3.11.1',
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
        rule: 'R-3.11.3',
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
        rule: 'R-3.12.1',
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
        rule: 'R-3.12.2',
        kind: 'tax',
        use: 'special',
        arrange: (state, seat) => {
            ruleFirst(state, seat, 'town')
            standAs(state, seat, 1, 'knight')
        },
        move: () => ({ type: ActionType.Tax, collect: true }),
        fired: (after, before, seat) => {
            const player = after.getPlayerState(seat)
            const held = before.getPlayerState(seat)
            expect(player.shillings).toBe(held.shillings + 2)
            expect(player.influenceSupply).toBe(held.influenceSupply + 1)
        }
    },
    {
        name: 'Conquer',
        rule: 'R-3.13.1',
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
        rule: 'R-3.13.2',
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
        rule: 'R-3.14.1',
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
        rule: 'R-3.16.1',
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
        rule: 'R-3.16.3',
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

export function caseNamed(name: string): CardCase {
    const row = CardCases.find((candidate) => candidate.name === name)
    if (!row) {
        throw new Error(`No card case ${name}`)
    }
    return row
}

/** R-3.15 What Repeat reaches, x2 by `repeat`, every other by `deja-vu`; R-3.15.2 never these. */
export const Replays = CardCases.filter(
    ({ kind }) => cardOf(kind).symbols.replay !== 'crossed-x2'
).map((row): CardCase & { readonly mode: RepeatMode } => ({
    ...row,
    mode: cardOf(row.kind).symbols.replay === 'x2' ? 'repeat' : 'deja-vu'
}))

export const RivalHand: ActionCardKind[] = ['tax', 'harvest', 'explore', 'influence']

/** Cards the seat holds only so the one under test is never its last. */
export function fillersBeside(kind: ActionCardKind): ActionCardKind[] {
    return RivalHand.filter((filler) => filler !== kind).slice(0, 2)
}

export interface CardTable {
    readonly table: Table
    readonly seat: string
    readonly rival: string
}

/** R-3.1, R-3.3 The seat asked holds this hand, a sulfur on its pouch if it will play two. */
export function tableHolding(hand: ActionCardKind[], sequential = false): CardTable {
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

export function arrange(row: CardCase, { table, seat, rival }: CardTable): void {
    setUp(table, (state) => {
        row.arrange(state, seat, rival)
        state.recomputeRanks()
    })
}

export function forfeit(
    table: Table,
    playerId: string,
    kind: ActionCardKind,
    secondCard?: true
): void {
    table.send(playerId, {
        type: ActionType.ForfeitCard,
        kind,
        ...(secondCard ? { secondCard } : {})
    })
}

/** R-3.2 The other seats forfeit until this seat is asked again. */
export function roundTo(table: Table, seat: string): void {
    while (table.asked !== seat) {
        forfeit(table, table.asked, table.seat(table.asked).requireHand()[0])
    }
}

export function expectTurnPassed(table: Table, seat: string): void {
    const turnSeat = cardTurnSeat(table.hydrated())
    expect(turnSeat).not.toBe(seat)
    expect(turnSeat).toBeDefined()
}

/** R-3.2 Plays the card, answers what it asks, keeps no disc; the effect and the totals hold. */
export function play(
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
export function tableToReplay(row: CardCase, sequential = false): CardTable {
    const [filler, second] = fillersBeside(row.kind)
    const held = tableHolding(['repeat', row.kind, filler, second], sequential)
    forfeit(held.table, held.seat, row.kind)
    roundTo(held.table, held.seat)
    arrange(row, held)
    return held
}

export function replayRecord({ kind, use, mode }: (typeof Replays)[number]) {
    return {
        kind: 'repeat',
        use,
        replayedKind: kind,
        ...(mode === 'deja-vu' ? { dejaVu: true } : {})
    }
}
