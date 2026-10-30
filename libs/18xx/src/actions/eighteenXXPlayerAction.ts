import { PlayerAction, type GameAction } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { InstructedRunAttachments, type InstructedRunAttachment } from '../routes/instructedRuns.js'

/** Any Action may carry instructed runs, since its System cascade can reach an operating turn. */
export const EighteenXXPlayerAction = Type.Object({
    ...PlayerAction.properties,
    instructedRuns: Type.Optional(InstructedRunAttachments)
})

const AttachmentsValidator = Compile(InstructedRunAttachments)

export function instructedRunsOf(action: GameAction): InstructedRunAttachment[] | undefined {
    const attached: unknown = 'instructedRuns' in action ? action.instructedRuns : undefined
    return AttachmentsValidator.Check(attached) ? attached : undefined
}
