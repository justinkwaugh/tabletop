import { shuffle, type RandomFunction } from '@tabletop/common'
import { MarketColor } from '../definition/marketColor.js'

export const VisitorCounts: Record<MarketColor, number> = {
    [MarketColor.Red]: 12,
    [MarketColor.Blue]: 12,
    [MarketColor.Green]: 12,
    [MarketColor.Purple]: 12,
    [MarketColor.Yellow]: 16
}

export const VisitorsPerEntrance = 3
export const MaxSameColorRunInQueue = 3
const MaxSetupAttempts = 1000

export type VisitorSetup = {
    entranceGroups: MarketColor[][]
    queue: MarketColor[]
}

export function generateVisitorSetup(entranceCount: number, random: RandomFunction): VisitorSetup {
    const visitors = Object.values(MarketColor).flatMap((color) =>
        Array<MarketColor>(VisitorCounts[color]).fill(color)
    )
    for (let attempt = 0; attempt < MaxSetupAttempts; attempt++) {
        shuffle(visitors, random)
        const entranceGroups = Array.from({ length: entranceCount }, (_, index) =>
            visitors.slice(index * VisitorsPerEntrance, (index + 1) * VisitorsPerEntrance)
        )
        const queue = visitors.slice(entranceCount * VisitorsPerEntrance)
        if (
            entranceGroups.every(hasDistinctColors) &&
            longestSameColorRun(queue) <= MaxSameColorRunInQueue
        ) {
            return { entranceGroups, queue }
        }
    }
    throw Error(`No valid visitor setup found in ${MaxSetupAttempts} attempts`)
}

export function hasDistinctColors(group: readonly MarketColor[]): boolean {
    return new Set(group).size === group.length
}

export function longestSameColorRun(queue: readonly MarketColor[]): number {
    let longest = 0
    let current = 0
    for (let index = 0; index < queue.length; index++) {
        current = index > 0 && queue[index] === queue[index - 1] ? current + 1 : 1
        longest = Math.max(longest, current)
    }
    return longest
}

export enum QueueEnd {
    Front = 'front',
    Back = 'back'
}

export const MinVisitorsBroughtIn = 2
export const MaxVisitorsBroughtIn = 4

export function isValidVisitorCount(count: number, queueLength: number): boolean {
    if (!Number.isInteger(count) || count > queueLength) {
        return false
    }
    return queueLength < MinVisitorsBroughtIn
        ? count === queueLength
        : count >= MinVisitorsBroughtIn && count <= MaxVisitorsBroughtIn
}
