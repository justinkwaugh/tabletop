<script lang="ts">
    import { assertExists } from '@tabletop/common'
    let path = $state('')
    let width = $state(0)
    let height = $state(0)

    function outlineHighlights(svg: SVGSVGElement) {
        const sibling = svg.parentElement?.querySelector('table')
        assertExists(sibling, 'Spreadsheet outline sits beside its table')
        const element: HTMLTableElement = sibling
        let frame = 0
        function measure() {
            const bounds = element.getBoundingClientRect()
            width = bounds.width
            height = bounds.height
            const highlightedRows = [
                ...element.querySelectorAll('tr.current-player, tr.operating-company')
            ].map((row) => row.getBoundingClientRect())
            const highlightedColumns = [
                ...element.querySelectorAll('thead .operating-column, thead .current-player-column')
            ].map((cell) => cell.getBoundingClientRect())
            const segments: string[] = []
            const x = (value: number) => Math.max(0.5, Math.min(width - 0.5, value - bounds.left))
            const y = (value: number) => Math.max(0.5, Math.min(height - 0.5, value - bounds.top))
            function horizontal(left: number, right: number, top: number) {
                segments.push(`M${x(left)},${y(top)}H${x(right)}`)
            }
            function vertical(left: number, top: number, bottom: number) {
                segments.push(`M${x(left)},${y(top)}V${y(bottom)}`)
            }
            for (const row of highlightedRows) {
                for (const edge of [row.top, row.bottom]) {
                    let start = row.left
                    for (const column of highlightedColumns) {
                        horizontal(start, column.left, edge)
                        start = column.right
                    }
                    horizontal(start, row.right, edge)
                }
                vertical(row.left, row.top, row.bottom)
                vertical(row.right, row.top, row.bottom)
            }
            for (const column of highlightedColumns) {
                horizontal(column.left, column.right, bounds.top)
                horizontal(column.left, column.right, bounds.bottom)
                for (const edge of [column.left, column.right]) {
                    let start = bounds.top
                    for (const row of highlightedRows) {
                        vertical(edge, start, row.top)
                        start = row.bottom
                    }
                    vertical(edge, start, bounds.bottom)
                }
            }
            path = segments.join(' ')
        }
        function scheduleMeasure() {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(measure)
        }
        const resize = new ResizeObserver(scheduleMeasure)
        function observeCells() {
            resize.disconnect()
            resize.observe(element)
            for (const cell of element.querySelectorAll('th, td')) resize.observe(cell)
            scheduleMeasure()
        }
        const mutation = new MutationObserver(observeCells)
        mutation.observe(element, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class']
        })
        observeCells()
        return {
            destroy() {
                cancelAnimationFrame(frame)
                resize.disconnect()
                mutation.disconnect()
            }
        }
    }
</script>

<svg use:outlineHighlights {width} {height} aria-hidden="true"><path d={path}></path></svg>

<style>
    svg {
        position: absolute;
        inset: 0 auto auto 0;
        z-index: 2;
        pointer-events: none;
        overflow: visible;
    }
    path {
        fill: none;
        stroke: var(--rail-focus, #9e7752);
        stroke-width: 1;
        shape-rendering: crispEdges;
    }
</style>
