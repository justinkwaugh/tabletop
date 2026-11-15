import { MediaQuery } from 'svelte/reactivity'

// A tap also enters and focuses the button before its click, which must not count as a preview.
export class ChoicePreview<T> {
    previewed: T | undefined = $state()
    readonly noHover = new MediaQuery('hover: none')

    showOnHover(event: PointerEvent, choice: T) {
        if (event.pointerType === 'mouse') {
            this.previewed = choice
        }
    }

    showOnKeyboardFocus(event: FocusEvent, choice: T) {
        if (
            event.currentTarget instanceof HTMLElement &&
            event.currentTarget.matches(':focus-visible')
        ) {
            this.previewed = choice
        }
    }

    shownAmong(choices: readonly T[]): T | undefined {
        return this.previewed !== undefined && choices.includes(this.previewed)
            ? this.previewed
            : undefined
    }
}
