import * as Type from 'typebox'

/** What a title records of its own changes in a shared Action, before the title's schema narrows it. */
export const TitleChanges = Type.Record(Type.String(), Type.Unknown())
export type TitleChanges = typeof TitleChanges
/** The slot of a title that records no changes of its own. */
export const NoTitleChanges = Type.Optional(TitleChanges)
export type NoTitleChanges = typeof NoTitleChanges
