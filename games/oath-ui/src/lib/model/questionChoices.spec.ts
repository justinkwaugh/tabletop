import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    HydratedAnswerQuestion,
    MachineState,
    PowerQuestionKind,
    Region,
    SearchPlay
} from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { discardOrderOf } from './discardOrder.js'
import {
    advisersToDiscardForVision,
    offerableAdviserRows,
    playVisionAnswer,
    stackOrderAnswer
} from './questionChoices.js'

const ADVISERS = ['denizen.order.messenger', 'denizen.order.longbows', 'denizen.hearth.herald']

function asked(adviserCount: number) {
    return testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                advisers: ADVISERS.slice(0, adviserCount).map((cardId) => ({
                    cardId,
                    faceUp: false
                }))
            }),
            testPlayer({ playerId: 'holder', color: Color.Blue, siteId: 'c2' })
        ],
        {
            machineState: MachineState.PowerQuestion,
            pendingQuestions: {
                askingPlayerId: 'holder',
                resumeMachineState: MachineState.ActPhase,
                queue: [
                    {
                        kind: PowerQuestionKind.PlayOrDiscardVision,
                        cardId: 'denizen.discord.false-prophet',
                        askedPlayerId: 'me',
                        visionCardId: 'vision.conquest'
                    }
                ]
            }
        }
    )
}

describe('playVisionAnswer', () => {
    it('names the adviser to discard only when one is given', () => {
        expect(playVisionAnswer(SearchPlay.Discard)).toEqual({
            kind: PowerQuestionKind.PlayOrDiscardVision,
            play: SearchPlay.Discard
        })
        expect(playVisionAnswer(SearchPlay.Adviser, ADVISERS[0])).toEqual({
            kind: PowerQuestionKind.PlayOrDiscardVision,
            play: SearchPlay.Adviser,
            discardedAdviserCardId: ADVISERS[0]
        })
    })
})

describe('advisersToDiscardForVision', () => {
    it('below the adviser limit nothing needs discarding', () => {
        expect(advisersToDiscardForVision(asked(2), 'me')).toEqual([])
    })

    it('at the limit every adviser the engine accepts is offered', () => {
        expect(advisersToDiscardForVision(asked(3), 'me')).toEqual(ADVISERS)
    })

    it('a player not asked is offered nothing', () => {
        expect(advisersToDiscardForVision(asked(3), 'holder')).toEqual([])
    })
})

describe('stackOrderAnswer (Pilgrimage, Law Glossary "Discard")', () => {
    const DRAWN = ['denizen.arcane.tutor', 'denizen.hearth.storyteller', 'denizen.discord.scryer']
    const stacking = () =>
        testState([testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1' })], {
            machineState: MachineState.PowerQuestion,
            pendingQuestions: {
                askingPlayerId: 'me',
                resumeMachineState: MachineState.ActPhase,
                queue: [
                    {
                        kind: PowerQuestionKind.OrderDrawnCards,
                        cardId: 'denizen.nomad.pilgrimage',
                        askedPlayerId: 'me',
                        region: Region.Cradle,
                        cardCount: DRAWN.length,
                        cardIds: DRAWN
                    }
                ]
            }
        })

    it('names each tapped card by its position in the question, the untapped last one on top', () => {
        const order = discardOrderOf([DRAWN[2], DRAWN[0]], DRAWN)
        expect(order).toEqual([DRAWN[2], DRAWN[0], DRAWN[1]])
        const answer = stackOrderAnswer(PowerQuestionKind.OrderDrawnCards, DRAWN, order)
        expect(answer).toEqual({ kind: PowerQuestionKind.OrderDrawnCards, order: [2, 0, 1] })
        expect(JSON.stringify(answer)).not.toContain('denizen')
        expect(HydratedAnswerQuestion.reasonCannotAnswer(stacking(), 'me', answer)).toBeUndefined()
    })

    it('a card that is not among those drawn makes an answer the engine refuses', () => {
        const answer = stackOrderAnswer(PowerQuestionKind.OrderDrawnCards, DRAWN, [DRAWN[0], DRAWN[1], 'denizen.order.scouts'])
        expect(HydratedAnswerQuestion.reasonCannotAnswer(stacking(), 'me', answer)).toBe(
            'the order must name each of the 3 cards once'
        )
    })
})

describe('the advisers an exchange may offer (R-10.8, R-9.4)', () => {
    function holders() {
        return testState([
            testPlayer({ playerId: 'me', color: Color.Red, advisers: [{ cardId: ADVISERS[0], faceUp: false }, { cardId: ADVISERS[1], faceUp: true }] }),
            testPlayer({ playerId: 'them', color: Color.Blue, advisers: [{ cardId: ADVISERS[2], faceUp: false }] })
        ])
    }

    it('offers every row by position, naming and picturing a facedown card to its holder alone', () => {
        const state = holders()
        expect(offerableAdviserRows(state, 'me', 'me')).toEqual([
            { row: 0, cardId: ADVISERS[0], label: 'Messenger (facedown)' },
            { row: 1, cardId: ADVISERS[1], label: 'Longbows' }
        ])
        expect(offerableAdviserRows(state, 'them', 'me')).toEqual([
            { row: 0, label: 'the facedown adviser in row 1' }
        ])
        expect(offerableAdviserRows(state, 'them', 'me')[0]).not.toHaveProperty('cardId', ADVISERS[2])
        expect(offerableAdviserRows(state, 'me', 'them').map((row) => row.cardId)).toEqual([undefined, ADVISERS[1]])
        expect(JSON.stringify(offerableAdviserRows(state, 'me', 'them'))).not.toContain('Messenger')
    })
})
