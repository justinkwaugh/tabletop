import type { RailroadId } from './railroads.js'

// R-1.1
export const TRACK_PIECES_PER_RAILROAD = 24

export type TrackPieceKindId = 'marker.cp' | 'marker.up' | 'marker.kp' | 'marker.sp'

export type TrackPieceKind = {
    id: TrackPieceKindId
    railroadId: RailroadId
    count: number
}

export const TRACK_PIECE_KINDS: Record<TrackPieceKindId, TrackPieceKind> = {
    'marker.cp': { id: 'marker.cp', railroadId: 'railroad.cp', count: TRACK_PIECES_PER_RAILROAD },
    'marker.up': { id: 'marker.up', railroadId: 'railroad.up', count: TRACK_PIECES_PER_RAILROAD },
    'marker.kp': { id: 'marker.kp', railroadId: 'railroad.kp', count: TRACK_PIECES_PER_RAILROAD },
    'marker.sp': { id: 'marker.sp', railroadId: 'railroad.sp', count: TRACK_PIECES_PER_RAILROAD }
}
