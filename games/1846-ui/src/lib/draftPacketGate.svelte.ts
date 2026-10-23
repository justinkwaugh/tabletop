export type DraftPacketView = {
    // True when players pass one device, so a seat's cards wait until its player opens them.
    gated: () => boolean
    // Changes with each action and seat, closing cards opened for an earlier one.
    key: () => string
    publishing: () => boolean
}

/** Whether this seat's private draft cards are on screen. */
export class DraftPacketGate {
    #openedKey = $state<string>()
    constructor(private readonly view: DraftPacketView) {}
    get gated(): boolean {
        return this.view.gated()
    }
    get visible(): boolean {
        if (!this.gated) return true
        return !this.view.publishing() && this.#openedKey === this.view.key()
    }
    reveal(): void {
        this.#openedKey = this.view.key()
    }
    hide(): void {
        this.#openedKey = undefined
    }
}
