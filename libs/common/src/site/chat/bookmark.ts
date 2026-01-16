import * as Type from 'typebox'
import { DateType } from '../../util/typebox.js'

export type Bookmark = Type.Static<typeof Bookmark>
export const Bookmark = Type.Object({
    id: Type.String(),
    lastReadTimestamp: DateType()
})
