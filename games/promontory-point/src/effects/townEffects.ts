import { assert } from '@tabletop/common'
import { PROMONTORY, type SpaceId } from '../components/board.js'
import type { RailroadId } from '../components/railroads.js'
import {
    TOWN_TILE_KINDS,
    TownEventKind,
    type DividendEvent,
    type PriceChangeEvent,
    type RepairsEvent,
    type TownEvent,
    type TownTileKindId
} from '../components/townTiles.js'
import type { PromontoryPointProjectedState } from '../model/gameState.js'
import type { Debtor } from '../model/pendingRepairs.js'
import { debtorOrder } from '../rules/debtorOrder.js'
import { movePrice } from '../rules/priceMovement.js'
import { repairsBill } from '../rules/repairs.js'
import type {
    DividendPaid,
    PriceMoved,
    RepairsBillPayment,
    RepairsBilled,
    TownEffectOutcome
} from './townEffectOutcome.js'

export type TownEffectId = TownTileKindId | typeof PROMONTORY.spaceId

export type TownEffectState = Pick<
    PromontoryPointProjectedState,
    'players' | 'priceIndex' | 'turnManager' | 'pendingRepairs'
>

export type TownEffectContext = {
    railroadId: RailroadId
    placingPlayerId: string
}

export type TownEffect = {
    componentId: TownEffectId
    printed: string
    event: TownEvent
    resolve(state: TownEffectState, context: TownEffectContext): TownEffectOutcome
}

// R-4.2: each town tile kind and Promontory, keyed by its component id, its printed value beside it.
export const TOWN_EFFECTS: Record<TownEffectId, TownEffect> = {
    'tile.price.plus-1': registration('tile.price.plus-1', '+1'),
    'tile.price.plus-2': registration('tile.price.plus-2', '+2'),
    'tile.price.plus-3': registration('tile.price.plus-3', '+3'),
    'tile.price.minus-1': registration('tile.price.minus-1', '−1'),
    'tile.price.minus-2': registration('tile.price.minus-2', '−2'),
    'tile.price.minus-3': registration('tile.price.minus-3', '−3'),
    'space.0.0': registration('space.0.0', '+5'),
    'tile.red.dividend': registration('tile.red.dividend', '$2 per share to every holder'),
    'tile.red.hammer': registration('tile.red.hammer', '$2 per share billed to every holder')
}

// R-3.3, R-4.2: the town or Promontory a piece lands on; open country has no effect.
export function townEffectAt(
    state: Pick<PromontoryPointProjectedState, 'towns'>,
    spaceId: SpaceId
): TownEffect | undefined {
    if (spaceId === PROMONTORY.spaceId) {
        return TOWN_EFFECTS[PROMONTORY.spaceId]
    }
    return spaceId in state.towns ? TOWN_EFFECTS[state.towns[spaceId]] : undefined
}

function registration(componentId: TownEffectId, printed: string): TownEffect {
    const event = componentEvent(componentId)
    return { componentId, printed, event, resolve: resolverFor(event) }
}

function componentEvent(componentId: TownEffectId): TownEvent {
    return componentId === PROMONTORY.spaceId
        ? PROMONTORY.event
        : TOWN_TILE_KINDS[componentId].event
}

function resolverFor(event: TownEvent): TownEffect['resolve'] {
    switch (event.kind) {
        case TownEventKind.PriceChange:
            return (state, context) => movePriceOf(event, state, context)
        case TownEventKind.Dividend:
            return (state, context) => payDividend(event, state, context)
        case TownEventKind.Repairs:
            return (state, context) => billRepairs(event, state, context)
    }
}

// R-4.2, R-1.2: the price moves at once, stopping at 25 or the last 0.
function movePriceOf(
    event: PriceChangeEvent,
    state: TownEffectState,
    { railroadId }: TownEffectContext
): PriceMoved {
    const priceIndexBefore = state.priceIndex[railroadId]
    const { priceIndex, capped } = movePrice(priceIndexBefore, event.priceChange)
    state.priceIndex[railroadId] = priceIndex
    return {
        kind: event.kind,
        railroadId,
        priceChange: event.priceChange,
        priceIndexBefore,
        priceIndexAfter: priceIndex,
        capped
    }
}

// R-4.2: every holder is paid, whoever placed the piece.
function payDividend(
    event: DividendEvent,
    state: TownEffectState,
    { railroadId }: TownEffectContext
): DividendPaid {
    const payments = holdersOf(state, railroadId).map((player) => {
        const amount = event.dollarsPerShare * player.shares[railroadId]
        player.money += amount
        return { playerId: player.playerId, amount }
    })
    return { kind: event.kind, railroadId, payments }
}

// R-4.2, R-4.3, R-4.3-H1, R-4.3-H4: every holder billed; those who can pay pay at once, the rest are queued.
function billRepairs(
    event: RepairsEvent,
    state: TownEffectState,
    { railroadId, placingPlayerId }: TownEffectContext
): RepairsBilled {
    assert(state.pendingRepairs === undefined, 'A Repairs is already waiting on its debtors')
    const bills: RepairsBillPayment[] = []
    const debtors: Debtor[] = []
    for (const player of holdersOf(state, railroadId)) {
        const owed = repairsBill(player.shares, railroadId)
        if (player.money >= owed) {
            player.money -= owed
            bills.push({ playerId: player.playerId, owed, paid: owed })
        } else {
            bills.push({ playerId: player.playerId, owed, paid: 0 })
            debtors.push({ playerId: player.playerId, owed })
        }
    }
    const decidingOrder = debtorOrder(state, placingPlayerId, debtors)
    if (decidingOrder.length > 0) {
        state.pendingRepairs = { railroadId, debtors: decidingOrder }
    }
    return { kind: event.kind, railroadId, bills, debtors: decidingOrder }
}

function holdersOf(state: TownEffectState, railroadId: RailroadId) {
    return state.players.filter((player) => player.shares[railroadId] > 0)
}
