import { describe, expect, it } from 'vitest'
import {
    cashOwnedBy,
    isCompleteStockRound,
    isFinishOperatingTurn,
    isStartOperatingRound,
    recordedRoundEnd,
    type EighteenXXState
} from '@tabletop/18xx'
import { assertExists, type GameAction, type GameConfig } from '@tabletop/common'
import {
    wealthHistory,
    type WealthHistoryTitle
} from '../../../../libs/18xx-ui/src/lib/table/wealthHistory.js'
import { EighteenSeventeenPresentation } from '../../../../games/1817-ui/src/lib/presentation.js'
import { EighteenThirtyTwoPresentation } from '../../../../games/1832-ui/src/lib/presentation.js'
import { Presentation1846 } from '../../../../games/1846-ui/src/lib/presentation.js'
import { openingGame } from '../../../../games/1846/test/testSupport.js'
import {
    openingPurchaseChoices,
    unboughtOpeningCompanies
} from '../../../../games/1846/src/publicDistribution.js'
import { finishedGame, replayRecordedGame } from './finishedGame.js'
import { playgroundTitle, type PlaygroundTitle } from '../titles.js'

const TitleRounds: Readonly<Record<string, WealthHistoryTitle['titleRounds']>> = {
    '1817': EighteenSeventeenPresentation.titleRounds,
    '1832': EighteenThirtyTwoPresentation.titleRounds
}

function historyOf(
    title: PlaygroundTitle,
    actions: readonly GameAction[],
    state: EighteenXXState,
    config: GameConfig
) {
    return wealthHistory(actions, state, {
        startingCash: title.rules.startingCash({ playerCount: state.players.length, config }),
        titleRounds: TitleRounds[title.key]
    })
}

describe.each([
    ['TOP', 'the-old-prince'],
    ['1889', 'shikoku-1889'],
    ['1830', '1830'],
    ['1832', '1832'],
    ['1817', '1817']
] as const)('%s wealth history', (key, typeId) => {
    it('starts from the opening cash and ends at the final wealth, once per round', async () => {
        const title = playgroundTitle(key)
        const { game, state, initialState, actions } = await finishedGame('local', 'Game', typeId)
        const points = historyOf(title, actions, state, game.config)
        expect(points[0]).toMatchObject({ id: 'start', label: 'Start' })
        for (const { playerId } of initialState.players)
            expect(points[0].wealth[playerId]).toBe(
                cashOwnedBy(initialState, { kind: 'player', playerId })
            )
        const final = state.finalWealth
        assertExists(final)
        expect(points.at(-1)?.wealth).toEqual(
            Object.fromEntries(final.map(({ playerId, total }) => [playerId, total]))
        )
        const labels = points.map((point) => point.label)
        expect(new Set(labels).size).toBe(labels.length)
        expect(labels.slice(0, 4)).toEqual(['Start', 'Auction', 'SR 1', 'OR 1.1'])
        // Each stock round ends at its completion, after its market moves.
        const stockEnds = actions.filter(isCompleteStockRound).map((action) => {
            const end = recordedRoundEnd(action)
            assertExists(end)
            return end.playerNetWorth
        })
        expect(points.filter((point) => point.label.startsWith('SR '))).toEqual(
            stockEnds.map((wealth, index) =>
                expect.objectContaining({ id: `SR ${index + 1}`, wealth })
            )
        )
        // Every operating round started has a point, whichever way its last turn ended.
        const operatingRounds = new Set(
            actions.filter(isStartOperatingRound).map((action) => {
                const snapshot = action.metadata?.snapshot
                assertExists(snapshot)
                return `OR ${snapshot.number}.${snapshot.roundNumber}`
            })
        )
        expect(labels.filter((label) => label.startsWith('OR '))).toEqual([...operatingRounds])
        if (key === '1817') expect(labels.some((label) => label.startsWith('MR '))).toBe(true)
        if (key === '1832') expect(labels.some((label) => label.startsWith('MP '))).toBe(true)
    }, 240_000)
})

it('takes an unrecorded stock round’s end from the next operating round’s start', async () => {
    const title = playgroundTitle('TOP')
    const { game, state, actions } = await finishedGame('local', 'Game', 'the-old-prince')
    const unrecorded = actions.map((action) => {
        if (!isCompleteStockRound(action)) return action
        const { roundEnd: _, ...metadata } = action.metadata ?? {
            nextPlayerOrder: [],
            marketMoves: []
        }
        return { ...action, metadata }
    })
    const points = historyOf(title, unrecorded, state, game.config)
    const firstOperatingStart = actions.find(isStartOperatingRound)?.metadata?.snapshot
    assertExists(firstOperatingStart)
    expect(points.find((point) => point.id === 'SR 1')?.wealth).toEqual(
        firstOperatingStart.playerNetWorth
    )
    expect(points.map((point) => point.label)).toEqual(
        historyOf(title, actions, state, game.config).map((point) => point.label)
    )
}, 240_000)

it('ends an unfinished game at its last finished round', async () => {
    const title = playgroundTitle('TOP')
    const fixture = (await title.finishedGame!()).default
    const { game, state, actions } = await replayRecordedGame(
        title,
        { ...fixture, actions: fixture.actions.slice(0, 400) },
        'local',
        'Game'
    )
    const points = historyOf(title, actions, state, game.config)
    const lastEnd = actions.findLast(
        (action) =>
            recordedRoundEnd(action) || (isFinishOperatingTurn(action) && action.metadata?.complete)
    )
    assertExists(lastEnd)
    expect(points.at(-1)?.wealth).toEqual(
        recordedRoundEnd(lastEnd)?.playerNetWorth ??
            (isFinishOperatingTurn(lastEnd) ? lastEnd.metadata?.playerNetWorth : undefined)
    )
}, 240_000)

it('charts 1846’s two-player opening as one round, with its operating rounds inside it', () => {
    const table = openingGame()
    const buy = (companyId: string) => {
        const choice = openingPurchaseChoices(table.hydrated, table.state.activePlayerIds[0]).find(
            (choice) => choice.companyId === companyId
        )
        assertExists(choice, 'Opening company must be affordable')
        table.act('BuyOpeningCompany', choice)
    }
    buy('MS')
    table.act('PassOpeningPurchase')
    table.act('PassOpeningPurchase')
    for (let step = 0; step < 20 && table.state.machineState !== 'BuyingOpeningCompanies'; step++) {
        const companyId = table.state.trackStep?.companyId
        if (table.state.machineState === 'AssigningSteamboat') table.act('AssignSteamboat')
        else if (table.state.machineState === 'LayingTrack') table.act('FinishTrack', { companyId })
        else table.act('RunTrains', { companyId: table.state.routeStep?.companyId, routes: [] })
    }
    while (unboughtOpeningCompanies(table.hydrated).length)
        buy(unboughtOpeningCompanies(table.hydrated)[0])
    expect(table.state.machineState).toBe('StockRound')
    expect(table.actions.some((action) => recordedRoundEnd(action)?.round === 'operating')).toBe(
        true
    )
    const points = wealthHistory(table.actions, table.state, {
        startingCash: playgroundTitle('1846').rules.startingCash({
            playerCount: 2,
            config: table.game.config
        }),
        openingRound: Presentation1846.openingRound
    })
    expect(points.map((point) => point.label)).toEqual(['Start', 'Draft'])
})
