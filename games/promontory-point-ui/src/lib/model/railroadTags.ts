import type { RailroadId } from '@tabletop/promontory-point'

// The short tag a railroad goes by in the panel, chips and history (CP, UP, KP, SP).
export const RAILROAD_TAGS: Record<RailroadId, string> = {
    'railroad.cp': 'CP',
    'railroad.up': 'UP',
    'railroad.kp': 'KP',
    'railroad.sp': 'SP'
}
