import { SantiagoBoard, CanalSegment, Intersection, canalEndpoints } from '../model/board.js'

// Returns the set of intersection keys reachable from the spring through placed canals.
// Intersection key format: "col,row"
export function connectedSpringIntersections(board: SantiagoBoard): Set<string> {
    const connected = new Set<string>()
    connected.add(intersectionKey(board.spring))

    let changed = true
    while (changed) {
        changed = false
        for (const canal of board.canals) {
            const [a, b] = canalEndpoints(canal)
            const ka = intersectionKey(a)
            const kb = intersectionKey(b)
            if (connected.has(ka) && !connected.has(kb)) {
                connected.add(kb)
                changed = true
            } else if (connected.has(kb) && !connected.has(ka)) {
                connected.add(ka)
                changed = true
            }
        }
    }

    return connected
}

// Returns true if the square at (col, row) is adjacent to at least one canal
// whose both endpoints are reachable from the spring.
export function isIrrigated(
    board: SantiagoBoard,
    col: number,
    row: number,
    connected?: Set<string>
): boolean {
    const reachable = connected ?? connectedSpringIntersections(board)
    for (const canal of board.canals) {
        const [a, b] = canalEndpoints(canal)
        if (!reachable.has(intersectionKey(a)) || !reachable.has(intersectionKey(b))) {
            continue
        }
        if (canalTouchesSquare(canal, col, row)) {
            return true
        }
    }
    return false
}

// Returns true if a canal segment is adjacent to the square at (col, row).
//
// H segment at (I, J): runs along y = J*2, spanning board cols I*2 and I*2+1.
//   Touches squares (I*2, J*2-1), (I*2+1, J*2-1) [above] and (I*2, J*2), (I*2+1, J*2) [below].
//
// V segment at (I, J): runs along x = I*2, spanning board rows J*2 and J*2+1.
//   Touches squares (I*2-1, J*2), (I*2-1, J*2+1) [left] and (I*2, J*2), (I*2, J*2+1) [right].
function canalTouchesSquare(seg: CanalSegment, col: number, row: number): boolean {
    if (seg.orientation === 'H') {
        const spansCol = Math.floor(col / 2) === seg.col
        const adjacentToRow = seg.row * 2 === row || seg.row * 2 === row + 1
        return spansCol && adjacentToRow
    } else {
        const spansRow = Math.floor(row / 2) === seg.row
        const adjacentToCol = seg.col * 2 === col || seg.col * 2 === col + 1
        return spansRow && adjacentToCol
    }
}

// Returns true if adding this canal segment would be connected to the spring network.
export function isConnectedToSpring(board: SantiagoBoard, seg: CanalSegment): boolean {
    const reachable = connectedSpringIntersections(board)
    const [a, b] = canalEndpoints(seg)
    return reachable.has(intersectionKey(a)) || reachable.has(intersectionKey(b))
}

// Returns true if a canal segment is already placed on the board.
export function isCanalPlaced(board: SantiagoBoard, seg: CanalSegment): boolean {
    return board.canals.some(
        (c) => c.orientation === seg.orientation && c.col === seg.col && c.row === seg.row
    )
}

function intersectionKey(i: Intersection): string {
    return `${i.col},${i.row}`
}
