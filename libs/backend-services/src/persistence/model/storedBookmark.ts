import { Type, type Static } from '@sinclair/typebox'
import { Bookmark } from '@tabletop/common'

export type StoredBookmark = Static<typeof StoredBookmark>
export const StoredBookmark = Type.Composite([
    Type.Omit(Bookmark, ['lastReadTimestamp']),
    Type.Object({
        lastReadTimestamp: Type.Any()
    })
])
