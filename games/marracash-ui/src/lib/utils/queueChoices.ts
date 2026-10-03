import {
    isValidVisitorCount,
    MaxVisitorsBroughtIn,
    MinVisitorsBroughtIn,
    QueueEnd
} from '@tabletop/marracash'

export type RefillChoice = { end: QueueEnd; count: number }

export type QueuePawnChoice =
    | { kind: 'choice'; choice: RefillChoice }
    | { kind: 'ambiguous' }
    | { kind: 'none' }

const FifthPawn = MaxVisitorsBroughtIn + 1

function countForPosition(
    position: number,
    queueLength: number,
    reachesFifth: boolean
): number | undefined {
    const reach = reachesFifth ? FifthPawn : MaxVisitorsBroughtIn
    if (position > reach) {
        return undefined
    }
    const count =
        queueLength < MinVisitorsBroughtIn
            ? queueLength
            : Math.min(Math.max(position, MinVisitorsBroughtIn), MaxVisitorsBroughtIn)
    return isValidVisitorCount(count, queueLength) ? count : undefined
}

function pawnChoice(index: number, queueLength: number, reachesFifth: boolean): QueuePawnChoice {
    const front = countForPosition(index + 1, queueLength, reachesFifth)
    const back = countForPosition(queueLength - index, queueLength, reachesFifth)
    const wholeQueueEitherWay = front === queueLength && back === queueLength
    if (front !== undefined && (back === undefined || wholeQueueEitherWay)) {
        return { kind: 'choice', choice: { end: QueueEnd.Front, count: front } }
    }
    if (back !== undefined && front === undefined) {
        return { kind: 'choice', choice: { end: QueueEnd.Back, count: back } }
    }
    return front === undefined ? { kind: 'none' } : { kind: 'ambiguous' }
}

// A pawn picks the end it's near and a count: the first two pawns bring in 2, the
// third 3, the fourth and fifth 4. When a short queue lets one pawn be read from
// both ends, the fifth-pawn shortcut goes first; pawns still read both ways
// are left for the panel's buttons.
export function queuePawnChoices(queueLength: number): QueuePawnChoice[] {
    const indices = Array.from({ length: queueLength }, (_, index) => index)
    const withFifth = indices.map((index) => pawnChoice(index, queueLength, true))
    return withFifth.some((choice) => choice.kind === 'ambiguous')
        ? indices.map((index) => pawnChoice(index, queueLength, false))
        : withFifth
}
