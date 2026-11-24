const CardControls = 'button, a, input, select'

/** A click on a card's own controls is theirs, not the card's shortcut. */
export function pressesCardItself(event: MouseEvent): boolean {
    return !(event.target instanceof Element && event.target.closest(CardControls))
}

export function controlMiddleY(control: Element): number {
    const bounds = control.getBoundingClientRect()
    return bounds.y + bounds.height / 2
}
