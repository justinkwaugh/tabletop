import { assertExists } from '@tabletop/common'
import type {
    ActionCardKind,
    GuildFunctionName,
    GuildId,
    HydratedFeudumGameState,
    ScrollSpaceId,
    SpaceId
} from '@tabletop/feudum'
import {
    ruleFarm,
    seatRowIndex,
    setBarn,
    setBeads,
    setCarts,
    setJourneyman,
    setMarket,
    setMaster,
    setPawns,
    setRowMarkers,
    setScrolls,
    setShillings,
    setVesselsForSale,
    type GuildArrange,
    type GoodAmounts
} from './guildTable.js'
import { giveTile, returnGoods, ruleTown } from './turnTable.js'

export const AllCarts: GoodAmounts = { wood: 3, iron: 3, food: 3, sulfur: 3, saltpeter: 3 }
const FullMarket: GoodAmounts = { saltpeter: 3, sulfur: 3, iron: 1, wood: 3, food: 3 }
export const R1C1: ScrollSpaceId = 'guild.noble.scroll.r1c1'
export const R1C2: ScrollSpaceId = 'guild.noble.scroll.r1c2'
export const R1C3: ScrollSpaceId = 'guild.noble.scroll.r1c3'
export const FeastSpace: SpaceId = 'space.desert.1'

export interface BenchScene {
    readonly arrange: GuildArrange
    readonly guild?: GuildId
    readonly fn?: GuildFunctionName
    readonly cards?: readonly ActionCardKind[]
}

function feastTable(state: HydratedFeudumGameState, seat: string, other: string, third: string) {
    setPawns(state, seat, ['knight', 'knight'])
    setMaster(state, other, 'merchant')
    setMaster(state, third, 'noble')
    setMarket(state, { wood: 2 })
    const [, second] = state.getPlayerState(seat).pawns
    const [, otherSecond] = state.getPlayerState(other).pawns
    assertExists(second, 'The seat has a second pawn')
    assertExists(otherSecond, 'The opponent has a second pawn')
    second.spaceId = FeastSpace
    otherSecond.spaceId = FeastSpace
}

export const BenchScenes = {
    guildPick: {
        arrange: (state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 2, wood: 1 })
            setMarket(state, FullMarket)
            setCarts(state, AllCarts)
            setVesselsForSale(state, ['ship'])
            setShillings(state, seat, 9)
            state.getPlayerState(seat).guildsUsed = ['noble']
        }
    },
    merchantPull: {
        guild: 'merchant',
        fn: 'pull',
        arrange: (state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 2, wood: 1 })
            setMarket(state, FullMarket)
        }
    },
    belowThreshold: {
        guild: 'merchant',
        fn: 'pull',
        arrange: (state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 1 })
        }
    },
    farmerPush: {
        guild: 'farmer',
        fn: 'push',
        arrange: (state, { seat }) => {
            setMaster(state, seat, 'farmer')
            setBarn(state, { iron: 2, wood: 1 })
            setMarket(state, FullMarket)
        }
    },
    merchantTrade: {
        guild: 'merchant',
        fn: 'trade',
        arrange: (state, { seat }) => {
            setMarket(state, FullMarket)
            setShillings(state, seat, 5)
        }
    },
    merchantPush: {
        guild: 'merchant',
        fn: 'push',
        arrange: (state, { seat, other }) => {
            setMaster(state, seat, 'merchant')
            setPawns(state, other, ['merchant'])
            state.guilds.tracks.merchant.master = { playerId: seat, reeve: true }
            setMarket(state, FullMarket)
        }
    },
    alchemistPush: {
        guild: 'alchemist',
        fn: 'push',
        arrange: (state, { seat }) => {
            setMaster(state, seat, 'alchemist')
            setCarts(state, AllCarts)
        }
    },
    alchemistTrade: {
        guild: 'alchemist',
        fn: 'trade',
        arrange: (state, { seat }) => {
            setVesselsForSale(state, ['ship', 'submersible'])
            setShillings(state, seat, 9)
        }
    },
    knightTrade: {
        guild: 'knight',
        fn: 'trade',
        arrange: (state, { seat }) => {
            const markers = [0, 0, 0, 0]
            markers[seatRowIndex(state, seat)] = 4
            setRowMarkers(state, markers)
            setShillings(state, seat, 9)
            setMarket(state, { iron: 4 })
            ruleTown(state, seat)
            ruleTown(state, seat)
        }
    },
    farmerTrade: {
        guild: 'farmer',
        fn: 'trade',
        arrange: (state, { seat }) => {
            ruleFarm(state, seat, { food: 4 })
            ruleFarm(state, seat, { wood: 4 })
        }
    },
    knightPush: {
        guild: 'knight',
        fn: 'push',
        arrange: (state, { seat }) => {
            setMaster(state, seat, 'knight')
            setRowMarkers(state, [1, 1, 1])
            setScrolls(state, [R1C3])
        }
    },
    noblePull: {
        guild: 'noble',
        fn: 'pull',
        arrange: (state, { seat, other }) => {
            setJourneyman(state, seat, 'noble', other)
            setRowMarkers(state, [1, 1, 1])
            setScrolls(state, [R1C3])
        }
    },
    nobleTrade: {
        guild: 'noble',
        fn: 'trade',
        arrange: (state, { seat }) => {
            setScrolls(state, [R1C1, R1C2, R1C3])
            setShillings(state, seat, 9)
        }
    },
    noblePush: {
        guild: 'noble',
        fn: 'push',
        arrange: (state, { seat }) => {
            setMaster(state, seat, 'noble')
            setScrolls(state, [R1C1, R1C2, R1C3])
        }
    },
    monkTrade: {
        guild: 'monk',
        fn: 'trade',
        arrange: (state, { seat }) => {
            setBeads(state, { rosary: [5, 2], chickens: [] })
            setShillings(state, seat, 9)
        }
    },
    feast: {
        arrange: (state, { seat, other, third }) => {
            feastTable(state, seat, other, third)
            state.supply.haversack.sulfur -= 1
            state.getPlayerState(seat).barrel = 1
        }
    },
    feastShort: {
        arrange: (state, { seat, other }) => {
            setPawns(state, seat, ['knight'])
            setMaster(state, other, 'merchant')
            setMarket(state, { wood: 2 })
            state.getPlayerState(seat).barrel = 0
            giveTile(state, seat)
        }
    },
    feastShortTrade: {
        guild: 'knight',
        fn: 'trade',
        arrange: (state, { seat, other }) => {
            setPawns(state, seat, ['knight'])
            setMaster(state, other, 'merchant')
            setMarket(state, { wood: 2 })
            state.getPlayerState(seat).barrel = 0
            giveTile(state, seat)
            const markers = [0, 0, 0, 0]
            markers[seatRowIndex(state, seat)] = 2
            setRowMarkers(state, markers)
            setShillings(state, seat, 9)
        }
    },
    /** R-3.15 Repeat after Guild, Move and Influence: Repeat replays the Guild into a Knight trade. */
    repeatKnightTrade: {
        guild: 'knight',
        fn: 'trade',
        cards: ['repeat', 'tax'],
        arrange: (state, { seat }) => {
            const markers = [0, 0, 0, 0]
            markers[seatRowIndex(state, seat)] = 4
            setRowMarkers(state, markers)
            setShillings(state, seat, 9)
            state.getPlayerState(seat).played = (['guild', 'move', 'influence'] as const).map(
                (kind) => ({ kind, use: 'regular' as const })
            )
        }
    },
    cardTray: {
        cards: ['tax', 'influence', 'move', 'explore'],
        arrange: () => {}
    },
    migrateShort: {
        cards: ['migrate', 'tax'],
        arrange: (state, { seat }) => {
            returnGoods(state, seat)
            giveTile(state, seat)
        }
    },
    migrateNoTile: {
        cards: ['migrate', 'tax'],
        arrange: (state, { seat }) => {
            returnGoods(state, seat)
        }
    },
    migrateNoPawn: {
        cards: ['migrate', 'tax'],
        arrange: (state, { seat }) => {
            returnGoods(state, seat)
            setPawns(state, seat, [])
        }
    },
    shortOfShillings: {
        arrange: (state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 1 })
            setMarket(state, { iron: 3 })
            setShillings(state, seat, 0)
            giveTile(state, seat)
        }
    }
} as const satisfies Record<string, BenchScene>

export type BenchSceneName = keyof typeof BenchScenes
