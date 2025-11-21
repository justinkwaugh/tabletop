import { Type, type Static } from 'typebox'
import { Bookmark } from '@tabletop/common'

export type StoredBookmark = Static<typeof StoredBookmark>
export const StoredBookmark = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Bookmark, ['lastReadTimestamp']),
        Type.Object({
            lastReadTimestamp: Type.Any()
        })
    ])
)
