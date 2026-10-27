export type DraftPacketGateSource = {
    ordinaryHotseatPlay: () => boolean
    seatTurnKey: () => string
    publishing: () => boolean
}

export type OwnDraft = {
    packet?: readonly string[]
    selections?: readonly unknown[]
}

/** What the draft panel shows of this seat's private packet. */
export type DraftPanel = 'cover' | 'cards' | 'waiting'

/**
 * Whether this seat's private draft cards are on screen. Where players pass one device, the
 * cards wait until their player opens them; online, the device is the player's own.
 */
export class DraftPacketGate {
    #openedSeatTurn = $state<string>()
    constructor(private readonly source: DraftPacketGateSource) {}
    get visible(): boolean {
        if (!this.source.ordinaryHotseatPlay()) return true
        return !this.source.publishing() && this.#openedSeatTurn === this.source.seatTurnKey()
    }
    panel(own: OwnDraft | undefined, finalOffer: boolean): DraftPanel | undefined {
        if (this.#hasPrivateCards(own) && !this.visible) return 'cover'
        if (finalOffer) return undefined
        return own?.packet?.length ? 'cards' : 'waiting'
    }
    canHide(own: OwnDraft | undefined): boolean {
        return this.source.ordinaryHotseatPlay() && this.visible && this.#hasPrivateCards(own)
    }
    reveal(): void {
        this.#openedSeatTurn = this.source.seatTurnKey()
    }
    hide(): void {
        this.#openedSeatTurn = undefined
    }
    #hasPrivateCards(own: OwnDraft | undefined): boolean {
        return !!(own?.packet?.length || own?.selections?.length)
    }
}
