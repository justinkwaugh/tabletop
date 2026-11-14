import { prefersReducedMotion } from 'svelte/motion'
import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import { isDealHand, type HydratedKoenigrufenGameState } from '@tabletop/koenigrufen'
import type { CardPlaces } from './cardPlaces.js'
import type { CardFlights, Flight } from './flights.js'
import { TalonPlace } from '$lib/utils/talonView.js'

const DEAL = { flight: 0.38, spacing: 0.13 }
// Each packet is drawn as a few fanned backs.
const PacketBacks = 3

// Pagat: starting with the next player in turn order after the dealer, a packet of six to each player, six face down to the
// talon, then a second packet of six to each player.
export function dealOrder(turnOrder: readonly string[], dealerId: string): (string | 'talon')[] {
    const dealer = turnOrder.indexOf(dealerId)
    const players = turnOrder.map((_, index) => turnOrder[(dealer + 1 + index) % turnOrder.length]!)
    return [...players, 'talon', ...players]
}

// The new hand's cards leave the dealer in packets, after the last hand's trick has gone. Only a
// played deal moves; history shows the new hand at once.
export class DealAnimator {
    constructor(
        private places: CardPlaces,
        private flights: CardFlights
    ) {}

    async onGameStateChange({
        from,
        to,
        action,
        animationContext
    }: {
        from?: HydratedKoenigrufenGameState
        to: HydratedKoenigrufenGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        if (!from || !isDealHand(action) || prefersReducedMotion.current) {
            return
        }
        const dealer = this.places.seatOf(to.dealerId)
        // The new talon is dealt face down to the middle of the table.
        const talon = this.places.talonSlotElement(TalonPlace.Middle)
        if (!dealer || !talon) {
            return
        }
        const flights: Flight[] = []
        dealOrder(to.turnManager.turnOrder, to.dealerId).forEach((recipient, index) => {
            const landing =
                recipient === 'talon' ? { element: talon } : this.flights.landingFor(recipient)
            if (!landing) {
                return
            }
            flights.push({
                key: `${action.id}-${index}`,
                count: PacketBacks,
                from: { element: dealer },
                to: landing,
                at: index * DEAL.spacing,
                duration: DEAL.flight
            })
        })
        // After anything the last hand still had to show, such as its last trick leaving.
        await this.flights.launch(flights, animationContext.finalTimeline, animationContext)
    }
}
