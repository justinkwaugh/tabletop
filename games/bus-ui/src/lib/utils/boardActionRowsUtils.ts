import type { Point } from '@tabletop/common'
import { WorkerActionType } from '@tabletop/bus'

export const ACTION_SLOT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

export type ActionWorkerPlacement = {
    key: string
    actionType: WorkerActionType
    playerId: string
    point: Point
    selectionIndex?: number
}

export type ActionSpotHighlight = {
    key: string
    actionType: WorkerActionType
    point: Point
    selectionIndex?: number
}

export type ActionValueBadge = {
    key: string
    point: Point
    value?: number
    playerId?: string
    showText?: boolean
    showCenterDot?: boolean
}

export type ActionSlotMarker = {
    key: string
    point: Point
    label: string
}

export function pushSinglePlacement(
    placements: ActionWorkerPlacement[],
    actionType: WorkerActionType,
    playerId: string | undefined,
    point: Point
): void {
    if (!playerId) {
        return
    }

    placements.push({
        key: `${actionType}:${playerId}`,
        actionType,
        playerId,
        point
    })
}

export function pushQueuePlacements(
    placements: ActionWorkerPlacement[],
    actionType: WorkerActionType,
    playerIds: string[],
    points: Point[],
    reversePhysicalRow = false,
    skipSelectionCount = 0
): void {
    const normalizedSkipSelectionCount = Math.max(0, skipSelectionCount)

    if (normalizedSkipSelectionCount >= points.length) {
        return
    }

    const availablePointCount = points.length - normalizedSkipSelectionCount
    const max = Math.min(playerIds.length, availablePointCount)
    for (let selectionIndex = 0; selectionIndex < max; selectionIndex += 1) {
        const playerId = playerIds[selectionIndex]
        const absoluteSelectionIndex = selectionIndex + normalizedSkipSelectionCount
        const point = reversePhysicalRow
            ? points[points.length - 1 - absoluteSelectionIndex]
            : points[absoluteSelectionIndex]

        placements.push({
            key: `${actionType}:${absoluteSelectionIndex}:${playerId}`,
            actionType,
            playerId,
            point,
            selectionIndex: absoluteSelectionIndex
        })
    }
}

export function pushDefaultQueueSlotMarkers(
    markers: ActionSlotMarker[],
    actionType: WorkerActionType,
    points: Point[],
    reversePhysicalRow: boolean,
    occupiedSlots: Set<string>,
    highlightedSlots: Set<string>
): void {
    for (let selectionIndex = 0; selectionIndex < points.length; selectionIndex += 1) {
        const slotKey = `${actionType}:${selectionIndex}`
        if (occupiedSlots.has(slotKey) || highlightedSlots.has(slotKey)) {
            continue
        }

        const pointIndex = reversePhysicalRow ? points.length - 1 - selectionIndex : selectionIndex
        const point = points[pointIndex]
        if (!point) {
            continue
        }

        markers.push({
            key: `${slotKey}:default`,
            point,
            label: ACTION_SLOT_LABELS[selectionIndex] ?? ''
        })
    }
}

export function pushAvailableSingleSpot(
    highlights: ActionSpotHighlight[],
    actionType: WorkerActionType,
    point: Point,
    isAvailable: boolean
): void {
    if (!isAvailable) {
        return
    }

    highlights.push({
        key: `${actionType}:available`,
        actionType,
        point
    })
}

export function pushAvailableQueueSpot(
    highlights: ActionSpotHighlight[],
    actionType: WorkerActionType,
    points: Point[],
    nextSelectionIndex: number,
    reversePhysicalRow = false
): void {
    if (nextSelectionIndex < 0 || nextSelectionIndex >= points.length) {
        return
    }

    const pointIndex = reversePhysicalRow ? points.length - 1 - nextSelectionIndex : nextSelectionIndex
    const point = points[pointIndex]
    if (!point) {
        return
    }

    highlights.push({
        key: `${actionType}:${nextSelectionIndex}:available`,
        actionType,
        point,
        selectionIndex: nextSelectionIndex
    })
}

function clamp255(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)))
}

function parseHexColor(input: string): [number, number, number] | undefined {
    const normalized = input.trim()
    const shortMatch = normalized.match(/^#([0-9a-fA-F]{3})$/)
    if (shortMatch) {
        const [r, g, b] = shortMatch[1].split('').map((channel) => {
            return parseInt(channel + channel, 16)
        })
        return [r, g, b]
    }

    const longMatch = normalized.match(/^#([0-9a-fA-F]{6})$/)
    if (!longMatch) {
        return undefined
    }

    const hex = longMatch[1]
    return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
    ]
}

export function mixHex(a: string, b: string, t: number): string {
    const parsedA = parseHexColor(a)
    const parsedB = parseHexColor(b)
    if (!parsedA || !parsedB) {
        return a
    }

    const blend = (from: number, to: number): number => clamp255(from + (to - from) * t)
    return (
        '#' +
        [
            blend(parsedA[0], parsedB[0]),
            blend(parsedA[1], parsedB[1]),
            blend(parsedA[2], parsedB[2])
        ]
            .map((channel) => channel.toString(16).padStart(2, '0'))
            .join('')
    )
}

export function textColorFromTailwindClass(textColorClass: string): string {
    if (textColorClass.includes('text-black')) {
        return '#111'
    }
    if (textColorClass.includes('text-white')) {
        return '#ffffff'
    }

    const arbitraryMatch = textColorClass.match(/text-\[(#[0-9a-fA-F]{3,8})\]/)
    if (arbitraryMatch) {
        return arbitraryMatch[1]
    }

    return '#ffffff'
}
