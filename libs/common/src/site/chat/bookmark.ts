import { Type, type Static } from 'typebox'
import { DateType } from '../../util/typebox/customTypes.js'

export type Bookmark = Static<typeof Bookmark>
export const Bookmark = Type.Object({
    id: Type.String(),
    lastReadTimestamp: DateType()
})
