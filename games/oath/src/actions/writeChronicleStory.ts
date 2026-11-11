import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CHRONICLE_STORY_LIMIT } from '../model/chronicle.js'
import {
    chronicleOf,
    normalizedStory,
    reasonCannotWriteChronicleStory
} from '../util/chronicleChoices.js'

export type WriteChronicleStoryMetadata = Type.Static<typeof WriteChronicleStoryMetadata>
export const WriteChronicleStoryMetadata = Type.Object({
    /** The game whose story it is: the record's entry it was written into. */
    gameNumber: Type.Number()
})

/**
 * The winner's story of the game: plain text, stored once in the record and never edited. The
 * handler takes at most `CHRONICLE_STORY_LIMIT` code points as sent; the schema's `maxLength` counts
 * grapheme clusters, each one code point or more, so it never refuses a story the handler takes.
 */
export type WriteChronicleStory = Type.Static<typeof WriteChronicleStory>
export const WriteChronicleStory = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.WriteChronicleStory),
            playerId: Type.String(),
            text: Type.String({ maxLength: CHRONICLE_STORY_LIMIT }),
            metadata: Type.Optional(WriteChronicleStoryMetadata)
        })
    ])
)

export const WriteChronicleStoryValidator = Compile(WriteChronicleStory)

export function isWriteChronicleStory(action?: GameAction): action is WriteChronicleStory {
    return action?.type === ActionType.WriteChronicleStory
}

export class HydratedWriteChronicleStory
    extends HydratableAction<typeof WriteChronicleStory>
    implements WriteChronicleStory
{
    declare type: ActionType.WriteChronicleStory
    declare playerId: string
    declare text: string
    declare metadata?: WriteChronicleStoryMetadata

    constructor(data: WriteChronicleStory) {
        super(data, WriteChronicleStoryValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = reasonCannotWriteChronicleStory(state, this.playerId, this.text)
        if (reason) throw Error(reason)
        this.revealsInfo = false
        // Held until the record's entry, written in this same action, takes it.
        chronicleOf(state).story = normalizedStory(this.text)
        this.metadata = { gameNumber: (state.chronicleRecord?.length ?? 0) + 1 }
    }

    static canDoWriteChronicleStory(state: HydratedOathGameState, playerId: string): boolean {
        return reasonCannotWriteChronicleStory(state, playerId) === undefined
    }
}
