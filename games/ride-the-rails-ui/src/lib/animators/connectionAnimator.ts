import type { GameStateChangeListener } from '@tabletop/frontend-components'
import { cityById, isPlaceLocomotive } from '@tabletop/ride-the-rails'
import { boardGeometry, hexCenter } from '$lib/utils/boardGeometry.js'
import { connectionBonus } from '$lib/utils/linkBonus.js'
import { claimedConnection, outlineStep } from './flightPlan.js'
import { connectionPoint } from './flightPlaces.js'
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
import { OUTLINES_BEGIN } from './transcontinentalAnimator.js'

export const CONNECTION_COIN_KEY = 'coin:connection'

/** Seconds: the outlines fade as the coin rises. */
const OUTLINES_FADE = 0.2

/**
 * Contract, Animation plan, Transcontinental (Pattern B), for a map's connection bonus (R-8): after
 * the claiming placement lands the link cities outline one after another, within 900 ms, and fade;
 * then a gold coin flies to the bonus's chip in the turn line and the claimant's money ticks
 * (`flightPlaces`). The chip and the link cities' rings change with the state. Without an action
 * nothing moves.
 */
export function connectionAnimator(flights: Flights): GameStateChangeListener<State> {
    return async ({ from, to, action, animationContext }: Step) => {
        if (!from || motionMode(flights, action) !== 'cinematic') return
        const cityIds = claimedConnection(from, to)
        const claim = to.connectionClaim
        const bonus = connectionBonus(to.mapId)
        if (!cityIds || !claim || !bonus) return
        flights.follow(animationContext)

        const hexIds = cityIds.map((cityId) => cityById(cityId).hexId)
        const outlines = hexIds.map((hexId): Flyer => ({
            key: `outline:link:${hexId}`,
            kind: 'outline',
            hexId,
            pose: pose(0, 0, 1, 0)
        }))
        const coinFrom = hexCenter(isPlaceLocomotive(action) ? action.hexId : hexIds[0])
        const shown = await showFlyers(flights, [
            ...outlines,
            coinFlyer(CONNECTION_COIN_KEY, bonus.amount, true, coinFrom)
        ])
        if (!shown) return

        const step = outlineStep(hexIds.length)
        const drawn = OUTLINES_BEGIN + hexIds.length * step
        outlines.forEach((outline, index) => {
            new PoseTween(flights, animationContext, outline.key, outline.pose)
                .to({ opacity: 1 }, step, OUTLINES_BEGIN + index * step, 'none')
                .to({ opacity: 0 }, OUTLINES_FADE, drawn, 'power1.in')
        })

        const lands = flyCoin(
            flights,
            animationContext,
            {
                key: CONNECTION_COIN_KEY,
                start: coinFrom,
                rise: { y: coinFrom.y - 24 },
                marker: connectionPoint(boardGeometry(to.mapId), flights.table),
                rises: drawn + OUTLINES_FADE
            },
            FLIGHT
        )
        const money = to.getPlayerState(claim.playerId).money
        tickAt(animationContext, flights, moneyKey(claim.playerId), money, lands)
        const done = [...outlines.map((outline) => outline.key), CONNECTION_COIN_KEY]
        animationContext.afterAnimations(() => flights.remove(done))
    }
}
