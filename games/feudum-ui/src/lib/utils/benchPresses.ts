/** A press's extent across a guild area, in the area's own units. */
export interface Span {
    readonly x: number
    readonly width: number
}

/**
 * S68 (contract: Touch targets) A press narrower than `least` grows across toward it, still covering
 * its own span, never past the area's edges (0 to `whole`) and never over a neighbouring press. Each
 * grows evenly to both sides where there is room; where two neighbours want more of the room between
 * them than there is, they share it by what each wants; and a press still short takes what is left on
 * either side. Three spans side by side leave the middle one only what lies between the other two.
 */
export function widenedSpans(spans: readonly Span[], whole: number, least: number): Span[] {
    const order = spans.map((_, index) => index).sort((a, b) => spans[a]!.x - spans[b]!.x)
    const lanes = order.map((index) => spans[index]!)
    const count = lanes.length
    const need = lanes.map(({ width }) => Math.max(0, least - width))
    const left = need.map((wanted) => wanted / 2)
    const right = need.map((wanted) => wanted / 2)

    // The room to each lane's left: the area's edge, or the gap it shares with its neighbour.
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

    // What is left of each side's room once both its presses have taken their share.
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

/** A press's place on a guild area, in the area's own units. */
export interface Box {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
}

/**
 * S68 Each box grows toward `least` across and down, as `widenedSpans` grows a span. Along each
 * axis its neighbours are the boxes that share some of its extent on the other axis: the printed
 * Knight rows, side by side, are neighbours across; the drawn ones, stacked, are neighbours down.
 */
export function widenedBoxes(
    boxes: readonly Box[],
    whole: { readonly width: number; readonly height: number },
    least: number
): Box[] {
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
    boxes: readonly Box[],
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
    // Boxes whose extents on the other axis overlap, one after another, share this axis.
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
