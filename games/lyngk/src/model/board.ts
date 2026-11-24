import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { addAxial, AxialCoordinates, Hydratable, sameCoordinates } from '@tabletop/common'
import { DIRECTIONS, isPoint, POINTS } from './geometry.js'
import {
    hasRepeatedColor,
    pieceColor,
    PieceColor,
    Pieces,
    topOf,
    type ColorRights
} from './pieces.js'

// An occupied point and its pieces, bottom to top. Empty points are not stored: the board's
// points are POINTS.
export type BoardStack = Type.Static<typeof BoardStack>
export const BoardStack = Type.Object({
    coords: AxialCoordinates,
    pieces: Pieces
})

export type LyngkBoard = Type.Static<typeof LyngkBoard>
export const LyngkBoard = Type.Object({
    stacks: Type.Array(BoardStack)
})

// A move from `from` to `to`, passing through each LYNGK-point in `via` in order.
export type MovePath = {
    from: AxialCoordinates
    via: AxialCoordinates[]
    to: AxialCoordinates
}

const LyngkBoardValidator = Compile(LyngkBoard)

export function emptyBoard(): LyngkBoard {
    return { stacks: [] }
}

export class HydratedLyngkBoard extends Hydratable<typeof LyngkBoard> implements LyngkBoard {
    declare stacks: BoardStack[]

    constructor(data: LyngkBoard) {
        super(data, LyngkBoardValidator)
    }

    private stackOn(coords: AxialCoordinates): BoardStack | undefined {
        return this.stacks.find((stack) => sameCoordinates(stack.coords, coords))
    }

    // The pieces at a point, by number; none on an empty point.
    piecesAt(coords: AxialCoordinates): number[] {
        return this.stackOn(coords)?.pieces ?? []
    }

    // The pieces at a point, by colour.
    stackAt(coords: AxialCoordinates): PieceColor[] {
        return this.piecesAt(coords).map(pieceColor)
    }

    occupied(): AxialCoordinates[] {
        return this.stacks.map((stack) => stack.coords)
    }

    vacantPoints(): AxialCoordinates[] {
        return POINTS.filter((coords) => this.stackOn(coords) === undefined)
    }

    isFull(): boolean {
        return this.stacks.length === POINTS.length
    }

    onBoard(piece: number): boolean {
        return this.stacks.some((stack) => stack.pieces.includes(piece))
    }

    // Takes the whole stack off a point.
    lift(coords: AxialCoordinates): number[] {
        const stack = this.stackOn(coords)
        if (stack === undefined) throw Error(`No stack at ${coords.q},${coords.r}`)
        this.stacks = this.stacks.filter((other) => other !== stack)
        return stack.pieces
    }

    drop(coords: AxialCoordinates, pieces: readonly number[]) {
        if (!isPoint(coords)) throw Error(`No point at ${coords.q},${coords.r}`)
        const stack = this.stackOn(coords)
        if (stack === undefined) this.stacks.push({ coords: { ...coords }, pieces: [...pieces] })
        else stack.pieces.push(...pieces)
    }

    // The first occupied point in each direction, crossing only empty points; `vacated` counts as empty.
    reachableFrom(coords: AxialCoordinates, vacated: AxialCoordinates): AxialCoordinates[] {
        const reached: AxialCoordinates[] = []
        for (const direction of DIRECTIONS) {
            let current = addAxial(coords, direction)
            while (isPoint(current)) {
                if (!sameCoordinates(current, vacated) && this.stackOn(current) !== undefined) {
                    reached.push(current)
                    break
                }
                current = addAxial(current, direction)
            }
        }
        return reached
    }

    canMoveStack(coords: AxialCoordinates, rights: ColorRights): boolean {
        const top = topOf(this.stackAt(coords))
        return top !== undefined && (rights.owned.includes(top) || rights.neutral.includes(top))
    }

    canLand(
        moving: readonly PieceColor[],
        target: readonly PieceColor[],
        owned: boolean,
        maxHeight: number
    ): boolean {
        const combined = [...target, ...moving]
        return (
            combined.length <= maxHeight &&
            !hasRepeatedColor(combined) &&
            (owned || target.length <= moving.length)
        )
    }

    // The top colour of the stack at `from` when it is one of the mover's own claims, which is
    // what lets it go through LYNGK-points.
    private claimedTop(
        from: AxialCoordinates,
        owned: readonly PieceColor[]
    ): PieceColor | undefined {
        const top = topOf(this.stackAt(from))
        return top !== undefined && owned.includes(top) ? top : undefined
    }

    // Rule F: a LYNGK-point is a stack topped by the moving stack's own claimed colour.
    private isLyngkLink(target: AxialCoordinates, claimedTop: PieceColor | undefined): boolean {
        return claimedTop !== undefined && topOf(this.stackAt(target)) === claimedTop
    }

    // Every legal move of the stack at `from`; LYNGK-points are only followed for a claimed top color.
    pathsFrom(from: AxialCoordinates, rights: ColorRights, maxHeight: number): MovePath[] {
        if (!this.canMoveStack(from, rights)) {
            return []
        }
        const moving = this.stackAt(from)
        const claimedTop = this.claimedTop(from, rights.owned)
        const paths: MovePath[] = []
        const explore = (position: AxialCoordinates, via: AxialCoordinates[]) => {
            for (const target of this.reachableFrom(position, from)) {
                if (this.isLyngkLink(target, claimedTop)) {
                    if (!via.some((link) => sameCoordinates(link, target))) {
                        explore(target, [...via, target])
                    }
                } else if (
                    this.canLand(moving, this.stackAt(target), claimedTop !== undefined, maxHeight)
                ) {
                    paths.push({ from, via, to: target })
                }
            }
        }
        explore(from, [])
        return paths
    }

    // The route through the fewest LYNGK-points: the route never changes a move's outcome.
    shortestPath(
        from: AxialCoordinates,
        to: AxialCoordinates,
        rights: ColorRights,
        maxHeight: number
    ): MovePath | undefined {
        return this.pathsFrom(from, rights, maxHeight)
            .filter((path) => sameCoordinates(path.to, to))
            .toSorted((a, b) => a.via.length - b.via.length)[0]
    }

    // Every LYNGK connection from the stack at `from`, as pairs of points: to each LYNGK-point it
    // can reach, and on from each of those in turn, whether or not a move ends beyond them.
    lyngkConnections(
        from: AxialCoordinates,
        owned: readonly PieceColor[]
    ): [AxialCoordinates, AxialCoordinates][] {
        const claimedTop = this.claimedTop(from, owned)
        if (claimedTop === undefined) return []
        const links: [AxialCoordinates, AxialCoordinates][] = []
        const reached = [from]
        const queue = [from]
        for (let position = queue.shift(); position !== undefined; position = queue.shift()) {
            for (const target of this.reachableFrom(position, from)) {
                if (!this.isLyngkLink(target, claimedTop)) continue
                const known = links.some(
                    ([x, y]) =>
                        (sameCoordinates(x, position) && sameCoordinates(y, target)) ||
                        (sameCoordinates(x, target) && sameCoordinates(y, position))
                )
                if (!known) links.push([position, target])
                if (!reached.some((coords) => sameCoordinates(coords, target))) {
                    reached.push(target)
                    queue.push(target)
                }
            }
        }
        return links
    }

    allPaths(rights: ColorRights, maxHeight: number): MovePath[] {
        return this.occupied().flatMap((coords) => this.pathsFrom(coords, rights, maxHeight))
    }

    hasMove(rights: ColorRights, maxHeight: number): boolean {
        return this.occupied().some(
            (coords) => this.pathsFrom(coords, rights, maxHeight).length > 0
        )
    }

    findPath(path: MovePath, rights: ColorRights, maxHeight: number): MovePath | undefined {
        const sameVia = (a: AxialCoordinates[], b: AxialCoordinates[]) =>
            a.length === b.length && a.every((coords, index) => sameCoordinates(coords, b[index]))
        return this.pathsFrom(path.from, rights, maxHeight).find(
            (candidate) =>
                sameCoordinates(candidate.to, path.to) && sameVia(candidate.via, path.via)
        )
    }

    stacksOfHeight(height: number, colors: readonly PieceColor[]): number {
        return this.stacks.filter((stack) => {
            const top = topOf(stack.pieces.map(pieceColor))
            return stack.pieces.length === height && top !== undefined && colors.includes(top)
        }).length
    }
}
