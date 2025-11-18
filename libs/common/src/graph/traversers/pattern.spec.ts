import { describe, expect, it } from 'vitest'
import { OrthogonalGrid } from '../orthogonalGrid.js'
import { coordinatesToNumber } from '../coordinates.js'
import { line } from '../patterns/line.js'
import { patternTraverser } from './pattern.js'

describe('Pattern Traverser Tests', () => {
    it('Traverses a line pattern', () => {
        const graph = new OrthogonalGrid()
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                graph.addNode({
                    id: coordinatesToNumber({ row: i, col: j }),
                    coords: { row: i, col: j }
                })
            }
        }

        const linePattern = line({ start: { row: 0, col: 0 }, end: { row: 3, col: 3 } })
        const lineTraverser = patternTraverser(linePattern)
        const nodes = graph.traverse(lineTraverser)
    })
})
