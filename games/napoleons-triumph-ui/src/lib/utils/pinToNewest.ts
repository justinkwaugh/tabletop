import type { Attachment } from 'svelte/attachments'

const NEAR_THE_END = 8

/** Keeps a scrolling list at its newest end while the reader is there, as lines are added; its one child is the list. */
export function pinToNewest(newestFirst: boolean): Attachment<HTMLElement> {
    return (element) => {
        let atNewest = true
        const showNewest = () => {
            element.scrollTop = newestFirst ? 0 : element.scrollHeight
        }
        const noteWhereTheReaderIs = () => {
            atNewest = newestFirst
                ? element.scrollTop <= NEAR_THE_END
                : element.scrollHeight - element.scrollTop - element.clientHeight <= NEAR_THE_END
        }
        const content = new ResizeObserver(() => {
            if (atNewest) {
                showNewest()
            }
        })
        for (const child of element.children) {
            content.observe(child)
        }
        element.addEventListener('scroll', noteWhereTheReaderIs, { passive: true })
        showNewest()
        return () => {
            content.disconnect()
            element.removeEventListener('scroll', noteWhereTheReaderIs)
        }
    }
}
