// Contract, "Open seat": a seat's name opens it over the table; the backdrop, Escape, the close
// button or the name again closes it. It shows the displayed state, History View included.
export class OpenSeat {
    playerId: string | undefined = $state()

    toggle(playerId: string) {
        this.playerId = this.playerId === playerId ? undefined : playerId
    }

    close() {
        this.playerId = undefined
    }
}
