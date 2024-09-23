import { Kind, Type, type Static } from '@sinclair/typebox'

export type Bookmark = Static<typeof Bookmark>
export const Bookmark = Type.Object({
    id: Type.String(),
    lastReadTimestamp: Type.Unsafe<Date>({ [Kind]: 'Date', format: 'date-time' })
})
