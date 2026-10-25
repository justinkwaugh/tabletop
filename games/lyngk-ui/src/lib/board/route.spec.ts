import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import {
    emptyBoard,
    HydratedLyngkBoard,
    HydratedLyngkGameState,
    PieceColor,
    type MoveStack
} from '@tabletop/lyngk'
import { lyngkConnections, routeVia } from './route.js'

const c = (q: number, r: number) => ({ q, r })

describe('lyngkConnections', () => {
    // Black stacks on E7, E5 and G4 in a line of LYNGK-points, and nothing else to land on.
    function board(claimed: PieceColor[]) {
        const data = emptyBoard()
        const stacks: [AxialCoordinates, PieceColor[]][] = [
            [c(0, -3), [PieceColor.Black]],
            [c(0, -1), [PieceColor.Ivory, PieceColor.Black]],
            [c(2, -1), [PieceColor.Black]]
        ]
        for (const [coords, stack] of stacks) {
            data.points.find((point) => sameCoordinates(point.coords, coords))!.stack = stack
        }
        return { board: new HydratedLyngkBoard(data), claimed }
    }

    it('links each stack of the claimed color in reach, even where no move ends', () => {
        const { board: b, claimed } = board([PieceColor.Black])
        expect(lyngkConnections(b, c(0, -3), claimed)).toEqual([
            [c(0, -3), c(0, -1)],
            [c(0, -1), c(2, -1)]
        ])
    })

    it('makes no links for a color nobody claimed', () => {
        const { board: b } = board([])
        expect(lyngkConnections(b, c(0, -3), [])).toEqual([])
    })
})

describe('routeVia', () => {
    // Rule F, diagram 5, with black claimed: E7 reaches G2 only through E5 and G4.
    const file = join(dirname(fileURLToPath(import.meta.url)), '../../scenarios/lyngk-chain.json')
    const data = JSON.parse(readFileSync(file, 'utf8')).state
    data.players[0].claimed = [PieceColor.Black]
    const state = new HydratedLyngkGameState(data)
    const move = { from: c(0, -3), to: c(2, 1) }

    it('takes the shortest route when the move is not known', () => {
        expect(routeVia(state, move)).toEqual([c(0, -1), c(2, -1)])
    })

    it('follows the move the session knows, if it is the one read from the boards', () => {
        const known = { ...move, via: [c(2, -1)] } as MoveStack
        expect(routeVia(state, move, known)).toEqual([c(2, -1)])
        expect(routeVia(state, move, { ...known, to: c(1, 1) })).toEqual([c(0, -1), c(2, -1)])
    })
})
