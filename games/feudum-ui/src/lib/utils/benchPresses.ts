import type { BoundingBox, RectangleDimensions } from '@tabletop/common'
export interface Span {
    readonly x: number
    readonly width: number
}

/** S68 (contract: Touch targets) A press under `least` grows across, never over a neighbour. */
export function widenedSpans(spans: readonly Span[], whole: number, least: number): Span[] {
    const order = spans.map((_, index) => index).sort((a, b) => spans[a]!.x - spans[b]!.x)
    const lanes = order.map((index) => spans[index]!)
    const count = lanes.length
    const need = lanes.map(({ width }) => Math.max(0, least - width))
    const left = need.map((wanted) => wanted / 2)
    const right = need.map((wanted) => wanted / 2)

    const roomLeft = lanes.map((lane, at) =>
        at === 0 ? lane.x : lane.x - (lanes[at - 1]!.x + lanes[at - 1]!.width)
    )
    const lastRight = whole - (lanes[count - 1]?.x ?? 0) - (lanes[count - 1]?.width ?? 0)

    if (count > 0) {
        left[0] = Math.min(left[0]!, Math.max(0, roomLeft[0]!))
        right[count - 1] = Math.min(right[count - 1]!, Math.max(0, lastRight))
    }
    for (let at = 0; at < count - 1; at++) {
        const gap = Math.max(0, roomLeft[at + 1]!)
        const demand = right[at]! + left[at + 1]!
        if (demand > gap) {
            right[at] = (gap * right[at]!) / demand
            left[at + 1] = (gap * left[at + 1]!) / demand
        }
    }

    const spareLeft = lanes.map((_, at) =>
        at === 0
            ? Math.max(0, roomLeft[0]!) - left[0]!
            : Math.max(0, roomLeft[at]!) - right[at - 1]! - left[at]!
    )
    const spareRight = lanes.map((_, at) =>
        at === count - 1 ? Math.max(0, lastRight) - right[at]! : spareLeft[at + 1]!
    )
    for (let at = 0; at < count; at++) {
        let short = need[at]! - left[at]! - right[at]!
        if (short <= 0) {
            continue
        }
        const fromLeft = Math.min(short, Math.max(0, spareLeft[at]!))
        left[at]! += fromLeft
        spareLeft[at]! -= fromLeft
        if (at > 0) {
            spareRight[at - 1]! -= fromLeft
        }
        short -= fromLeft
        const fromRight = Math.min(short, Math.max(0, spareRight[at]!))
        right[at]! += fromRight
        spareRight[at]! -= fromRight
        if (at < count - 1) {
            spareLeft[at + 1]! -= fromRight
        }
    }

    const widened: Span[] = []
    order.forEach((index, at) => {
        const lane = lanes[at]!
        widened[index] = { x: lane.x - left[at]!, width: lane.width + left[at]! + right[at]! }
    })
    return widened
}

/** S68 Each box grows toward `least` across and down, as `widenedSpans` grows a span. */
export function widenedBoxes(
    boxes: readonly BoundingBox[],
    whole: RectangleDimensions,
    least: number
): BoundingBox[] {
    const across = along(boxes, 'x', 'width', 'y', 'height', whole.width, least)
    const down = along(boxes, 'y', 'height', 'x', 'width', whole.height, least)
    return boxes.map((_, at) => ({
        x: across[at]!.x,
        width: across[at]!.width,
        y: down[at]!.x,
        height: down[at]!.width
    }))
}

function along(
    boxes: readonly BoundingBox[],
    start: 'x' | 'y',
    size: 'width' | 'height',
    otherStart: 'x' | 'y',
    otherSize: 'width' | 'height',
    whole: number,
    least: number
): Span[] {
    const result: Span[] = boxes.map((box) => ({ x: box[start], width: box[size] }))
    const order = boxes
        .map((_, index) => index)
        .sort((a, b) => boxes[a]![otherStart] - boxes[b]![otherStart])
    const groups: number[][] = []
    let reach = -Infinity
    for (const index of order) {
        const box = boxes[index]!
        if (groups.length === 0 || box[otherStart] >= reach) {
            groups.push([])
            reach = -Infinity
        }
        groups.at(-1)!.push(index)
        reach = Math.max(reach, box[otherStart] + box[otherSize])
    }
    for (const group of groups) {
        const spans = widenedSpans(
            group.map((index) => result[index]!),
            whole,
            least
        )
        group.forEach((index, at) => (result[index] = spans[at]!))
    }
    return result
}
