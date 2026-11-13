import { tick } from 'svelte'
import type { GameStateChangeListener } from '@tabletop/frontend-components'
import {
    isPlaceLocomotive,
    supplyOf,
    type HydratedRideTheRailsGameState
} from '@tabletop/ride-the-rails'
import { STRIP_LOCOMOTIVE } from '$lib/utils/marginLayout.js'
import { railroadSourcePoint, seatMoneyPoint } from './flightPlaces.js'
import { bonusCoins, moneyAfterEach, placementChanges, type PlacementChange } from './flightPlan.js'
import { moneyKey, supplyKey, type Flights, type Flyer } from './flights.svelte.js'
import { FLIGHT, PoseTween, QUICK, motionMode, pose, tickAt } from './motion.js'

type State = HydratedRideTheRailsGameState
type Step = Parameters<GameStateChangeListener<State>>[0]

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
        await popPlacements(flights, animationContext, arriving, leaving)
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
    flights.show([
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
    await tick()
    if (flights.interrupted) return

    tickAt(
        animationContext,
        flights,
        supplyKey(piece.railroadId),
        supplyOf(to, piece.railroadId),
        0
    )
    const { slot } = piece
    const locomotive = new PoseTween(flights, animationContext, key, startPose)
        .to({ y: start.y - 8, scale: startScale * 1.12 }, FLIGHT.lift, 0, 'power1.out')
        .to({ x: slot.x, y: slot.y, scale: 1 }, FLIGHT.fly, FLIGHT.lift)
    if (piece.isStart) {
        locomotive
            .to({ y: slot.y - 9 }, FLIGHT.bounce, FLIGHT.lands, 'power1.out')
            .to({ y: slot.y }, FLIGHT.settle, FLIGHT.lands + FLIGHT.bounce, 'bounce.out')
    }

    const marker = seatMoneyPoint(from.turnManager.turnOrder, paid.playerId)
    const money = moneyAfterEach(from.getPlayerState(paid.playerId).money, coins)
    coins.forEach((coin, index) => {
        const rises = FLIGHT.lands + index * FLIGHT.coinStagger
        const lands = rises + FLIGHT.coinRise + FLIGHT.coinFly
        new PoseTween(flights, animationContext, coin.key, pose(coin.from.x, coin.from.y, 1, 0))
            .to({ opacity: 1, y: coin.from.y - 24 }, FLIGHT.coinRise, rises, 'power1.out')
            .to(
                { x: marker.x, y: marker.y, scale: 0.7 },
                FLIGHT.coinFly,
                rises + FLIGHT.coinRise,
                'power2.in'
            )
            .to({ opacity: 0 }, FLIGHT.fade, lands)
        tickAt(animationContext, flights, moneyKey(paid.playerId), money[index], lands)
    })
    animationContext.afterAnimations(() => flights.remove(coins.map((coin) => coin.key)))
}

async function popPlacements(
    flights: Flights,
    animationContext: Step['animationContext'],
    arriving: readonly PlacementChange[],
    leaving: readonly PlacementChange[]
) {
    const flyer = (piece: PlacementChange, scale: number): Flyer => ({
        key: locomotiveFlyerKey(piece.key),
        kind: 'locomotive',
        railroadId: piece.railroadId,
        width: piece.slot.width,
        pose: pose(piece.slot.x, piece.slot.y, scale)
    })
    flights.hide(leaving.map((piece) => piece.key))
    flights.show([
        ...arriving.map((piece) => flyer(piece, 0)),
        ...leaving.map((piece) => flyer(piece, 1))
    ])
    await tick()
    if (flights.interrupted) return

    for (const piece of arriving) {
        const start = pose(piece.slot.x, piece.slot.y, 0)
        new PoseTween(flights, animationContext, locomotiveFlyerKey(piece.key), start).to(
            { scale: 1 },
            QUICK.pop,
            0,
            'back.out(2)'
        )
    }
    for (const piece of leaving) {
        const start = pose(piece.slot.x, piece.slot.y, 1)
        new PoseTween(flights, animationContext, locomotiveFlyerKey(piece.key), start).to(
            { scale: 0, opacity: 0 },
            QUICK.pop,
            0,
            'power2.in'
        )
    }
}
