import type { RailroadId } from './railroads.js'

// R-1.1
export const SHARES_PER_RAILROAD = 11

export type ShareKindId = 'share.cp' | 'share.up' | 'share.kp' | 'share.sp'

export type ShareKind = {
    id: ShareKindId
    railroadId: RailroadId
    count: number
}

export const SHARE_KINDS: Record<ShareKindId, ShareKind> = {
    'share.cp': { id: 'share.cp', railroadId: 'railroad.cp', count: SHARES_PER_RAILROAD },
    'share.up': { id: 'share.up', railroadId: 'railroad.up', count: SHARES_PER_RAILROAD },
    'share.kp': { id: 'share.kp', railroadId: 'railroad.kp', count: SHARES_PER_RAILROAD },
    'share.sp': { id: 'share.sp', railroadId: 'railroad.sp', count: SHARES_PER_RAILROAD }
}
