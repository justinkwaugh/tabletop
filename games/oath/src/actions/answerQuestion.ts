import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PowerQuestionKind, QuestionAnswer } from '../model/question.js'
import { Region } from '../model/oathEnums.js'
import { RelicToDeckBottom } from '../model/powerOutcome.js'
import { PileDeposit } from '../model/hidden.js'
import {
    applyAnswer,
    currentQuestion,
    reasonCannotAnswer,
    resumeStateAfterQuestions
} from '../util/questions.js'
import { commitHiddenOutputs } from '../util/hiddenInputs.js'

export type AnswerQuestionMetadata = Type.Static<typeof AnswerQuestionMetadata>
export const AnswerQuestionMetadata = Type.Object({
    cardId: Type.String(),
    kind: Type.Enum(PowerQuestionKind),
    summary: Type.String(),
    // Carried on the action: the handler reads it after apply() has emptied the queue.
    resumeMachineState: Type.Enum(MachineState),
    last: Type.Boolean(),
    // Family Heirloom
    relicToDeckBottom: Type.Optional(RelicToDeckBottom),
    // Inquisitor, R-10.5
    discardedCardIds: Type.Optional(
        Visibility.protect(Type.Array(Type.String()), { policy: Visibility.Policy.Actor })
    ),
    discardPileRegion: Type.Optional(Type.Enum(Region)),
    pileDeposits: Type.Optional(Type.Array(PileDeposit, { maxItems: 8 })),
    // Skeleton Key
    relicTakenFromSlotId: Type.Optional(Type.String())
})

export type AnswerQuestion = Type.Static<typeof AnswerQuestion>
export const AnswerQuestion = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AnswerQuestion),
            playerId: Type.String(),
            answer: QuestionAnswer,
            metadata: Type.Optional(AnswerQuestionMetadata)
        })
    ])
)

export const AnswerQuestionValidator = Compile(AnswerQuestion)

export function isAnswerQuestion(action?: GameAction): action is AnswerQuestion {
    return action?.type === ActionType.AnswerQuestion
}

export class HydratedAnswerQuestion
    extends HydratableAction<typeof AnswerQuestion>
    implements AnswerQuestion
{
    declare type: ActionType.AnswerQuestion
    declare playerId: string
    declare answer: QuestionAnswer
    declare metadata?: AnswerQuestionMetadata

    constructor(data: AnswerQuestion) {
        super(data, AnswerQuestionValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const question = currentQuestion(state)
        const reason = HydratedAnswerQuestion.reasonCannotAnswer(state, this.playerId, this.answer)
        if (reason || !question) {
            throw Error(`Cannot answer: ${reason ?? 'no question is open'}`)
        }
        const resume = resumeStateAfterQuestions(state)
        const outcome = applyAnswer(state, this.playerId, this.answer)
        // R-X.3 — an answer that moves a card into the vault, or rolls, cannot be undone.
        this.revealsInfo =
            outcome.relicToDeckBottom !== undefined ||
            outcome.relicTakenFromSlotId !== undefined ||
            outcome.rolled === true ||
            outcome.disclosed === true ||
            (outcome.discardedCardIds?.length ?? 0) > 0 ||
            (outcome.pileDeposits?.length ?? 0) > 0
        this.metadata = {
            cardId: question.cardId,
            kind: question.kind,
            summary: outcome.summary,
            resumeMachineState: resume,
            last: false,
            relicToDeckBottom: outcome.relicToDeckBottom,
            discardedCardIds: outcome.discardedCardIds,
            discardPileRegion: outcome.discardPileRegion,
            pileDeposits: outcome.pileDeposits,
            relicTakenFromSlotId: outcome.relicTakenFromSlotId
        }
        commitHiddenOutputs(this, state)
    }

    static reasonCannotAnswer(
        state: HydratedOathGameState,
        playerId: string,
        answer: QuestionAnswer
    ): string | undefined {
        return reasonCannotAnswer(state, playerId, answer)
    }

    static canAnswer(state: HydratedOathGameState, playerId: string): boolean {
        return currentQuestion(state)?.askedPlayerId === playerId
    }
}
