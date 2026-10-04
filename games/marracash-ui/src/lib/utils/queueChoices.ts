import {
    isValidVisitorCount,
    MaxVisitorsBroughtIn,
    MinVisitorsBroughtIn,
    QueueEnd
} from '@tabletop/marracash'

export type RefillChoice = { end: QueueEnd; count: number }

export type QueuePawnChoice =
    { kind: 'choice'; choice: RefillChoice } | { kind: 'ambiguous' } | { kind: 'none' }

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

// The fifth-pawn shortcut is dropped when it would let one pawn name both ends.
export function queuePawnChoices(queueLength: number): QueuePawnChoice[] {
    const indices = Array.from({ length: queueLength }, (_, index) => index)
    const withFifth = indices.map((index) => pawnChoice(index, queueLength, true))
    return withFifth.some((choice) => choice.kind === 'ambiguous')
        ? indices.map((index) => pawnChoice(index, queueLength, false))
        : withFifth
}

export enum RefillNote {
    QueueTooShort = 'queueTooShort',
    ChooseEntrance = 'chooseEntrance'
}

// The warning answers the pawn just clicked, so it wins over the standing prompt.
export function refillNote(
    queueTooShort: boolean,
    entrancesReady: boolean
): RefillNote | undefined {
    if (queueTooShort) return RefillNote.QueueTooShort
    return entrancesReady ? RefillNote.ChooseEntrance : undefined
}
