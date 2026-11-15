import type { Attachment } from 'svelte/attachments'
import type { TalonPlace } from '$lib/utils/talonView.js'

export type Center = { x: number; y: number; width: number }

export function centerOf(element: Element): Center {
    const rect = element.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width }
}

// The board is scaled to fit, so screen distances are divided by the element's on-screen scale.
export function scaleOf(element: HTMLElement): number {
    return element.offsetWidth > 0 ? element.getBoundingClientRect().width / element.offsetWidth : 1
}

// Keeps `elements[key]` pointing at the mounted node while it is mounted.
export function register(elements: Map<string, HTMLElement>, key: string): Attachment<HTMLElement> {
    return (node) => {
        elements.set(key, node)
        return () => {
            if (elements.get(key) === node) {
                elements.delete(key)
            }
        }
    }
}

const Board = 'board'
const MyHand = 'myHand'
const TalonStack = 'talonStack'
const Talon = 'talon'

// Where cards are on the table, for the animators to fly them from and to. Each element registers
// itself while it is mounted.
export class CardPlaces {
    // Face-up cards a player holds: my hand's slots and the cards of an open (ouvert) hand.
    private held = new Map<string, HTMLElement>()
    private seats = new Map<string, HTMLElement>()
    private trickPiles = new Map<string, HTMLElement>()
    private talonCards = new Map<string, HTMLElement>()
    private singles = new Map<string, HTMLElement>()

    heldCard(cardId: string): Attachment<HTMLElement> {
        return register(this.held, cardId)
    }

    seat(playerId: string): Attachment<HTMLElement> {
        return register(this.seats, playerId)
    }

    // Where a seat counts the tricks it has won, which won tricks go to.
    trickPile(playerId: string): Attachment<HTMLElement> {
        return register(this.trickPiles, playerId)
    }

    talonCard(cardId: string): Attachment<HTMLElement> {
        return register(this.talonCards, cardId)
    }

    board(): Attachment<HTMLElement> {
        return register(this.singles, Board)
    }

    myHand(): Attachment<HTMLElement> {
        return register(this.singles, MyHand)
    }

    // Where the talon is drawn in each of its places, present even while it is elsewhere.
    talonSlot(place: TalonPlace): Attachment<HTMLElement> {
        return register(this.singles, `${Talon}:${place}`)
    }

    talonStack(): Attachment<HTMLElement> {
        return register(this.singles, TalonStack)
    }

    heldElement(cardId: string): HTMLElement | undefined {
        return this.held.get(cardId)
    }

    seatOf(playerId: string): HTMLElement | undefined {
        return this.seats.get(playerId)
    }

    trickPileOf(playerId: string): HTMLElement | undefined {
        return this.trickPiles.get(playerId)
    }

    // The last of the card backs a seat shows, the one a card leaves from or lands on.
    lastBackOf(playerId: string): HTMLElement | undefined {
        return this.backsOf(playerId).at(-1)
    }

    backsOf(playerId: string): HTMLElement[] {
        const seat = this.seats.get(playerId)
        return seat ? [...seat.querySelectorAll<HTMLElement>('.backs > .back')] : []
    }

    talonCardOf(cardId: string): HTMLElement | undefined {
        return this.talonCards.get(cardId)
    }

    boardElement(): HTMLElement | undefined {
        return this.singles.get(Board)
    }

    myHandElement(): HTMLElement | undefined {
        return this.singles.get(MyHand)
    }

    talonSlotElement(place: TalonPlace): HTMLElement | undefined {
        return this.singles.get(`${Talon}:${place}`)
    }

    talonStackElement(): HTMLElement | undefined {
        return this.singles.get(TalonStack)
    }
}
