import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    ConsentRequestKind,
    MachineState,
    PlayerStatus,
    PowerQuestionKind,
    type PowerQuestion
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { turnBarOf } from './turnBar.js'

const herald: PowerQuestion = {
    kind: PowerQuestionKind.PickFavorBank,
    cardId: 'denizen.hearth.herald',
    askedPlayerId: 'other',
    amount: 1
}

function board(overrides: Parameters<typeof testState>[1] = {}) {
    const state = testState(
        [
            testPlayer({ playerId: 'turn', color: Color.Red, siteId: 'c1' }),
            testPlayer({ playerId: 'other', color: Color.Blue, siteId: 'c1' }),
            testPlayer({
                playerId: 'chan',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c2'
            })
        ],
        { chancellorPlayerId: 'chan', round: 6, ...overrides }
    )
    openTurn(state, 'turn')
    state.activePlayerIds = ['other']
    return state
}

function questionAsked(resumeMachineState: MachineState) {
    return { queue: [herald], askingPlayerId: 'turn', resumeMachineState }
}

describe('turnBarOf', () => {
    it('names the turn and its phase in the Wake, Act and Rest Phases', () => {
        for (const [machineState, phase] of [
            [MachineState.WakePhase, 'Wake Phase'],
            [MachineState.ActPhase, 'Act Phase'],
            [MachineState.RestPhase, 'Rest Phase']
        ] as const) {
            expect(turnBarOf(board({ machineState }))).toEqual({
                playerId: 'turn',
                roll: false,
                paused: false,
                phase
            })
        }
    })

    it('names nobody in Setup, where no turn has begun', () => {
        const state = board({ machineState: MachineState.Setup })
        state.turnManager.series = []
        expect(turnBarOf(state)).toEqual({
            playerId: undefined,
            roll: false,
            paused: false,
            phase: 'Setup'
        })
    })

    it('names the Chancellor’s roll between rounds', () => {
        const state = board({ machineState: MachineState.EndOfRound })
        state.turnManager.series = [{ type: 'turn', playerId: 'turn', start: 0, end: 4 }]
        expect(turnBarOf(state)).toEqual({
            playerId: 'chan',
            roll: true,
            paused: false,
            phase: 'End of round 6'
        })
    })

    it('reads "Game over" once the game has ended', () => {
        expect(turnBarOf(board({ machineState: MachineState.EndOfGame })).phase).toBe('Game over')
    })

    it('names the turn, not the seat the engine waits on, in every step of the Act Phase', () => {
        for (const machineState of [
            MachineState.Searching,
            MachineState.CampaignPlans,
            MachineState.CampaignSacrifice,
            MachineState.CampaignDefeat,
            MachineState.CampaignVictory
        ]) {
            expect(turnBarOf(board({ machineState }))).toEqual({
                playerId: 'turn',
                roll: false,
                paused: false,
                phase: 'Act Phase'
            })
        }
    })

    it('gives a question the phase its turn resumes', () => {
        const acting = board({
            machineState: MachineState.PowerQuestion,
            pendingQuestions: questionAsked(MachineState.ActPhase)
        })
        expect(turnBarOf(acting)).toMatchObject({ playerId: 'turn', phase: 'Act Phase' })

        const endingActPhase = board({
            machineState: MachineState.PowerQuestion,
            pendingQuestions: questionAsked(MachineState.RestPhase)
        })
        expect(turnBarOf(endingActPhase).phase).toBe('Rest Phase')

        const inABattle = board({
            machineState: MachineState.PowerQuestion,
            pendingQuestions: questionAsked(MachineState.CampaignVictory)
        })
        expect(turnBarOf(inABattle).phase).toBe('Act Phase')
    })

    it('gives a request for consent the phase its turn resumes, the Act Phase for a Campaign’s asks', () => {
        const withResume = board({
            machineState: MachineState.ConsentRequest,
            pendingConsent: {
                request: { kind: ConsentRequestKind.AdmitAlly, citizenPlayerId: 'other' },
                askingPlayerId: 'turn',
                askedPlayerId: 'other',
                resumeMachineState: MachineState.ActPhase
            }
        })
        expect(turnBarOf(withResume)).toMatchObject({ playerId: 'turn', phase: 'Act Phase' })

        const campaignAsk = board({
            machineState: MachineState.ConsentRequest,
            pendingConsent: {
                request: { kind: ConsentRequestKind.JoinDefence, citizenPlayerId: 'other' },
                askingPlayerId: 'turn',
                askedPlayerId: 'other'
            }
        })
        expect(turnBarOf(campaignAsk)).toMatchObject({ playerId: 'turn', phase: 'Act Phase' })
    })

    it('gives the Oathkeeper choice the phase it came in, through a question it interrupted', () => {
        const state = board({
            machineState: MachineState.OathkeeperChoice,
            pendingOathkeeperChoice: {
                holderPlayerId: 'other',
                candidates: ['turn', 'chan'],
                resumeMachineState: MachineState.PowerQuestion
            },
            pendingQuestions: questionAsked(MachineState.RestPhase)
        })
        expect(turnBarOf(state)).toMatchObject({ playerId: 'turn', phase: 'Rest Phase' })
    })

    it('names whose turn is paused while a Campaign runs out of turn, with that turn’s phase', () => {
        const state = board({
            machineState: MachineState.CampaignSacrifice,
            heldTurn: { queue: [], askingPlayerId: 'turn', resumeMachineState: MachineState.ActPhase }
        })
        expect(turnBarOf(state)).toEqual({
            playerId: 'turn',
            roll: false,
            paused: true,
            phase: 'Act Phase'
        })

        const askedInIt = board({
            machineState: MachineState.PowerQuestion,
            pendingQuestions: questionAsked(MachineState.CampaignSacrifice),
            heldTurn: { queue: [], askingPlayerId: 'turn', resumeMachineState: MachineState.RestPhase }
        })
        expect(turnBarOf(askedInIt)).toMatchObject({ paused: true, phase: 'Rest Phase' })
    })

    it('refuses a state whose steps resume into each other', () => {
        const state = board({
            machineState: MachineState.OathkeeperChoice,
            pendingOathkeeperChoice: {
                holderPlayerId: 'other',
                candidates: ['turn', 'chan'],
                resumeMachineState: MachineState.PowerQuestion
            },
            pendingQuestions: questionAsked(MachineState.OathkeeperChoice)
        })
        expect(() => turnBarOf(state)).toThrow()
    })
})
