import type { GameStateChangeListener } from '@tabletop/frontend-components'
import { isPlaceLocomotive, supplyOf } from '@tabletop/ride-the-rails'
import type { LocomotivePiece } from '$lib/utils/boardPieces.js'
import { TRAVELLING_LOCOMOTIVE_WIDTH, railroadSourcePoint, seatMoneyPoint } from './flightPlaces.js'
import { bonusCoins, moneyAfterEach, placementChanges } from './flightPlan.js'
import { moneyKey, supplyKey, type Flights, type Flyer } from './flights.svelte.js'
import {
    FLIGHT,
    coinFlyer,
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
 * supply pile to the hex and settles into its slot, a start landing with a small bounce; the
 * Chicago and $5 coins rise from the hex and fly to the seat's money, and money ticks as each
 * lands (`flightPlaces`). Without an action, new locomotives pop in and undone ones shrink away. A
 * landed locomotive stays in the flight layer until the new state is shown, so a replayed building
 * turn keeps each placement on the map as the next one flies.
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
                isStart: action.metadata?.isStart ?? false,
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
    piece: LocomotivePiece,
    paid: { playerId: string; isStart: boolean; bonuses: Parameters<typeof bonusCoins>[1] }
) {
    const key = locomotiveFlyerKey(piece.key)
    const start = railroadSourcePoint(flights.table, piece.railroadId)
    const startScale = TRAVELLING_LOCOMOTIVE_WIDTH / piece.slot.width
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
        ...coins.map((coin) => coinFlyer(coin.key, coin.amount, false, coin.from))
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
    // R-4.2: the start the placement recorded.
    if (paid.isStart) {
        locomotive
            .to({ y: slot.y - 9 }, FLIGHT.bounce, FLIGHT.lands, 'power1.out')
            .to({ y: slot.y }, FLIGHT.settle, FLIGHT.lands + FLIGHT.bounce, 'bounce.out')
    }

    const marker = seatMoneyPoint(flights.table, paid.playerId)
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

function slotFlyer(piece: LocomotivePiece): Flyer {
    return {
        key: locomotiveFlyerKey(piece.key),
        kind: 'locomotive',
        railroadId: piece.railroadId,
        width: piece.slot.width,
        pose: pose(piece.slot.x, piece.slot.y)
    }
}
