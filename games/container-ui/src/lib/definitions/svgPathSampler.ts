import type { Point } from '@tabletop/common'

type PathCommand = {
    command: string
    values: number[]
}

const PARAMS_PER_COMMAND: Record<string, number> = {
    M: 2,
    m: 2,
    L: 2,
    l: 2,
    H: 1,
    h: 1,
    V: 1,
    v: 1,
    C: 6,
    c: 6,
    Z: 0,
    z: 0
}

export function sampleSvgPathToPolygon(
    path: string,
    {
        cubicSubdivisions = 16,
        scaleX = 1,
        scaleY = 1,
        offsetX = 0,
        offsetY = 0
    }: {
        cubicSubdivisions?: number
        scaleX?: number
        scaleY?: number
        offsetX?: number
        offsetY?: number
    } = {}
): Point[] {
    const commands = tokenizePath(path)
    const points: Point[] = []

    let current: Point = { x: 0, y: 0 }
    let subpathStart: Point = { x: 0, y: 0 }

    for (const { command, values } of commands) {
        switch (command) {
            case 'M':
            case 'm': {
                const next = command === 'M' ? toPoint(values[0]!, values[1]!) : addPoint(current, values)
                current = next
                subpathStart = next
                points.push(transformPoint(next, scaleX, scaleY, offsetX, offsetY))
                break
            }
            case 'L':
            case 'l': {
                current = command === 'L' ? toPoint(values[0]!, values[1]!) : addPoint(current, values)
                points.push(transformPoint(current, scaleX, scaleY, offsetX, offsetY))
                break
            }
            case 'H':
            case 'h': {
                current = {
                    x: command === 'H' ? values[0]! : current.x + values[0]!,
                    y: current.y
                }
                points.push(transformPoint(current, scaleX, scaleY, offsetX, offsetY))
                break
            }
            case 'V':
            case 'v': {
                current = {
                    x: current.x,
                    y: command === 'V' ? values[0]! : current.y + values[0]!
                }
                points.push(transformPoint(current, scaleX, scaleY, offsetX, offsetY))
                break
            }
            case 'C':
            case 'c': {
                const control1 =
                    command === 'C'
                        ? toPoint(values[0]!, values[1]!)
                        : { x: current.x + values[0]!, y: current.y + values[1]! }
                const control2 =
                    command === 'C'
                        ? toPoint(values[2]!, values[3]!)
                        : { x: current.x + values[2]!, y: current.y + values[3]! }
                const end =
                    command === 'C'
                        ? toPoint(values[4]!, values[5]!)
                        : { x: current.x + values[4]!, y: current.y + values[5]! }

                for (let step = 1; step <= cubicSubdivisions; step += 1) {
                    const t = step / cubicSubdivisions
                    points.push(
                        transformPoint(
                            sampleCubicBezier(current, control1, control2, end, t),
                            scaleX,
                            scaleY,
                            offsetX,
                            offsetY
                        )
                    )
                }

                current = end
                break
            }
            case 'Z':
            case 'z': {
                current = subpathStart
                break
            }
            default:
                throw new Error(`Unsupported SVG path command: ${command}`)
        }
    }

    return dedupeAdjacentPoints(points)
}

function tokenizePath(path: string): PathCommand[] {
    const tokens = path.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []
    const commands: PathCommand[] = []

    let index = 0
    while (index < tokens.length) {
        const command = tokens[index]!
        index += 1
        if (!/[A-Za-z]/.test(command)) {
            throw new Error(`Expected SVG path command, received "${command}"`)
        }

        const valuesPerCommand = PARAMS_PER_COMMAND[command]
        if (valuesPerCommand === undefined) {
            throw new Error(`Unsupported SVG path command: ${command}`)
        }

        if (valuesPerCommand === 0) {
            commands.push({ command, values: [] })
            continue
        }

        let repeatedCommand = command
        while (index < tokens.length && !/[A-Za-z]/.test(tokens[index]!)) {
            const values = tokens
                .slice(index, index + valuesPerCommand)
                .map((token) => Number.parseFloat(token))
            if (values.length < valuesPerCommand || values.some((value) => Number.isNaN(value))) {
                throw new Error(`Invalid SVG path parameters for command ${command}`)
            }

            commands.push({
                command:
                    repeatedCommand === 'M' ? 'M'
                    : repeatedCommand === 'm' ? 'm'
                    : repeatedCommand,
                values
            })
            index += valuesPerCommand

            if (repeatedCommand === 'M') {
                repeatedCommand = 'L'
            } else if (repeatedCommand === 'm') {
                repeatedCommand = 'l'
            }
        }
    }

    return commands
}

function toPoint(x: number, y: number): Point {
    return { x, y }
}

function addPoint(base: Point, values: number[]): Point {
    return {
        x: base.x + values[0]!,
        y: base.y + values[1]!
    }
}

function transformPoint(
    point: Point,
    scaleX: number,
    scaleY: number,
    offsetX: number,
    offsetY: number
): Point {
    return {
        x: point.x * scaleX + offsetX,
        y: point.y * scaleY + offsetY
    }
}

function sampleCubicBezier(
    start: Point,
    control1: Point,
    control2: Point,
    end: Point,
    t: number
): Point {
    const inverse = 1 - t
    const x =
        inverse ** 3 * start.x +
        3 * inverse ** 2 * t * control1.x +
        3 * inverse * t ** 2 * control2.x +
        t ** 3 * end.x
    const y =
        inverse ** 3 * start.y +
        3 * inverse ** 2 * t * control1.y +
        3 * inverse * t ** 2 * control2.y +
        t ** 3 * end.y

    return { x, y }
}

function dedupeAdjacentPoints(points: Point[]): Point[] {
    return points.filter((point, index) => {
        const previous = points[index - 1]
        return !previous || previous.x !== point.x || previous.y !== point.y
    })
}
