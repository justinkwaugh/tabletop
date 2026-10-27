/**
 * Stacks a label's words in a wrapping flex row only when that keeps the row on one line: the
 * row's items, its gaps and padding are measured with the label on one line and stacked, from
 * the widths of its words.
 */
export class LabelStacking {
    stacked = $state(false)

    attach = (row: HTMLElement) => {
        const label = row.querySelector<HTMLElement>('[data-stacking-label]')
        if (!label) return
        const words = [...label.children]
        const items = [...row.children]
        const measure = () => {
            const rowStyle = getComputedStyle(row)
            const available =
                row.clientWidth -
                parseFloat(rowStyle.paddingLeft) -
                parseFloat(rowStyle.paddingRight)
            const required =
                items.reduce((total, item) => total + item.getBoundingClientRect().width, 0) +
                (parseFloat(rowStyle.columnGap) || 0) * (items.length - 1)
            const wordWidths = words.map((word) => word.getBoundingClientRect().width)
            const oneLine =
                wordWidths.reduce((total, width) => total + width, 0) +
                (parseFloat(getComputedStyle(label).columnGap) || 0) * (words.length - 1)
            const withLabel = (width: number) =>
                required - label.getBoundingClientRect().width + width
            // Half a pixel absorbs rounding in the measured widths.
            this.stacked =
                withLabel(oneLine) > available + 0.5 &&
                withLabel(Math.max(...wordWidths)) <= available + 0.5
        }
        const observer = new ResizeObserver(measure)
        observer.observe(row)
        for (const item of items) observer.observe(item)
        measure()
        return () => observer.disconnect()
    }
}
