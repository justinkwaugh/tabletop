import type { Point } from '@tabletop/common'
import type { TechDefinition, TechField } from '@tabletop/stellar-horizons-2'

const BAND_GAP = 34
const LEFT = 150
const RIGHT_MARGIN = 40
const TOP = 86
const ROWS_PER_FIELD = 3
const OVERVIEW = { cardWidth: 270, cardHeight: 124, columnPitch: 336, rowPitch: 138 }
const FOCUS = { cardWidth: 290, cardHeight: 236, columnPitch: 420, rowPitch: 256 }

const COLUMNS = 6

export interface TreeBand {
    field: TechField
    y: number
    height: number
}

export interface TreeLayout {
    width: number
    height: number
    cardWidth: number
    cardHeight: number
    bands: TreeBand[]
    columnX(column: number): number
    cardPosition(tech: TechDefinition): Point
    connectorPath(from: TechDefinition, to: TechDefinition): string
}

export function treeLayout(fields: readonly TechField[], focused: boolean): TreeLayout {
    const spacing = focused ? FOCUS : OVERVIEW
    const bandHeight = (ROWS_PER_FIELD - 1) * spacing.rowPitch + spacing.cardHeight
    const bandTop = (field: TechField) => TOP + fields.indexOf(field) * (bandHeight + BAND_GAP)
    const columnX = (column: number) => LEFT + (column - 1) * spacing.columnPitch
    const cardPosition = (tech: TechDefinition): Point => ({
        x: columnX(tech.column),
        y: bandTop(tech.field) + (tech.row - 1) * spacing.rowPitch
    })
    return {
        width: columnX(COLUMNS) + spacing.cardWidth + RIGHT_MARGIN,
        height: TOP + fields.length * (bandHeight + BAND_GAP) + 10,
        cardWidth: spacing.cardWidth,
        cardHeight: spacing.cardHeight,
        bands: fields.map((field) => ({
            field,
            y: bandTop(field) - BAND_GAP / 2 + 4,
            height: bandHeight + BAND_GAP - 8
        })),
        columnX,
        cardPosition,
        connectorPath(from, to) {
            const start = cardPosition(from)
            const end = cardPosition(to)
            const x1 = start.x + spacing.cardWidth
            const y1 = start.y + spacing.cardHeight / 2
            const x2 = end.x
            const y2 = end.y + spacing.cardHeight / 2
            const bend = (x2 - x1) / 2
            return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`
        }
    }
}
