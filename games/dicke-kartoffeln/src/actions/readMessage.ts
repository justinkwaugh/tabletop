import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { FERTILIZER_WASHOUT_WORMS } from '../components/costs.js'
import {
    IRRIGATION_COST_PER_FIELD,
    MESSAGE_EFFECTS,
    MessageId,
    MessageSpaceId,
    contestAward,
    spaceForRoll
} from '../components/messages.js'
import { ActionType } from '../definition/actions.js'
import { readSetup } from '../definition/setup.js'
import { Contest, type HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { shiftDemand, shiftPrices } from '../model/market.js'
import { isSown } from '../model/planRules.js'
import { setWorms, type HydratedDickeKartoffelnPlayerState } from '../model/playerState.js'

export type FarmPayment = Type.Static<typeof FarmPayment>
export const FarmPayment = Type.Object({
    playerId: Type.String(),
    paid: Type.Number(),
    loansTaken: Type.Number()
})

export type WashedOutFields = Type.Static<typeof WashedOutFields>
export const WashedOutFields = Type.Object({
    playerId: Type.String(),
    fieldIds: Type.Array(Type.Number())
})

export type ReadMessageMetadata = Type.Static<typeof ReadMessageMetadata>
export const ReadMessageMetadata = Type.Object({
    roll: Type.Number(),
    space: Type.Enum(MessageSpaceId),
    messageId: Type.Enum(MessageId),
    setAside: Type.Array(Type.Enum(MessageId)),
    drawn: Type.Array(Type.Enum(MessageId)),
    washedOut: Type.Array(WashedOutFields),
    irrigation: Type.Array(FarmPayment),
    contest: Type.Optional(Contest)
})

export type ReadMessage = Type.Static<typeof ReadMessage>
export const ReadMessage = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ReadMessage),
            metadata: Type.Optional(ReadMessageMetadata)
        })
    ])
)

export const ReadMessageValidator = Compile(ReadMessage)

export function isReadMessage(action?: GameAction): action is ReadMessage {
    return action?.type === ActionType.ReadMessage
}

// The die picks one of the three face-up messages. It takes effect and leaves the game, and a
// fresh card fills its space. The ministry contest cards send the farmers to the next card when
// they come up in the first or the last year.
export class HydratedReadMessage
    extends HydratableAction<typeof ReadMessage>
    implements ReadMessage
{
    declare type: ActionType.ReadMessage
    declare metadata?: ReadMessageMetadata

    constructor(data: ReadMessage) {
        super(data, ReadMessageValidator)
    }

    apply(state: HydratedDickeKartoffelnGameState, context?: MachineContext) {
        assertExists(context, 'Reading a message needs the game configuration')
        const setup = readSetup(context.gameConfig)
        const board = state.messageBoard()
        const year = state.year()
        const roll = state.getProtectedPrng().dieRoll(6)
        const space = spaceForRoll(roll)
        const setAside: MessageId[] = []
        const drawn: MessageId[] = []
        let messageId = board.messageOn(space)
        while (contestAward(messageId) && (year === 1 || year === setup.years)) {
            setAside.push(messageId)
            board.read.push(messageId)
            messageId = board.deck.draw()
            drawn.push(messageId)
        }
        board.read.push(messageId)
        board.current = messageId
        const replacement = board.deck.draw()
        drawn.push(replacement)
        board.place(space, replacement)

        const washedOut: WashedOutFields[] = []
        const irrigation: FarmPayment[] = []
        let contest: Contest | undefined
        for (const effect of MESSAGE_EFFECTS[messageId]) {
            switch (effect.kind) {
                case 'Demand':
                    shiftDemand(state, effect.changes)
                    break
                case 'Price':
                    shiftPrices(state, effect.steps)
                    break
                case 'WormLoss':
                    washedOut.push(...state.players.map(rainOn))
                    break
                case 'Irrigation':
                    irrigation.push(...state.players.map(irrigate))
                    break
                case 'Contest':
                    contest = { award: effect.award, year: year + 1 }
                    state.contests.push(contest)
                    break
                case 'Yield':
                    break
            }
        }
        this.metadata = {
            roll,
            space,
            messageId,
            setAside,
            drawn,
            washedOut: washedOut.filter((farm) => farm.fieldIds.length > 0),
            irrigation: irrigation.filter((payment) => payment.paid > 0),
            ...(contest ? { contest } : {})
        }
    }
}

// Every field loses a worm; fertilizer washes out of a field left with fewer than four.
function rainOn(player: HydratedDickeKartoffelnPlayerState): WashedOutFields {
    const fieldIds: number[] = []
    for (const field of player.fields) {
        setWorms(field, field.worms - 1)
        if (field.fertilizer > 0 && field.worms < FERTILIZER_WASHOUT_WORMS) {
            field.fertilizer = 0
            fieldIds.push(field.id)
        }
    }
    return { playerId: player.playerId, fieldIds }
}

function irrigate(player: HydratedDickeKartoffelnPlayerState): FarmPayment {
    const cost = player.fields.filter(isSown).length * IRRIGATION_COST_PER_FIELD
    return { playerId: player.playerId, ...player.pay(cost) }
}
