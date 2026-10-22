import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { addAxial, AxialCoordinates, Hydratable, sameCoordinates } from '@tabletop/common'
import { DIRECTIONS, isPoint, pointKey, POINTS } from './geometry.js'
import { hasRepeatedColor, PieceColor, Stack, topOf, type ColorRights } from './pieces.js'

export type Point = Type.Static<typeof Point>
export const Point = Type.Object({
    coords: AxialCoordinates,
    stack: Stack
})

export type LyngkBoard = Type.Static<typeof LyngkBoard>
export const LyngkBoard = Type.Object({
    points: Type.Array(Point)
})

// A move from `from` to `to`, passing through each LYNGK-point in `via` in order.
export type MovePath = {
    from: AxialCoordinates
    via: AxialCoordinates[]
    to: AxialCoordinates
}

const LyngkBoardValidator = Compile(LyngkBoard)

export function emptyBoard(): LyngkBoard {
    return { points: POINTS.map((coords) => ({ coords: { ...coords }, stack: [] })) }
}

export class HydratedLyngkBoard extends Hydratable<typeof LyngkBoard> implements LyngkBoard {
    declare points: Point[]

    constructor(data: LyngkBoard) {
        super(data, LyngkBoardValidator)
    }

    private pointAt(coords: AxialCoordinates): Point {
        const key = pointKey(coords)
        const point = this.points.find((candidate) => pointKey(candidate.coords) === key)
        if (point === undefined) {
            throw Error(`No point at ${coords.q},${coords.r}`)
        }
        return point
    }

    stackAt(coords: AxialCoordinates): PieceColor[] {
        return isPoint(coords) ? this.pointAt(coords).stack : []
    }

    occupied(): Point[] {
        return this.points.filter((point) => point.stack.length > 0)
    }

    lift(coords: AxialCoordinates): PieceColor[] {
        const point = this.pointAt(coords)
        const stack = point.stack
        point.stack = []
        return stack
    }

    drop(coords: AxialCoordinates, stack: readonly PieceColor[]) {
        const point = this.pointAt(coords)
        point.stack = [...point.stack, ...stack]
    }

    // The first occupied point in each direction, crossing only empty points; `vacated` counts as empty.
    reachableFrom(coords: AxialCoordinates, vacated: AxialCoordinates): AxialCoordinates[] {
        const reached: AxialCoordinates[] = []
        for (const direction of DIRECTIONS) {
            let current = addAxial(coords, direction)
            while (isPoint(current)) {
                if (!sameCoordinates(current, vacated) && this.stackAt(current).length > 0) {
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

    // Every legal move of the stack at `from`; LYNGK-points are only followed for a claimed top color.
    pathsFrom(from: AxialCoordinates, rights: ColorRights, maxHeight: number): MovePath[] {
        if (!this.canMoveStack(from, rights)) {
            return []
        }
        const moving = this.stackAt(from)
        const top = topOf(moving)
        const owned = top !== undefined && rights.owned.includes(top)
        const paths: MovePath[] = []
        const explore = (position: AxialCoordinates, via: AxialCoordinates[]) => {
            for (const target of this.reachableFrom(position, from)) {
                const targetStack = this.stackAt(target)
                const isLink = owned && topOf(targetStack) === top
                if (isLink) {
                    if (!via.some((link) => sameCoordinates(link, target))) {
                        explore(target, [...via, target])
                    }
                } else if (this.canLand(moving, targetStack, owned, maxHeight)) {
                    paths.push({ from, via, to: target })
                }
            }
        }
        explore(from, [])
        return paths
    }

    allPaths(rights: ColorRights, maxHeight: number): MovePath[] {
        return this.occupied().flatMap((point) => this.pathsFrom(point.coords, rights, maxHeight))
    }

    hasMove(rights: ColorRights, maxHeight: number): boolean {
        return this.occupied().some(
            (point) => this.pathsFrom(point.coords, rights, maxHeight).length > 0
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
        return this.occupied().filter((point) => {
            const top = topOf(point.stack)
            return point.stack.length === height && top !== undefined && colors.includes(top)
        }).length
    }
}
