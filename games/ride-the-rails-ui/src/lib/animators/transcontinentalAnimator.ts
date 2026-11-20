import type { GameStateChangeListener } from '@tabletop/frontend-components'
import { isPlaceLocomotive } from '@tabletop/ride-the-rails'
import { boardGeometry, hexCenter } from '$lib/utils/boardGeometry.js'
import { claimedLine, outlineStep } from './flightPlan.js'
import { transcontinentalPoint } from './flightPlaces.js'
import { moneyKey, type Flights, type Flyer } from './flights.svelte.js'
import {
    FLIGHT,
    PoseTween,
    coinFlyer,
    flyCoin,
    motionMode,
    pose,
    showFlyers,
    tickAt,
    type State,
    type Step
} from './motion.js'

export const TRANSCONTINENTAL_LINE_KEY = 'line:transcontinental'
export const TRANSCONTINENTAL_COIN_KEY = 'coin:transcontinental'

/** When the line's outlines begin: once the placement that claimed it has landed and settled. */
export const OUTLINES_BEGIN = FLIGHT.lands + FLIGHT.bounce + FLIGHT.settle
const SETTLE_INTO_LINE = 0.2

/**
 * Contract, Animation plan, Transcontinental (Pattern B): R-4.3.3, after the claiming placement
 * lands the line's hexes outline one after another, within 900 ms, and settle as the thin gold
 * line; then a gold coin flies to the Transcontinental chip in the turn line and the claimant's
 * money ticks (`flightPlaces`). As the coin lands the line fades with it, unless the viewer has
 * chosen to see the line (`viewerShowsLine`), when the state goes on drawing it. Without an action
 * nothing moves: the line comes with the state only if the viewer shows it.
 */
export function transcontinentalAnimator(
    flights: Flights,
    viewerShowsLine: () => boolean
): GameStateChangeListener<State> {
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
        const shown = await showFlyers(flights, [
            ...outlines,
            { key: TRANSCONTINENTAL_LINE_KEY, kind: 'line', hexIds: line, pose: pose(0, 0, 1, 0) },
            coinFlyer(TRANSCONTINENTAL_COIN_KEY, claim.amount, true, coinFrom)
        ])
        if (!shown) return

        const step = outlineStep(line.length)
        const drawn = OUTLINES_BEGIN + line.length * step
        outlines.forEach((outline, index) => {
            new PoseTween(flights, animationContext, outline.key, outline.pose)
                .to({ opacity: 1 }, step, OUTLINES_BEGIN + index * step, 'none')
                .to({ opacity: 0 }, SETTLE_INTO_LINE, drawn, 'power1.in')
        })
        const settledLine = new PoseTween(
            flights,
            animationContext,
            TRANSCONTINENTAL_LINE_KEY,
            pose(0, 0, 1, 0)
        ).to({ opacity: 1 }, SETTLE_INTO_LINE, drawn, 'power1.out')

        const lands = flyCoin(
            flights,
            animationContext,
            {
                key: TRANSCONTINENTAL_COIN_KEY,
                start: coinFrom,
                rise: { y: coinFrom.y - 24 },
                marker: transcontinentalPoint(boardGeometry(to.mapId), flights.table),
                rises: drawn + SETTLE_INTO_LINE
            },
            FLIGHT
        )
        const money = to.getPlayerState(claim.playerId).money
        tickAt(animationContext, flights, moneyKey(claim.playerId), money, lands)
        const done = [...outlines.map((outline) => outline.key), TRANSCONTINENTAL_COIN_KEY]
        if (!viewerShowsLine()) {
            // Fades with the coin, so the claim takes no longer.
            settledLine.to({ opacity: 0 }, FLIGHT.fade, lands, 'power1.in')
            done.push(TRANSCONTINENTAL_LINE_KEY)
        }
        animationContext.afterAnimations(() => flights.remove(done))
    }
}
