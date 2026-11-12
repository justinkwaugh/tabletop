import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { DrawBag, Hydratable, HydratedDrawBag, Visibility, assertExists } from '@tabletop/common'
import { MessageId, MessageSpaceId } from '../components/messages.js'

export type MessageDeck = Type.Static<typeof MessageDeck>
export const MessageDeck = DrawBag(Type.Enum(MessageId))

const MessageDeckValidator = Compile(MessageDeck)

export class HydratedMessageDeck
    extends HydratedDrawBag<MessageId, typeof MessageDeck>
    implements MessageDeck
{
    constructor(data: MessageDeck) {
        super(data, MessageDeckValidator)
    }
}

export type FaceUpMessage = Type.Static<typeof FaceUpMessage>
export const FaceUpMessage = Type.Object({
    space: Type.Enum(MessageSpaceId),
    messageId: Type.Enum(MessageId)
})

// The three face-up message spaces ("1-2-3", "4-5", "6"), the deck they are refilled from,
// and the cards already read and put back in the box.
export type MessageBoard = Type.Static<typeof MessageBoard>
export const MessageBoard = Type.Object({
    deck: MessageDeck,
    spaces: Type.Array(FaceUpMessage),
    read: Type.Array(Type.Enum(MessageId)),
    current: Type.Optional(Type.Enum(MessageId))
})

const ProjectedMessageBoard = Visibility.createProjectionSchema(MessageBoard)
type ProjectedMessageBoard = Type.Static<typeof ProjectedMessageBoard>
const ProjectedMessageBoardValidator = Compile(ProjectedMessageBoard)

export class HydratedMessageBoard
    extends Hydratable<typeof ProjectedMessageBoard>
    implements ProjectedMessageBoard
{
    declare deck: HydratedMessageDeck
    declare spaces: FaceUpMessage[]
    declare read: MessageId[]
    declare current?: MessageId

    constructor(data: ProjectedMessageBoard) {
        super(data, ProjectedMessageBoardValidator)
        this.deck = new HydratedMessageDeck(data.deck)
    }

    private faceUp(space: MessageSpaceId): FaceUpMessage {
        const card = this.spaces.find((candidate) => candidate.space === space)
        assertExists(card, `No message lies on space ${space}`)
        return card
    }

    messageOn(space: MessageSpaceId): MessageId {
        return this.faceUp(space).messageId
    }

    place(space: MessageSpaceId, messageId: MessageId) {
        this.faceUp(space).messageId = messageId
    }
}
