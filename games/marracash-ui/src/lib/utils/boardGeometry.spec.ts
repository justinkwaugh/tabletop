import { describe, expect, test } from 'vitest'
import { EntranceFountainIds, startingQueueLength } from '@tabletop/marracash'
import { queueLayout, QueuePawnSize } from './boardGeometry.js'
import { PawnHeight, PawnUnitSize, PawnWidth } from './pawnShape.js'

describe('queueLayout', () => {
    test('leaves the same gap between pawns along rows and down the side', () => {
        const scale = QueuePawnSize / PawnUnitSize
        const { visitors } = queueLayout(startingQueueLength(EntranceFountainIds.length))
        const gaps = visitors.slice(1).flatMap((visitor, index) => {
            const previous = visitors[index]
            if (visitor.x === previous.x)
                return [Math.abs(visitor.y - previous.y) - PawnHeight * scale]
            if (visitor.y === previous.y)
                return [Math.abs(visitor.x - previous.x) - PawnWidth * scale]
            return []
        })
        expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.01)
    })
})
