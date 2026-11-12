import { tick } from 'svelte'

export interface HistoryPin {
    newestFirst: boolean
    /** Deliberate: while older history is still loading the list grows at its old end, so it is not moved until the history is whole. */
    historyComplete: boolean
}

const NEAR_THE_END = 8

/** Keeps a scrolling history list at its newest end while the reader is there, as lines are added; the element's children are the list. */
export function pinToNewest(element: HTMLElement, pin: HistoryPin) {
    let current = pin
    let atNewest = true
    const showNewest = () => {
        element.scrollTop = current.newestFirst ? 0 : element.scrollHeight
    }
    const noteWhereTheReaderIs = () => {
        atNewest = current.newestFirst
            ? element.scrollTop <= NEAR_THE_END
            : element.scrollHeight - element.scrollTop - element.clientHeight <= NEAR_THE_END
    }
    const goToNewest = (next: HistoryPin) => {
        current = next
        if (!next.historyComplete) {
            return
        }
        atNewest = true
        void tick().then(showNewest)
    }
    const content = new ResizeObserver(() => {
        if (atNewest && current.historyComplete) {
            showNewest()
        }
    })
    for (const child of element.children) {
        content.observe(child)
    }
    element.addEventListener('scroll', noteWhereTheReaderIs, { passive: true })
    goToNewest(pin)
    return {
        update: goToNewest,
        destroy() {
            content.disconnect()
            element.removeEventListener('scroll', noteWhereTheReaderIs)
        }
    }
}
