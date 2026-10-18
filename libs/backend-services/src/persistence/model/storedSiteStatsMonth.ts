import { SiteStatsDay, UtcDay } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { DistinctSketch } from '../../stats/hyperLogLog.js'

export const ActiveUserSketches = Type.Object(
    {
        users: DistinctSketch,
        titles: Type.Record(Type.String(), DistinctSketch)
    },
    { additionalProperties: false }
)
export type ActiveUserSketches = Static<typeof ActiveUserSketches>

export const StoredSiteStatsMonth = Type.Object(
    {
        month: Type.String({ pattern: '^\\d{4}-\\d{2}$' }),
        days: Type.Record(UtcDay, SiteStatsDay),
        activeUsers: Type.Record(UtcDay, ActiveUserSketches)
    },
    { additionalProperties: false }
)
export type StoredSiteStatsMonth = Static<typeof StoredSiteStatsMonth>
