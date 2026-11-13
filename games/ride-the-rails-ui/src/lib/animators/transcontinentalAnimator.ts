import { tick } from 'svelte'
import type { GameStateChangeListener } from '@tabletop/frontend-components'
import { isPlaceLocomotive, type HydratedRideTheRailsGameState } from '@tabletop/ride-the-rails'
import { hexCenter } from '$lib/utils/boardGeometry.js'
import { turnOrderMarkerPoint } from '$lib/utils/marginLayout.js'
import { claimedLine, outlineStep } from './flightPlan.js'
import { moneyKey, type Flights, type Flyer } from './flights.svelte.js'
import { FLIGHT, PoseTween, motionMode, pose, tickAt } from './motion.js'

type State = HydratedRideTheRailsGameState
type Step = Parameters<GameStateChangeListener<State>>[0]

export const TRANSCONTINENTAL_LINE_KEY = 'line:transcontinental'
export const TRANSCONTINENTAL_COIN_KEY = 'coin:transcontinental'

/** When the line's outlines begin: once the placement that claimed it has landed and settled. */
export const OUTLINES_BEGIN = FLIGHT.lands + FLIGHT.bounce + FLIGHT.settle
const SETTLE_INTO_LINE = 0.2

/**
 * Contract, Animation plan, Transcontinental (Pattern B): R-4.3.3, after the claiming placement
 * lands the line's hexes outline one after another, within 900 ms, and settle as the thin gold
 * line; then a gold coin flies to the claimant's marker and money ticks. Without an action the
 * line simply appears with the state.
 */
export function transcontinentalAnimator(flights: Flights): GameStateChangeListener<State> {
    return async ({ from, to, action, animationContext }: Step) => {
        if (!from || motionMode(flights, action) !== 'cinematic') return
        const line = claimedLine(from, to)
        const claim = to.transcontinental
        if (!line || !claim) return
        flights.follow(animationContext)

        const outlines = line.map((hexId, index): Flyer => ({
            key: `outline:${index}:${hexId}`,
            kind: 'outline',
            hexId,
            pose: pose(0, 0, 1, 0)
        }))
        const coinFrom = hexCenter(isPlaceLocomotive(action) ? action.hexId : line[line.length - 1])
        const coinPose = pose(coinFrom.x, coinFrom.y, 1, 0)
        flights.show([
            ...outlines,
            { key: TRANSCONTINENTAL_LINE_KEY, kind: 'line', hexIds: line, pose: pose(0, 0, 1, 0) },
            {
                key: TRANSCONTINENTAL_COIN_KEY,
                kind: 'coin',
                amount: claim.amount,
                gold: true,
                pose: coinPose
            }
        ])
        await tick()
        if (flights.interrupted) return

        const step = outlineStep(line.length)
        const drawn = OUTLINES_BEGIN + line.length * step
        outlines.forEach((outline, index) => {
            new PoseTween(flights, animationContext, outline.key, outline.pose)
                .to({ opacity: 1 }, step, OUTLINES_BEGIN + index * step, 'none')
                .to({ opacity: 0 }, SETTLE_INTO_LINE, drawn, 'power1.in')
        })
        new PoseTween(flights, animationContext, TRANSCONTINENTAL_LINE_KEY, pose(0, 0, 1, 0)).to(
            { opacity: 1 },
            SETTLE_INTO_LINE,
            drawn,
            'power1.out'
        )

        const rises = drawn + SETTLE_INTO_LINE
        const lands = rises + FLIGHT.coinRise + FLIGHT.coinFly
        const marker = turnOrderMarkerPoint(from.turnManager.turnOrder, claim.playerId)
        new PoseTween(flights, animationContext, TRANSCONTINENTAL_COIN_KEY, coinPose)
            .to({ opacity: 1, y: coinFrom.y - 24 }, FLIGHT.coinRise, rises, 'power1.out')
            .to(
                { x: marker.x, y: marker.y, scale: 0.7 },
                FLIGHT.coinFly,
                rises + FLIGHT.coinRise,
                'power2.in'
            )
            .to({ opacity: 0 }, FLIGHT.fade, lands)
        const money = to.getPlayerState(claim.playerId).money
        tickAt(animationContext, flights, moneyKey(claim.playerId), money, lands)
        animationContext.afterAnimations(() =>
            flights.remove([...outlines.map((outline) => outline.key), TRANSCONTINENTAL_COIN_KEY])
        )
    }
}
