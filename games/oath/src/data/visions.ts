import { CardKind } from '../model/oathEnums.js'
import type { CardDefinition } from './cardRegistry.js'
import visions from './visions.data.js'

export interface VisionRecord {
    id: string
    name: string
    cardNumber: number | null
    /** R-9.1 — the italic reminder is non-normative. */
    reminderText: string
    goalText: string
    timing: 'wake' | 'whenPlayed'
    isConspiracy: boolean
    powerText: string
}

/** In R-3.4.3's tie-break order. */
export const VISION_RECORDS: readonly VisionRecord[] = visions

/** R-8.5 */
export const TOTAL_VISION_CARDS = 5

/** R-5.1.4.IV */
export const CONSPIRACY_ID = 'vision.conspiracy'

// R-10.14, R-2.2.1 — a Vision has no suit, and a revealed Vision is not an adviser.
export const VISION_DEFINITIONS: CardDefinition[] = VISION_RECORDS.map((rec) => ({
    id: rec.id,
    name: rec.name,
    kind: CardKind.Vision,
    suit: undefined,
    placement: null,
    locked: false
}))

export const ALL_VISION_IDS: string[] = VISION_DEFINITIONS.map((v) => v.id)

export const GOAL_VISION_IDS: string[] = VISION_RECORDS.filter((v) => !v.isConspiracy).map(
    (v) => v.id
)

export function visionRecord(visionCardId: string): VisionRecord | undefined {
    return VISION_RECORDS.find((v) => v.id === visionCardId)
}
