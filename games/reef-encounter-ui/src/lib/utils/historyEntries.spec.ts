import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    CALL_GAME_ACTION_TYPE,
    GameCallKind,
    type CallGameAction,
    type GameAction
} from '@tabletop/common'
import { ActionType } from '@tabletop/reef-encounter'
import {
    finalTurnEntries,
    historyEntries,
    historyStep,
    isSetupEntry,
    movesPieces,
    previousTurn
} from './historyEntries.js'

const action = (type: ActionType, playerId?: string): GameAction => ({
    id: `${type}-${playerId ?? 'system'}-${Math.random()}`,
    gameId: 'game',
    type,
    playerId,
    source: playerId ? ActionSource.User : ActionSource.System
})

describe('history entries', () => {
    it('groups a player turn with the refill it causes', () => {
        const entries = historyEntries([
            action(ActionType.PlayLarvaCube, 'a'),
            action(ActionType.PlacePolyp, 'a'),
            action(ActionType.TakeOpenSeaSpace, 'a'),
            action(ActionType.RefillOpenSea),
            action(ActionType.PlayLarvaCube, 'b')
        ])
        expect(entries.map((entry) => [entry.playerId, entry.actions.length])).toEqual([
            ['a', 4],
            ['b', 1]
        ])
    })

    it('gives each setup choice by a different player its own entry', () => {
        const entries = historyEntries([
            action(ActionType.FeedParrotfish, 'a'),
            action(ActionType.FeedParrotfish, 'b'),
            action(ActionType.ChooseLarvaCubes, 'a')
        ])
        expect(entries.map((entry) => entry.playerId)).toEqual(['a', 'b', 'a'])
    })

    it('keeps the start player’s feed apart from their cubes chosen just after it', () => {
        const entries = historyEntries([
            action(ActionType.FeedParrotfish, 'b'),
            action(ActionType.FeedParrotfish, 'a'),
            action(ActionType.ChooseLarvaCubes, 'a')
        ])
        expect(entries.map((entry) => entry.actions.length)).toEqual([1, 1, 1])
    })

    it('sets the end of the game apart from the last turn', () => {
        const entries = historyEntries([
            action(ActionType.EatCoral, 'a'),
            action(ActionType.EndGame)
        ])
        expect(entries.map((entry) => entry.playerId)).toEqual(['a', undefined])
    })

    it('sets a called game apart from the turn it cut short', () => {
        const call: CallGameAction = {
            id: 'call',
            gameId: 'game',
            type: CALL_GAME_ACTION_TYPE,
            source: ActionSource.System,
            call: {
                kind: GameCallKind.Conceded,
                initiatorPlayerId: 'a',
                declaredWinnerIds: ['b'],
                approvingPlayerIds: ['a'],
                decliningPlayerIds: []
            }
        }
        const entries = historyEntries([
            action(ActionType.PlayLarvaCube, 'a'),
            action(ActionType.PlacePolyp, 'a'),
            call
        ])
        expect(entries.map((entry) => [entry.playerId, entry.actions.length])).toEqual([
            ['a', 2],
            [undefined, 1]
        ])
    })

    it('replays only entries that move pieces on the table', () => {
        const [setup, trade, turn] = historyEntries([
            action(ActionType.ChooseLarvaCubes, 'a'),
            action(ActionType.ExchangeLarvaCube, 'b'),
            action(ActionType.MoveShrimp, 'a')
        ])
        expect([setup, trade, turn].map(movesPieces)).toEqual([false, false, true])
    })

    it('takes the History Step on screen from its player action through the system actions after it', () => {
        const take = action(ActionType.TakeOpenSeaSpace, 'a')
        const refill = action(ActionType.RefillOpenSea)
        expect(historyStep([action(ActionType.PlacePolyp, 'a'), take, refill])).toEqual([
            take,
            refill
        ])
        expect(historyStep([refill])).toEqual([refill])
    })

    it("recounts the latest turn of a player who isn't acting now", () => {
        const actions = [
            action(ActionType.TakeOpenSeaSpace, 'a'),
            action(ActionType.RefillOpenSea),
            action(ActionType.PlayLarvaCube, 'b')
        ]
        expect(previousTurn(actions, ['b'])?.actions).toEqual(actions.slice(0, 2))
        expect(previousTurn(actions, ['a', 'b'])).toBeUndefined()
    })

    it('tells setup entries from the turns that follow', () => {
        const [feed, cubes, turn] = historyEntries([
            action(ActionType.FeedParrotfish, 'a'),
            action(ActionType.ChooseLarvaCubes, 'b'),
            action(ActionType.PlayLarvaCube, 'a')
        ])
        expect([feed, cubes, turn].map(isSetupEntry)).toEqual([true, true, false])
    })

    it('marks the entries after the move that started the final turns', () => {
        const lock = {
            ...action(ActionType.PlayAlgaCylinder, 'a'),
            metadata: { flippedTileIds: [], startsFinalTurns: true }
        }
        const entries = historyEntries([
            action(ActionType.PlayLarvaCube, 'b'),
            lock,
            action(ActionType.PassFinalTurn, 'b'),
            action(ActionType.EndGame)
        ])
        expect([...finalTurnEntries(entries)].map((entry) => entry.playerId)).toEqual(['b'])
        expect(finalTurnEntries(entries.slice(0, 1)).size).toBe(0)
    })
})
