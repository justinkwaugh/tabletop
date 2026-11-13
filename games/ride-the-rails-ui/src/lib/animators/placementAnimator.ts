import type { GameStateChangeListener } from '@tabletop/frontend-components'
import { isPlaceLocomotive, supplyOf } from '@tabletop/ride-the-rails'
import { STRIP_LOCOMOTIVE } from '$lib/utils/marginLayout.js'
import { railroadSourcePoint, seatMoneyPoint } from './flightPlaces.js'
import { bonusCoins, moneyAfterEach, placementChanges, type PlacementChange } from './flightPlan.js'
import { moneyKey, supplyKey, type Flights, type Flyer } from './flights.svelte.js'
import {
    FLIGHT,
    flyCoin,
    liftAndFly,
    motionMode,
    popFlyers,
    pose,
    showFlyers,
    tickAt,
    type State,
    type Step
} from './motion.js'

export function locomotiveFlyerKey(pieceKey: string): string {
    return `locomotive:${pieceKey}`
}

/**
 * Contract, Animation plan, Placement (Patterns B and D): a locomotive flies from its railroad's
 * strip entry to the hex and settles into its slot, a start landing with a small bounce; the
 * Chicago and $5 coins rise from the hex and fly to the seat's marker, and money ticks as each
 * lands. Without an action, new locomotives pop in and undone ones shrink away. A landed
 * locomotive stays in the flight layer until the new state is shown, so a replayed building turn
 * keeps each placement on the map as the next one flies. On a phone the locomotive lifts from the
 * strip above the board and the coins land on the seat's money (`flightPlaces`).
 */
export function placementAnimator(flights: Flights): GameStateChangeListener<State> {
    return async ({ from, to, action, animationContext }: Step) => {
        if (!from) return
        const mode = motionMode(flights, action)
        if (mode === 'still') return
        const { arriving, leaving } = placementChanges(from, to)
        if (arriving.length + leaving.length === 0) return
        flights.follow(animationContext)

        if (mode === 'cinematic' && isPlaceLocomotive(action) && arriving.length === 1) {
            await flyPlacement(flights, { from, to, animationContext }, arriving[0], {
                playerId: action.playerId,
                bonuses: action.metadata?.bonuses ?? []
            })
            return
        }
        await popFlyers(flights, animationContext, {
            arriving: arriving.map(slotFlyer),
            leaving: leaving.map(slotFlyer),
            hidden: leaving.map((piece) => piece.key)
        })
    }
}

// R-3.2, R-3.2.5, R-4.3
async function flyPlacement(
    flights: Flights,
    {
        from,
        to,
        animationContext
    }: Pick<Step, 'from' | 'to' | 'animationContext'> & { from: State },
    piece: PlacementChange,
    paid: { playerId: string; bonuses: Parameters<typeof bonusCoins>[1] }
) {
    const key = locomotiveFlyerKey(piece.key)
    const start = railroadSourcePoint(from.mapId, piece.railroadId)
    const startScale = STRIP_LOCOMOTIVE.width / piece.slot.width
    const startPose = pose(start.x, start.y, startScale)
    const coins = bonusCoins(piece.hexId, paid.bonuses)
    const shown = await showFlyers(flights, [
        {
            key,
            kind: 'locomotive',
            railroadId: piece.railroadId,
            width: piece.slot.width,
            pose: startPose
        },
        ...coins.map((coin): Flyer => ({
            key: coin.key,
            kind: 'coin',
            amount: coin.amount,
            gold: false,
            pose: pose(coin.from.x, coin.from.y, 1, 0)
        }))
    ])
    if (!shown) return

    tickAt(
        animationContext,
        flights,
        supplyKey(piece.railroadId),
        supplyOf(to, piece.railroadId),
        0
    )
    const { slot } = piece
    const locomotive = liftAndFly(flights, animationContext, key, startPose, {
        x: slot.x,
        y: slot.y,
        scale: 1
    })
    if (piece.isStart) {
        locomotive
            .to({ y: slot.y - 9 }, FLIGHT.bounce, FLIGHT.lands, 'power1.out')
            .to({ y: slot.y }, FLIGHT.settle, FLIGHT.lands + FLIGHT.bounce, 'bounce.out')
    }

    const marker = seatMoneyPoint(from.turnManager.turnOrder, paid.playerId)
    const money = moneyAfterEach(from.getPlayerState(paid.playerId).money, coins)
    coins.forEach((coin, index) => {
        const lands = flyCoin(
            flights,
            animationContext,
            {
                key: coin.key,
                start: coin.from,
                rise: { y: coin.from.y - 24 },
                marker,
                rises: FLIGHT.lands + index * FLIGHT.coinStagger
            },
            FLIGHT
        )
        tickAt(animationContext, flights, moneyKey(paid.playerId), money[index], lands)
    })
    animationContext.afterAnimations(() => flights.remove(coins.map((coin) => coin.key)))
}

function slotFlyer(piece: PlacementChange): Flyer {
    return {
        key: locomotiveFlyerKey(piece.key),
        kind: 'locomotive',
        railroadId: piece.railroadId,
        width: piece.slot.width,
        pose: pose(piece.slot.x, piece.slot.y)
    }
}
