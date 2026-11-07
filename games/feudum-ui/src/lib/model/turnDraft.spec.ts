import { flushSync } from 'svelte'
import { assertExists, type GameAction } from '@tabletop/common'
import {
    ActionType,
    exploreOffer,
    HydratedFeudumGameState,
    MachineState,
    placeMarker,
    Spaces,
    taxPreview,
    type ActionCardKind,
    type SpaceId
} from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeudumHost, settled } from '$lib/testing/sessionHarness.js'
import {
    addPawn,
    atPlayingCards,
    buildFeudum,
    emptySpace,
    emptySpaces,
    giveBead,
    giveGood,
    giveSeal,
    giveTile,
    returnGoods,
    ruleOutpost,
    ruleTown,
    spendMarkers,
    type TurnTable
} from '$lib/testing/turnTable.js'
import {
    markerTarget,
    pawnTarget,
    roleOf,
    spaceTarget,
    stackTarget,
    chipOf,
    type BoardTarget
} from './boardOffer.js'
import {
    regionOf,
    spaceLabel,
    TurnStageOrder,
    type PanelChoice,
    type TurnDraftValues
} from './cardFlows.js'
import type { FeudumGameSession } from './session.svelte.js'
import { StagedDraft } from './stagedDraft.svelte.js'

let host: FeudumHost | undefined

async function table(
    cards: readonly ActionCardKind[],
    arrange?: (state: HydratedFeudumGameState, turn: TurnTable) => void,
    options: Parameters<typeof atPlayingCards>[1] = {}
): Promise<TurnTable & { session: FeudumGameSession }> {
    const turn = await atPlayingCards(cards, options)
    host = turn.host
    if (arrange) {
        turn.host.edit((state) => {
            arrange(state, turn)
        })
    }
    return { ...turn, session: await turn.host.openSeat(turn.seat) }
}

/** R-4.3-H1 The stack of the region of the town the seat rules, its last tile on top. */
function reverseHomeStack(state: HydratedFeudumGameState, seat: string): void {
    const town = Spaces.find(
        ({ id }) =>
            state.spaces[id].ruler?.playerId === seat && state.spaces[id].location.kind === 'town'
    )
    assertExists(town, 'The seat rules a town')
    state.regionStacks[regionOf(town.id)].reverse()
}

function arranged<T>(host: FeudumHost, read: (state: HydratedFeudumGameState) => T): T {
    return read(new HydratedFeudumGameState(host.state))
}

function row(rows: readonly PanelChoice[] | undefined, label: string | RegExp): PanelChoice {
    const found = rows?.find((choice) =>
        typeof label === 'string' ? choice.label === label : label.test(choice.label)
    )
    if (!found) {
        throw new Error(`No row ${label} in ${rows?.map((choice) => choice.label).join(' | ')}`)
    }
    return found
}

function rowAt(session: FeudumGameSession, index: number): PanelChoice {
    const choice = session.turn.flow?.rows[index]
    assertExists(choice, `The flow has a row ${index}`)
    return choice
}

function firstRow(session: FeudumGameSession): PanelChoice {
    return rowAt(session, 0)
}

function firstPick(session: FeudumGameSession): BoardTarget {
    const pick = session.turn.flow?.picks[0]
    assertExists(pick, 'The flow lights a target')
    return pick.target
}

function firstPopup(session: FeudumGameSession): PanelChoice {
    const choice = session.turn.flow?.popup?.choices[0]
    assertExists(choice, 'The flow has a popup')
    return choice
}

function pickCard(session: FeudumGameSession, kind: ActionCardKind) {
    session.pressTurnCard(kind)
    flushSync()
}

async function pressMode(session: FeudumGameSession, label: string | RegExp) {
    await session.pressTurnChoice(row(session.turnPanel?.modes, label))
    flushSync()
}

async function pressRow(session: FeudumGameSession, label: string | RegExp) {
    await session.pressTurnChoice(row(session.turn.flow?.rows, label))
    flushSync()
}

async function pressPopup(session: FeudumGameSession, label: string | RegExp) {
    await session.pressTurnChoice(row(session.turn.flow?.popup?.choices, label))
    await session.waitForVisibleTransitionSettled()
    flushSync()
}

async function pressTarget(session: FeudumGameSession, target: BoardTarget) {
    await session.pressTurnTarget(target)
    await session.waitForVisibleTransitionSettled()
    flushSync()
}

function chipLabels(session: FeudumGameSession, target: BoardTarget): readonly string[] {
    const pick = session.turn.flow?.picks.find((entry) => entry.target === target)
    return pick?.notes?.map(({ label }) => label) ?? []
}

function sentBy(turn: TurnTable, index = 0): GameAction | undefined {
    return turn.host.sent.get(turn.seat)?.[index]
}

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    host?.close()
    host = undefined
    vi.restoreAllMocks()
})

describe('TurnDraft: the hand and the modes (R-3.2, R-3.4, R-3.3)', () => {
    it('S11 R-3.13-H1 a last Conquer shows only Forfeit; its press sends', async () => {
        const turn = await table(['conquer'])
        const { session } = turn
        expect(session.turn.card).toBe('conquer')
        expect(session.turn.entry('card')?.source).toBe('auto')
        expect(session.turnPanel).toMatchObject({
            forfeitOnly: true,
            modes: [],
            forfeit: 'Forfeit'
        })
        expect(session.turnPanel?.primary).toBeUndefined()

        await session.forfeitTurnCard()
        await session.waitForVisibleTransitionSettled()

        expect(sentBy(turn)).toMatchObject({ type: ActionType.ForfeitCard, kind: 'conquer' })
        const seat = session.gameState.getPlayerState(turn.seat)
        expect(seat.played).toEqual([{ kind: 'conquer', use: 'forfeited' }])
    })

    it('R-3.2 Forfeit stays a mode beside what the card can do, and sends the card', async () => {
        const turn = await table(['tax', 'guild'], (state, { seat }) => {
            ruleTown(state, seat)
        })
        const { session } = turn
        pickCard(session, 'tax')
        expect(session.turnPanel).toMatchObject({ forfeitOnly: false, forfeit: 'Forfeit' })
        expect(session.turnPanel?.modes.length).toBe(1)

        await session.forfeitTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({ type: ActionType.ForfeitCard, kind: 'tax' })
    })

    it('R-3.2 before a card is picked, no mode, no Forfeit, no primary', async () => {
        const { session } = await table(['tax', 'guild'])
        expect(session.turnPanel?.cards.map(({ kind }) => kind)).toEqual(['tax', 'guild'])
        expect(session.turnPanel?.forfeit).toBeUndefined()
        expect(session.turnPanel?.primary).toBeUndefined()
        await session.forfeitTurnCard()
        expect(host?.sent.size).toBe(0)
    })

    it('S12 R-3.3 two cards: Tax carries the declaration, then the panel reads the second', async () => {
        const turn = await table(
            ['tax', 'guild', 'explore'],
            (state, { seat }) => {
                ruleTown(state, seat)
            },
            { pouchGood: 'sulfur' }
        )
        const { session } = turn
        expect(session.turnPanel?.line).toMatch(/^Epoch I · Round \d+ · your 1st card of 3$/)
        pickCard(session, 'tax')
        expect(session.turnPanel?.secondCard).toEqual({
            label: 'Play two cards this turn',
            on: false
        })
        session.toggleTurnSecondCard()
        flushSync()
        expect(session.turnPanel?.secondCard?.on).toBe(true)
        expect(session.turn.card).toBe('tax')

        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()

        expect(sentBy(turn)).toMatchObject({ type: ActionType.Tax, secondCard: true })
        expect(session.turnPanel?.line).toBe('Your second card')
        expect(session.turnPanel?.cards.map(({ kind }) => kind)).toEqual(['guild', 'explore'])
        expect(session.gameState.getPlayerState(turn.seat).sequentialUsed).toBe(true)
        expect(session.turnPanel?.secondCard).toBeUndefined()
    })

    it('R-3.3 no pouch sulfur, no toggle; a press on it does nothing', async () => {
        const { session } = await table(['tax', 'guild'])
        pickCard(session, 'tax')
        expect(session.turnPanel?.secondCard).toBeUndefined()
        session.toggleTurnSecondCard()
        expect(session.turn.value('secondCard')).toBeUndefined()
    })

    it('R-3.4 a special shows only when its need is met, and either/or names itself', async () => {
        const cards: ActionCardKind[] = ['conquer', 'tax']
        const without = await table(cards, (state, { seat }) => {
            addPawn(state, seat, 'knight', emptySpace(state, 'outpost'))
        })
        pickCard(without.session, 'conquer')
        expect(without.session.turnPanel?.modes.map(({ label }) => label)).not.toContain(
            'Starve the People'
        )
        without.host.close()

        const withNoble = await table(cards, (state, { seat, other }) => {
            const spaceId = emptySpace(state, 'outpost')
            addPawn(state, seat, 'noble', spaceId)
            placeMarker(state, seat, spaceId)
            placeMarker(state, other, spaceId)
            state.recomputeRanks()
        })
        pickCard(withNoble.session, 'conquer')
        expect(withNoble.session.turnPanel?.modes.map(({ label }) => label)).toContain(
            'Starve the People'
        )
    })

    it('a dimmed mode has no press and carries the engine line', async () => {
        const { session } = await table(['harvest', 'tax'])
        pickCard(session, 'harvest')
        expect(session.turnPanel).toMatchObject({
            forfeitOnly: true,
            modes: [],
            refusals: ['No farm under 10 goods.']
        })
        expect(session.turn.mode).toBeUndefined()
    })

    it('Move and the guild functions hand off: the mode is open, no stage here', async () => {
        const { session } = await table(['move', 'guild'])
        pickCard(session, 'move')
        expect(session.turn.mode).toBe(ActionType.Move)
        expect(session.turn.flow?.handedOff).toBe(ActionType.Move)
        expect(session.turn.flow?.play).toBeUndefined()
        expect(session.turnPanel?.primary).toBeUndefined()
        expect(session.turn.cardInput).toEqual({})
    })
})

describe('R-3.8 Influence', () => {
    async function merchantUnderLoneMarker() {
        let spaceId: SpaceId = 'space.desert.1'
        const turn = await table(['influence', 'tax'], (state, { seat, other }) => {
            spaceId = emptySpace(state, 'outpost')
            addPawn(state, seat, 'merchant', spaceId)
            placeMarker(state, other, spaceId)
            state.recomputeRanks()
        })
        return { ...turn, spaceId }
    }

    it('S10 Money is Influence: the space lights, the press names it; Undo: space, card', async () => {
        const { session, spaceId } = await merchantUnderLoneMarker()
        const target = spaceTarget(spaceId)
        pickCard(session, 'influence')
        expect(chipOf(session.boardOffer, target)).toEqual({
            kind: 'cost',
            label: 'Money is Influence · 1s',
            tone: 'rose'
        })
        expect(session.turnPanel?.primary).toEqual({ label: 'Influence', enabled: true })

        await pressTarget(session, target)
        expect(roleOf(session.boardOffer, target)).toBe('picked')
        expect(session.turnPanel?.primary?.label).toBe(
            `Influence · Money is Influence at ${spaceLabel(spaceId)}`
        )

        await session.undo()
        expect(session.turn.value('money')).toBeUndefined()
        expect(session.turn.card).toBe('influence')
        await session.undo()
        expect(session.turn.card).toBeUndefined()
        expect(host?.sent.size).toBe(0)
    })

    it('S10 the primary sends what is picked', async () => {
        const turn = await merchantUnderLoneMarker()
        const { session, spaceId } = turn
        pickCard(session, 'influence')
        await pressTarget(session, spaceTarget(spaceId))
        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({
            type: ActionType.Influence,
            moneyIsInfluence: spaceId
        })
    })

    async function markersShort() {
        let spaces: SpaceId[] = []
        const turn = await table(['influence', 'tax'], (state, { seat }) => {
            spaces = emptySpaces(state, 'outpost').slice(0, 2)
            for (const spaceId of spaces) {
                addPawn(state, seat, 'farmer', spaceId)
            }
            spendMarkers(state, seat, 1, spaces)
        })
        return { ...turn, spaces }
    }

    it('R-1.1 markers short: "Place n of m", stacked, enabled at the exact count', async () => {
        const turn = await markersShort()
        const { session, spaces } = turn
        pickCard(session, 'influence')
        expect(session.turn.flow?.line).toBe('Place 0 of 1')
        expect(session.turnPanel?.primary).toEqual({ label: 'Influence', enabled: false })

        await pressTarget(session, spaceTarget(spaces[0]))
        expect(session.turn.flow?.line).toBe('Place 1 of 1')
        expect(session.turnPanel?.primary?.enabled).toBe(true)

        await pressTarget(session, spaceTarget(spaces[1]))
        expect(session.turn.value('spaces')).toEqual([spaces[0]])

        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({ type: ActionType.Influence, spaceIds: [spaces[0]] })
    })

    it('R-3.8 with no choice open, the one press is the primary', async () => {
        const turn = await table(['influence', 'tax'])
        pickCard(turn.session, 'influence')
        await turn.session.sendTurnCard()
        await turn.session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({ type: ActionType.Influence })
    })
})

describe('R-3.6 Migrate', () => {
    async function atMigrate(extra?: (state: HydratedFeudumGameState, seat: string) => void) {
        const turn = await table(['migrate', 'tax'], (state, { seat }) => {
            giveGood(state, seat, 'food')
            extra?.(state, seat)
            state.recomputeRanks()
        })
        pickCard(turn.session, 'migrate')
        return turn
    }

    it('S13 onto the board: pawn, space with its food, character; Undo takes it back', async () => {
        const turn = await atMigrate()
        const { session, seat } = turn
        const [pawnRow] = session.turn.flow?.rows ?? []
        await session.pressTurnChoice(pawnRow)
        flushSync()
        const [{ target, notes }] = session.turn.flow?.picks ?? []
        expect(notes).toEqual([{ kind: 'cost', label: '1 food' }])

        const spaceId = session.turn.flow?.picks[0].target.replace('space:', '')
        await pressTarget(session, target)
        const choices = session.turn.flow?.popup?.choices ?? []
        expect(choices.map(({ label }) => label)).toContain('Monk')
        expect(row(choices, 'Monk').note?.kind).toBe('role')

        // The popup holds the board: a press outside does nothing.
        await pressTarget(session, target)
        expect(session.turn.value('space')).toBeDefined()

        await pressPopup(session, 'Monk')
        expect(sentBy(turn)).toMatchObject({
            type: ActionType.Migrate,
            onto: { character: 'monk', spaceId }
        })
        expect(session.turn.hasManual).toBe(false)
        const before = turn.host.actions.length
        expect(session.undoableAction).toBeDefined()
        await session.undo()
        await settled(session)
        expect(turn.host.actions.length).toBeLessThan(before)
        expect(session.gameState.getPlayerState(seat).played).toEqual([])
    })

    it('S13 R-3.6.2 Distant Kin lights every starting space, with its chip', async () => {
        const turn = await atMigrate((state, seat) => {
            state.getPlayerState(seat).pawns[0].character = 'alchemist'
        })
        const { session } = turn
        await session.pressTurnChoice(firstRow(session))
        flushSync()
        await pressRow(session, 'Distant Kin')
        const picks = session.turn.flow?.picks ?? []
        expect(picks.length).toBe(6)
        expect(picks.every(({ notes }) => notes?.[0].label === 'Distant Kin')).toBe(true)

        await pressTarget(session, picks[0].target)
        await pressPopup(session, 'Farmer')
        expect(sentBy(turn)).toMatchObject({ type: ActionType.Migrate, distantKin: true })
    })

    it('S14 off the board: a press on a map pawn with "off" sends', async () => {
        const turn = await atMigrate()
        const { session, seat } = turn
        const target = pawnTarget(seat, 1)
        expect(chipLabels(session, target)).toEqual(['off'])
        await pressTarget(session, target)
        expect(sentBy(turn)).toMatchObject({ type: ActionType.Migrate, pawn: 1, onto: 'off' })
    })
})

describe('S48 R-4.4-H1 a payment short of a good: the tile cover', () => {
    async function shortOfFood(tiles: number) {
        let held: string[] = []
        const turn = await table(['migrate', 'tax'], (state, { seat }) => {
            returnGoods(state, seat)
            held = Array.from({ length: tiles }, () => giveTile(state, seat))
        })
        const { session } = turn
        pickCard(session, 'migrate')
        if (tiles > 0) {
            await session.pressTurnChoice(firstRow(session))
            flushSync()
            await pressTarget(session, firstPick(session))
            await pressPopup(session, 'Monk')
        }
        return { ...turn, held }
    }

    it('with two tiles: the primary asks, a tile enables it, Undo pops the tile first', async () => {
        const turn = await shortOfFood(2)
        const { session, held } = turn
        expect(host?.sent.size).toBe(0)
        expect(session.turnPanel?.primary).toEqual({ label: 'Cover with a tile', enabled: false })

        await pressRow(session, new RegExp(`^Tile ${held[0]}`))
        expect(session.turnPanel?.primary?.enabled).toBe(true)
        expect(host?.sent.size).toBe(0)
        expect(row(session.turn.flow?.rows, new RegExp(`^Tile ${held[1]}`)).refusal).toBeDefined()

        await session.undo()
        expect(session.turn.value('cover')).toBeUndefined()
        expect(session.turn.value('character')).toBe('monk')

        await pressRow(session, new RegExp(`^Tile ${held[1]}`))
        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({
            type: ActionType.Migrate,
            wildTiles: [{ tileId: held[1], good: 'food' }]
        })
    })

    it('a lone tile is auto-selected and waits for the primary', async () => {
        const turn = await shortOfFood(1)
        const { session, held } = turn
        expect(session.turn.entry('cover')).toEqual({ value: [held[0]], source: 'auto' })
        expect(session.turnPanel?.primary).toEqual({ label: 'Cover with a tile', enabled: true })
        expect(host?.sent.size).toBe(0)
    })

    it('without a tile, a pawn in supply is dimmed with its reason; its pawn on the map may still go off', async () => {
        const turn = await shortOfFood(0)
        const { session, seat } = turn
        const rows = session.turn.flow?.rows ?? []
        expect(rows.length).toBeGreaterThan(0)
        for (const held of rows) {
            expect(held.refusal).toBe('Migrating onto the board needs 1 food.')
            expect(held.press).toBeUndefined()
        }
        expect(session.turn.flow?.picks.map(({ target }) => target)).toEqual([pawnTarget(seat, 1)])
    })

    it('without a tile or a pawn on the map, the mode closes with its reason and leaves the Forfeit', async () => {
        const turn = await table(['migrate', 'tax'], (state, { seat }) => {
            returnGoods(state, seat)
            for (const pawn of state.getPlayerState(seat).pawns) {
                delete pawn.character
                delete pawn.spaceId
            }
        })
        const { session } = turn
        pickCard(session, 'migrate')
        expect(session.turnPanel?.forfeitOnly).toBe(true)
        expect(session.turnPanel?.refusals).toEqual(['Migrating onto the board needs 1 food.'])
    })
})

describe('R-3.9 Improve', () => {
    async function ruling(kind: 'town' | 'outpost', extra?: Parameters<typeof table>[1]) {
        let spaceId: SpaceId = 'space.desert.1'
        const turn = await table(['improve', 'tax'], (state, context) => {
            spaceId = emptySpace(state, kind)
            placeMarker(state, context.seat, spaceId)
            state.recomputeRanks()
            extra?.(state, context)
        })
        return { ...turn, spaceId }
    }

    it('S15 to a feudum: chip, guild popup; the tile it takes reveals, so it asks to confirm', async () => {
        const turn = await ruling('town', (state, { seat }) => {
            giveSeal(state, seat)
        })
        const { session, spaceId } = turn
        pickCard(session, 'improve')
        const target = spaceTarget(spaceId)
        expect(chipLabels(session, target)[0]).toBe('→ feudum · 1 seal')
        expect(chipOf(session.boardOffer, target)?.tone).toBe('rose')

        await pressTarget(session, target)
        expect(session.turn.flow?.popup?.anchor).toBe(target)
        await pressPopup(session, 'Monk')
        expect(host?.sent.size).toBe(0)
        expect(session.turnPanel?.primary).toEqual({
            label: `Improve ${spaceLabel(spaceId)} to a feudum · can't be undone`,
            enabled: true
        })

        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({
            type: ActionType.Improve,
            spaceId,
            feudumGuild: 'monk'
        })
        expect(session.undoableAction).toBeUndefined()
    })

    it('S16 epoch I, the top tile later: the panel says so first, no stack, the press sends', async () => {
        const turn = await ruling('town', (state, { seat }) => {
            giveSeal(state, seat)
            for (const stack of Object.values(state.regionStacks)) {
                stack.reverse()
            }
        })
        const { session, spaceId } = turn
        pickCard(session, 'improve')
        const line = /^The .* tile is not yet legal: no earlier tile to take$/
        expect(session.turn.flow?.line).toMatch(line)
        expect(chipLabels(session, spaceTarget(spaceId))).toContain('no tile')

        await pressTarget(session, spaceTarget(spaceId))
        expect(session.turn.flow?.line).toMatch(line)
        expect(session.turn.flow?.picks.some(({ target }) => target.startsWith('stack:'))).toBe(
            false
        )
        await pressPopup(session, 'Monk')
        expect(sentBy(turn)).toMatchObject({ type: ActionType.Improve, spaceId })
        expect(session.undoableAction).toBeDefined()
    })

    it('S16 epoch III, the top tile IV: stacks with an earlier tile light with "no vp"; the tile reveals, so it asks', async () => {
        const turn = await ruling('town', (state, { seat }) => {
            giveSeal(state, seat)
            state.epoch = 3
            reverseHomeStack(state, seat)
        })
        const { session, spaceId } = turn
        pickCard(session, 'improve')
        await pressTarget(session, spaceTarget(spaceId))
        await pressPopup(session, 'Monk')
        expect(session.turn.flow?.line).toMatch(
            /^The .* tile is not yet legal: take an earlier tile$/
        )
        const [stackPick] = session.turn.flow?.picks ?? []
        expect(stackPick.target.startsWith('stack:')).toBe(true)
        expect(stackPick.notes?.[0].label).toBe('no vp')
        expect(session.turnPanel?.primary).toBeUndefined()

        await pressTarget(session, stackPick.target)
        expect(host?.sent.size).toBe(0)
        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({
            type: ActionType.Improve,
            fallbackRegion: stackPick.target.replace('stack:', '')
        })
        expect(session.undoableAction).toBeUndefined()
    })

    it('R-3.9.1 reselecting the space clears the guild it opened', async () => {
        const { session, spaceId } = await ruling('town', (state, { seat }) => {
            giveSeal(state, seat)
            state.epoch = 3
            reverseHomeStack(state, seat)
        })
        pickCard(session, 'improve')
        await pressTarget(session, spaceTarget(spaceId))
        await pressPopup(session, 'Monk')
        expect(session.turn.value('guild')).toBe('monk')
        await session.undo()
        expect(session.turn.value('guild')).toBeUndefined()
        expect(session.turn.value('space')).toBe(spaceId)
    })

    it('R-4.3-H3 short of a good a tile could bring: dimmed, saying to spend it first', async () => {
        const turn = await ruling('outpost', (state, { seat }) => {
            returnGoods(state, seat)
            giveTile(state, seat)
        })
        pickCard(turn.session, 'improve')
        expect(turn.session.turnPanel?.refusals[0]).toMatch(/Undo, then spend a region tile\.$/)
        expect(turn.session.turnPanel?.modes).toEqual([])
    })
})

describe('R-3.9.3 TendLandscape', () => {
    async function asSerf(tiles: number) {
        let spaceId: SpaceId = 'space.desert.1'
        let held: string[] = []
        const turn = await table(['improve', 'tax'], (state, { seat, other }) => {
            spaceId = emptySpace(state, 'outpost')
            placeMarker(state, other, spaceId)
            placeMarker(state, seat, spaceId)
            state.recomputeRanks()
            giveGood(state, seat, 'wood')
            held = Array.from({ length: tiles }, () => giveTile(state, seat))
        })
        return { ...turn, spaceId, held }
    }

    it('S17 the tile, the serf space, then the popup: its press sends', async () => {
        const turn = await asSerf(2)
        const { session, spaceId, held } = turn
        pickCard(session, 'improve')
        expect(session.turn.mode).toBe(ActionType.TendLandscape)
        await session.pressTurnChoice(rowAt(session, 1))
        flushSync()
        expect(session.turn.flow?.picks.map(({ target }) => target)).toContain(spaceTarget(spaceId))
        await pressTarget(session, spaceTarget(spaceId))
        expect(session.turn.flow?.popup?.choices[0].label).toMatch(
            /^Collect \d+ .* · 1 to the ruler$/
        )
        await session.pressTurnChoice(firstPopup(session))
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({
            type: ActionType.TendLandscape,
            tileId: held[1],
            spaceId,
            collect: true
        })
    })

    it('a lone tile is auto, so the last press stages for the primary', async () => {
        const turn = await asSerf(1)
        const { session, spaceId, held } = turn
        pickCard(session, 'improve')
        expect(session.turn.entry('tile')).toEqual({ value: held[0], source: 'auto' })
        await pressTarget(session, spaceTarget(spaceId))
        await pressPopup(session, 'Leave it')
        expect(host?.sent.size).toBe(0)
        expect(session.turnPanel?.primary?.label).toBe(`Tend Landscape at ${spaceLabel(spaceId)}`)
    })

    it('R-4.3-H3 short of the wood, the special shows dimmed, saying to spend a tile', async () => {
        const turn = await table(['improve', 'tax'], (state, { seat }) => {
            const spaceId = emptySpace(state, 'town')
            placeMarker(state, seat, spaceId)
            state.recomputeRanks()
            giveSeal(state, seat)
            returnGoods(state, seat)
            giveTile(state, seat)
        })
        pickCard(turn.session, 'improve')
        const tend = row(turn.session.turnPanel?.modes, /· 1 wood$/)
        expect(tend.refusal).toMatch(/Undo, then spend a region tile\.$/)
        expect(tend.press).toBeUndefined()
    })
})

describe('R-3.10 Explore, R-3.12 Tax, R-3.14.1 Defend: one press', () => {
    it('S18 the primary names the draw and warns; no Undo after', async () => {
        const turn = await table(['explore', 'tax'], (state, { seat }) => {
            placeMarker(state, seat, emptySpace(state, 'outpost'))
            buildFeudum(state, seat, emptySpace(state, 'farm'))
            state.recomputeRanks()
        })
        const { session, seat } = turn
        const { drawCount } = exploreOffer(session.gameState, seat) ?? { drawCount: 0 }
        expect(drawCount).toBe(3)
        pickCard(session, 'explore')
        expect(session.turnPanel?.primary).toEqual({
            label: "Explore: draw 3 writs · can't be undone",
            enabled: true
        })
        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({ type: ActionType.Explore, revealsInfo: true })
        expect(session.gameState.machineState).toBe(MachineState.KeepingWrits)
        expect(session.undoableAction).toBeUndefined()
    })

    it('S22 Tax with Reinforcements: the button says it, one press sends, Undo is offered', async () => {
        const turn = await table(['tax', 'guild'], (state, { seat }) => {
            state.getPlayerState(seat).pawns[0].character = 'knight'
            ruleTown(state, seat)
        })
        const { session, seat } = turn
        const { shillings } = taxPreview(session.gameState, seat)
        const label = `Tax · +${shillings}s · Reinforcements +1 marker`
        pickCard(session, 'tax')
        expect(session.turnPanel?.primary).toEqual({ label, enabled: true })
        expect(row(session.turnPanel?.modes, label).picked).toBe(true)
        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({ type: ActionType.Tax })
        expect(session.undoableAction).toBeDefined()
    })

    it('S24 Defend in turn: one press sends', async () => {
        const turn = await table(['defend', 'tax'])
        const { session, seat } = turn
        pickCard(session, 'defend')
        expect(session.turnPanel?.primary).toEqual({ label: 'Play Defend · +1 vp', enabled: true })
        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({ type: ActionType.PlayDefend })
        expect(session.gameState.getPlayerState(seat).played[0]).toMatchObject({ kind: 'defend' })
    })
})

describe('R-3.11 Harvest', () => {
    async function ruledFarm(extra?: Parameters<typeof table>[1]) {
        let spaceId: SpaceId = 'space.desert.1'
        const turn = await table(['harvest', 'tax'], (state, context) => {
            spaceId = emptySpace(state, 'farm')
            placeMarker(state, context.seat, spaceId)
            state.recomputeRanks()
            extra?.(state, context)
        })
        return { ...turn, spaceId }
    }

    it('S20 favours: the popup warns of the beads, the choice stages, the primary warns', async () => {
        const turn = await ruledFarm((state, { seat }) => {
            giveBead(state, seat)
            giveBead(state, seat)
        })
        const { session, spaceId } = turn
        pickCard(session, 'harvest')
        expect(chipLabels(session, spaceTarget(spaceId))[0]).toMatch(/^\d+ goods$/)
        await pressTarget(session, spaceTarget(spaceId))
        const favours = row(session.turn.flow?.popup?.choices, /^Favours: \d+ here, \d+ to you$/)
        expect(favours.note).toEqual({ kind: 'cost', label: 'your 2 beads turn to seals' })
        await pressPopup(session, /^Favours/)
        expect(host?.sent.size).toBe(0)
        expect(session.turnPanel?.primary).toEqual({
            label: `Favours at ${spaceLabel(spaceId)} · can't be undone`,
            enabled: true
        })
        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({ type: ActionType.Harvest, mode: 'favours', spaceId })
        expect(session.undoableAction).toBeUndefined()
    })

    it('S21 with a Farmer pawn: Inspect stages and sends; no Undo of the Harvest', async () => {
        const turn = await ruledFarm((state, { seat }) => {
            state.getPlayerState(seat).pawns[0].character = 'farmer'
            state.recomputeRanks()
        })
        const { session, spaceId } = turn
        pickCard(session, 'harvest')
        await pressTarget(session, spaceTarget(spaceId))
        await pressPopup(session, 'Inspect the harvest')
        expect(session.turnPanel?.primary?.label).toBe(
            `Inspect the harvest at ${spaceLabel(spaceId)} · can't be undone`
        )
        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({ type: ActionType.Harvest, mode: 'inspect' })
        expect(session.undoableAction).toBeUndefined()
    })

    it('S20 a plain harvest names the farm and its total', async () => {
        const turn = await ruledFarm()
        const { session, spaceId } = turn
        pickCard(session, 'harvest')
        await pressTarget(session, spaceTarget(spaceId))
        await pressPopup(session, /^Harvest \d+$/)
        expect(session.turnPanel?.primary?.label).toMatch(
            new RegExp(`^Harvest \\d+ at ${spaceLabel(spaceId)} · can't be undone$`)
        )
    })
})

describe('R-3.13 Conquer and Starve', () => {
    async function facing(otherCards: ActionCardKind[], played = false) {
        let spaceId: SpaceId = 'space.desert.1'
        const turn = await table(
            ['conquer', 'tax', 'move'],
            (state, { seat, other }) => {
                spaceId = emptySpace(state, 'outpost')
                addPawn(state, seat, 'knight', spaceId)
                addPawn(state, other, 'knight', spaceId)
                state.recomputeRanks()
                if (played) {
                    state.getPlayerState(other).played.push({ kind: 'defend', use: 'regular' })
                }
            },
            { otherCards }
        )
        return { ...turn, spaceId }
    }

    function otherPawn(turn: TurnTable, spaceId: SpaceId): BoardTarget {
        const n = arranged(
            turn.host,
            (state) =>
                state.getPlayerState(turn.other).pawns.find(({ spaceId: on }) => on === spaceId)?.n
        )
        if (!n) {
            throw new Error('The other seat has a pawn there')
        }
        return pawnTarget(turn.other, n)
    }

    it('S32 asks: the chip, the tally, the ask named from the preview; no Undo after', async () => {
        const turn = await facing(['tax', 'guild'])
        const { session, spaceId, other } = turn
        const target = otherPawn(turn, spaceId)
        const name = session.getPlayerName(other)
        pickCard(session, 'conquer')
        expect(chipLabels(session, target)[0]).toMatch(/^\d+ vs \d+$/)
        expect(chipOf(session.boardOffer, target)?.tone).toBe('rose')
        await pressTarget(session, target)
        expect(host?.sent.size).toBe(0)
        expect(session.turn.flow?.tally?.find(({ source }) => source === 'total')).toBeDefined()
        expect(session.turn.flow?.tallyNote).toBe('Defence may rise by 1 if they answer')
        expect(session.turnPanel?.primary).toEqual({
            label: `Conquer ${name}'s knight · ${name} may answer · can't be undone`,
            enabled: true
        })
        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({
            type: ActionType.Conquer,
            spaceId,
            target: { kind: 'pawn', playerId: other }
        })
        expect(session.undoableAction).toBeUndefined()
    })

    it('S35 no ask: the press sends, with no warning, and Undo is offered', async () => {
        const turn = await facing(['tax', 'guild'], true)
        const { session, spaceId } = turn
        pickCard(session, 'conquer')
        await pressTarget(session, otherPawn(turn, spaceId))
        expect(sentBy(turn)).toMatchObject({ type: ActionType.Conquer, spaceId })
        expect(session.gameState.machineState).toBe(MachineState.CommittingAttack)
        expect(session.undoableAction).toBeDefined()
    })

    async function starving(otherCards: ActionCardKind[], played = false) {
        let spaceId: SpaceId = 'space.desert.1'
        const turn = await table(
            ['conquer', 'tax', 'move'],
            (state, { seat, other }) => {
                spaceId = emptySpace(state, 'outpost')
                addPawn(state, seat, 'noble', spaceId)
                placeMarker(state, seat, spaceId)
                placeMarker(state, other, spaceId)
                state.recomputeRanks()
                returnGoods(state, other)
                giveGood(state, other, 'food')
                if (played) {
                    state.getPlayerState(other).played.push({ kind: 'defend', use: 'regular' })
                }
            },
            { otherCards }
        )
        return { ...turn, spaceId }
    }

    it('S38 starve that asks: "starve" in rose, then the ask; no Undo after', async () => {
        const turn = await starving(['defend', 'tax'])
        const { session, spaceId, other } = turn
        const target = markerTarget(spaceId, other, 'serf')
        const name = session.getPlayerName(other)
        pickCard(session, 'conquer')
        await pressMode(session, 'Starve the People')
        expect(chipLabels(session, target)).toEqual(['starve'])
        await pressTarget(session, target)
        expect(host?.sent.size).toBe(0)
        expect(session.turnPanel?.primary?.label).toBe(
            `Starve ${name}'s serf · ${name} may answer · can't be undone`
        )
        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({
            type: ActionType.StarveThePeople,
            spaceId,
            targetPlayerId: other,
            role: 'serf'
        })
        expect(session.undoableAction).toBeUndefined()
    })

    it('R-3.14-H1 a starve that cannot be answered: the press sends', async () => {
        const turn = await starving(['tax', 'guild'], true)
        const { session, spaceId, other } = turn
        const target = markerTarget(spaceId, other, 'serf')
        pickCard(session, 'conquer')
        await pressMode(session, 'Starve the People')
        await pressTarget(session, target)
        expect(sentBy(turn)).toMatchObject({ type: ActionType.StarveThePeople })
    })
})

describe('R-3.15 Repeat and Déjà Vu', () => {
    async function afterMoveAndExplore(extra?: Parameters<typeof table>[1]) {
        return table(['repeat', 'tax'], (state, context) => {
            state
                .getPlayerState(context.seat)
                .played.push(
                    { kind: 'move', use: 'regular' },
                    { kind: 'explore', use: 'regular' },
                    { kind: 'conquer', use: 'forfeited' }
                )
            ruleOutpost(state, context.seat)
            extra?.(state, context)
        })
    }

    it('S23 x2 lights, Déjà Vu with its saltpeter; Conquer never', async () => {
        const { session } = await afterMoveAndExplore()
        pickCard(session, 'repeat')
        const replays = session.turnPanel?.replays ?? []
        expect(replays.map(({ label }) => label).sort()).toEqual(['Explore', 'Move'])
        expect(row(replays, 'Move').note).toBeUndefined()
        expect(row(replays, 'Explore').note).toEqual({
            kind: 'cost',
            label: 'Déjà Vu · 1 saltpeter'
        })
    })

    it('S23 picking a replay opens that card, and its Action carries the repeat', async () => {
        const turn = await afterMoveAndExplore()
        const { session } = turn
        pickCard(session, 'repeat')
        await session.pressTurnChoice(row(session.turnPanel?.replays, 'Move'))
        flushSync()
        expect(session.turn.mode).toBe(ActionType.Move)
        expect(session.turn.cardInput).toEqual({ asRepeat: 'repeat' })

        await session.undo()
        await session.pressTurnChoice(row(session.turnPanel?.replays, 'Explore'))
        flushSync()
        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({ type: ActionType.Explore, asRepeat: 'deja-vu' })
    })

    it('R-4.3-H3 no saltpeter and a tile: Déjà Vu says to spend it first', async () => {
        const { session } = await afterMoveAndExplore((state, { seat }) => {
            returnGoods(state, seat)
            giveTile(state, seat)
        })
        pickCard(session, 'repeat')
        expect(row(session.turnPanel?.replays, 'Explore').refusal).toMatch(
            /Undo, then spend a region tile\.$/
        )
    })

    it('R-3.15 nothing to replay: Forfeit only, sent as the Repeat itself', async () => {
        const turn = await table(['repeat', 'tax'])
        const { session } = turn
        pickCard(session, 'repeat')
        expect(session.turnPanel?.forfeitOnly).toBe(true)
        await session.forfeitTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(sentBy(turn)).toMatchObject({ type: ActionType.ForfeitCard, kind: 'repeat' })
    })

    it('a lone replay is auto, and Undo takes the card with it', async () => {
        const { session } = await table(['repeat', 'tax'], (state, { seat }) => {
            state.getPlayerState(seat).played.push({ kind: 'move', use: 'regular' })
        })
        pickCard(session, 'repeat')
        expect(session.turn.entry('replay')).toEqual({ value: 'move', source: 'auto' })
        await session.undo()
        expect(session.turn.card).toBeUndefined()
    })
})

/** Each flow, from its card to a state holding at least two stages past the card, unsent. */
interface FlowCase {
    readonly name: string
    readonly card: ActionCardKind
    readonly arrange: (state: HydratedFeudumGameState, turn: TurnTable) => void
    readonly reach: (session: FeudumGameSession) => Promise<void>
    readonly stages: readonly (keyof TurnDraftValues)[]
}

const FlowCases: readonly FlowCase[] = [
    {
        name: 'Migrate (R-3.6)',
        card: 'migrate',
        arrange: (state, { seat }) => {
            giveGood(state, seat, 'food')
        },
        reach: async (session) => {
            await session.pressTurnChoice(firstRow(session))
            await session.pressTurnTarget(firstPick(session))
        },
        stages: ['pawn', 'space']
    },
    {
        name: 'Improve (R-3.9)',
        card: 'improve',
        arrange: (state, { seat }) => {
            placeMarker(state, seat, emptySpace(state, 'town'))
            state.recomputeRanks()
            giveSeal(state, seat)
        },
        reach: async (session) => {
            await session.pressTurnTarget(firstPick(session))
            await session.pressTurnChoice(firstPopup(session))
        },
        stages: ['space', 'guild']
    },
    {
        name: 'TendLandscape (R-3.9.3)',
        card: 'improve',
        arrange: (state, { seat, other }) => {
            const spaceId = emptySpace(state, 'outpost')
            placeMarker(state, other, spaceId)
            placeMarker(state, seat, spaceId)
            state.recomputeRanks()
            giveGood(state, seat, 'wood')
            giveTile(state, seat)
            giveTile(state, seat)
        },
        reach: async (session) => {
            await session.pressTurnChoice(firstRow(session))
            await session.pressTurnTarget(firstPick(session))
        },
        stages: ['tile', 'space']
    },
    {
        name: 'Harvest (R-3.11)',
        card: 'harvest',
        arrange: (state, { seat }) => {
            placeMarker(state, seat, emptySpace(state, 'farm'))
            state.recomputeRanks()
        },
        reach: async (session) => {
            await session.pressTurnTarget(firstPick(session))
            await session.pressTurnChoice(firstPopup(session))
        },
        stages: ['space', 'harvest']
    },
    {
        name: 'Conquer (R-3.13)',
        card: 'conquer',
        arrange: (state, { seat, other }) => {
            const spaceId = emptySpace(state, 'outpost')
            addPawn(state, seat, 'knight', spaceId)
            addPawn(state, other, 'knight', spaceId)
            state.recomputeRanks()
        },
        reach: async (session) => {
            await session.pressTurnTarget(firstPick(session))
        },
        stages: ['target']
    },
    {
        name: 'Influence (R-3.8.3)',
        card: 'influence',
        arrange: (state, { seat, other }) => {
            const spaceId = emptySpace(state, 'outpost')
            addPawn(state, seat, 'merchant', spaceId)
            placeMarker(state, other, spaceId)
            state.recomputeRanks()
        },
        reach: async (session) => {
            await session.pressTurnTarget(firstPick(session))
        },
        stages: ['money']
    },
    {
        name: 'StarveThePeople (R-3.13.2)',
        card: 'conquer',
        arrange: (state, { seat, other }) => {
            const spaceId = emptySpace(state, 'outpost')
            addPawn(state, seat, 'noble', spaceId)
            placeMarker(state, seat, spaceId)
            placeMarker(state, other, spaceId)
            state.recomputeRanks()
        },
        reach: async (session) => {
            await pressMode(session, 'Starve the People')
            await session.pressTurnTarget(firstPick(session))
        },
        stages: ['mode', 'target']
    },
    {
        name: 'Repeat (R-3.15)',
        card: 'repeat',
        arrange: (state, { seat }) => {
            state
                .getPlayerState(seat)
                .played.push({ kind: 'move', use: 'regular' }, { kind: 'explore', use: 'regular' })
            ruleOutpost(state, seat)
        },
        reach: async (session) => {
            await session.pressTurnChoice(row(session.turnPanel?.replays, 'Explore'))
        },
        stages: ['replay']
    },
    {
        name: 'Tax (R-3.12)',
        card: 'tax',
        arrange: (state, { seat }) => {
            ruleTown(state, seat)
        },
        reach: () => Promise.resolve(),
        stages: []
    },
    {
        name: 'Explore (R-3.10)',
        card: 'explore',
        arrange: (state, { seat }) => {
            ruleOutpost(state, seat)
        },
        reach: () => Promise.resolve(),
        stages: []
    },
    {
        name: 'PlayDefend (R-3.14.1)',
        card: 'defend',
        arrange: () => undefined,
        reach: () => Promise.resolve(),
        stages: []
    }
]

describe.each(FlowCases)('TurnDraft minimum tests: $name', ({ card, arrange, reach, stages }) => {
    async function reached() {
        const turn = await table([card, 'guild', 'move'], (state, context) => {
            arrange(state, context)
        })
        const { session } = turn
        pickCard(session, card)
        await reach(session)
        flushSync()
        for (const stage of stages) {
            expect(session.turn.value(stage)).toBeDefined()
        }
        expect(host?.sent.size).toBe(0)
        return turn
    }

    it('setting an earlier stage clears every later one', async () => {
        const { session } = await reached()
        pickCard(session, 'guild')
        expect(session.turn.card).toBe('guild')
        for (const stage of stages) {
            expect(session.turn.value(stage)).toBeUndefined()
        }
    })

    it('Undo with a manual stage pops the highest and takes no Action back', async () => {
        const turn = await reached()
        const { session } = turn
        const actions = turn.host.actions.length
        for (let press = stages.length - 1; press >= 0; press -= 1) {
            expect(session.hasLocalSelection).toBe(true)
            await session.undo()
            expect(session.turn.value(stages[press])).toBeUndefined()
            if (press > 0) {
                expect(session.turn.value(stages[press - 1])).toBeDefined()
            }
        }
        await session.undo()
        expect(session.turn.card).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
        expect(turn.host.actions.length).toBe(actions)
    })

    it('reselecting: the same card pressed again unpicks it and all it opened', async () => {
        const { session } = await reached()
        pickCard(session, card)
        expect(session.turn.card).toBeUndefined()
        for (const stage of stages) {
            expect(session.turn.value(stage)).toBeUndefined()
        }
    })
})

describe('TurnDraft minimum tests: the shared cases (R-X.2)', () => {
    it('Undo with only an auto stage falls through to the Action undo', async () => {
        const { session } = await table(['conquer'])
        expect(session.turn.entry('card')?.source).toBe('auto')
        expect(session.hasLocalSelection).toBe(false)
        expect(session.turn.localSelection.undo()).toBe(false)
    })

    it('Undo reaches the Action once the lone card is all that is left', async () => {
        const turn = await table(
            ['tax', 'conquer'],
            (state, { seat }) => {
                ruleTown(state, seat)
            },
            { pouchGood: 'sulfur' }
        )
        const { session, seat } = turn
        pickCard(session, 'tax')
        session.toggleTurnSecondCard()
        await session.sendTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(session.turn.entry('card')).toEqual({ value: 'conquer', source: 'auto' })
        expect(session.hasLocalSelection).toBe(false)

        await session.undo()
        await settled(session)
        expect(session.gameState.getPlayerState(seat).played).toEqual([])
        expect(session.turn.card).toBeUndefined()
    })

    it('R-3.11 a farm reselected drops the mode picked on the other', async () => {
        let farms: SpaceId[] = []
        const { session } = await table(['harvest', 'guild'], (state, { seat }) => {
            farms = emptySpaces(state, 'farm').slice(0, 2)
            for (const spaceId of farms) {
                placeMarker(state, seat, spaceId)
            }
            state.recomputeRanks()
        })
        pickCard(session, 'harvest')
        await pressTarget(session, spaceTarget(farms[0]))
        await pressPopup(session, /^Harvest \d+$/)
        expect(session.turn.value('harvest')).toBeDefined()
        await pressTarget(session, spaceTarget(farms[1]))
        expect(session.turn.value('space')).toBe(farms[1])
        expect(session.turn.value('harvest')).toBeUndefined()
        expect(session.turn.flow?.popup).toBeDefined()
    })

    it('R-3.8.3 a lit pick pressed again unpicks it', async () => {
        let spaceId: SpaceId = 'space.desert.1'
        const { session } = await table(['influence', 'guild'], (state, { seat, other }) => {
            spaceId = emptySpace(state, 'outpost')
            addPawn(state, seat, 'merchant', spaceId)
            placeMarker(state, other, spaceId)
            state.recomputeRanks()
        })
        pickCard(session, 'influence')
        await pressTarget(session, spaceTarget(spaceId))
        expect(session.turn.value('money')).toBe(spaceId)
        await pressTarget(session, spaceTarget(spaceId))
        expect(session.turn.value('money')).toBeUndefined()
    })

    it('a stage the order lacks throws', () => {
        const draft = new StagedDraft<TurnDraftValues>(
            TurnStageOrder.filter((stage) => stage !== 'cover')
        )
        expect(() => {
            draft.set('cover', [])
        }).toThrow(/does not exist in stage order/)
    })
})

describe('TurnDraft: stacked stages (R-1.1, R-4.4-H1)', () => {
    async function short() {
        let spaces: SpaceId[] = []
        const turn = await table(['influence', 'tax'], (state, { seat }) => {
            spaces = emptySpaces(state, 'outpost').slice(0, 2)
            for (const spaceId of spaces) {
                addPawn(state, seat, 'farmer', spaceId)
            }
            spendMarkers(state, seat, 2, spaces)
        })
        pickCard(turn.session, 'influence')
        return { ...turn, spaces }
    }

    it('Undo pops the latest press and keeps the earlier ones', async () => {
        const { session, spaces } = await short()
        await pressTarget(session, spaceTarget(spaces[0]))
        await pressTarget(session, spaceTarget(spaces[1]))
        await session.undo()
        expect(session.turn.value('spaces')).toEqual([spaces[0]])
        await session.undo()
        expect(session.turn.value('spaces')).toBeUndefined()
        expect(session.turn.card).toBe('influence')
    })

    it('a push clears every later stage, and Undo pops an open later stage first', async () => {
        const { session, spaces } = await short()
        session.turn.set('space', spaces[0])
        session.turn.set('money', spaces[0])
        await session.turn.stack('spaces', [spaces[1]])
        expect(session.turn.value('money')).toBeUndefined()
        session.turn.set('money', spaces[1])
        await session.undo()
        expect(session.turn.value('money')).toBeUndefined()
        expect(session.turn.value('spaces')).toEqual([spaces[1]])
    })

    it('the keep rule: it ends with the displayed state, on every transition kind', async () => {
        const turn = await table(['tax', 'guild'], (state, { seat }) => {
            ruleTown(state, seat)
            giveTile(state, seat)
            giveTile(state, seat)
        })
        const { host: tableHost, seat, session } = turn
        const tiles = () => session.gameState.getPlayerState(seat).regionTiles
        pickCard(session, 'tax')
        const spend = () => ({ type: ActionType.SpendRegionTile, tileId: tiles()[0], good: 'food' })

        tableHost.sendUnheard(seat, spend())
        await tableHost.reconcile(seat)
        expect(session.turn.card).toBeUndefined()

        pickCard(session, 'tax')
        await tableHost.send(seat, spend())
        await settled(session)
        expect(session.turn.card).toBeUndefined()

        pickCard(session, 'tax')
        await session.forfeitTurnCard()
        await session.waitForVisibleTransitionSettled()
        expect(session.turn.card).toBeUndefined()
    })
})

describe('TurnDraft: who has it (R-X.1; contract: Coexistence and precedence)', () => {
    it('another seat has no panel, no draft, and no outline of a private choice', async () => {
        const turn = await table(['harvest', 'tax'], (state, { seat }) => {
            placeMarker(state, seat, emptySpace(state, 'farm'))
            state.recomputeRanks()
        })
        const watching = await turn.host.openSeat(turn.other)
        expect(watching.turnPanel).toBeUndefined()
        watching.pressTurnCard('harvest')
        expect(watching.turn.hasManual).toBe(false)
        expect(watching.boardOffer.targets.size).toBe(0)
        expect(watching.boardOffer.dimsRest).toBe(false)
    })

    it('History View shows no choices, a press does nothing, and it does not come back', async () => {
        const turn = await table(['harvest', 'tax'], (state, { seat }) => {
            placeMarker(state, seat, emptySpace(state, 'farm'))
            state.recomputeRanks()
        })
        const { session } = turn
        pickCard(session, 'harvest')
        expect(session.boardOffer.dimsRest).toBe(true)

        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.turnPanel).toBeUndefined()
        expect(session.turn.selection).toEqual({})
        expect(session.boardOffer.dimsRest).toBe(false)
        session.pressTurnCard('harvest')
        await session.pressTurnTarget(stackTarget('desert'))
        await session.forfeitTurnCard()
        expect(host?.sent.size).toBe(0)

        session.history.goToEnd()
        await settled(session)
        expect(session.turn.card).toBeUndefined()
        expect(session.turnPanel?.cards.length).toBe(2)
    })

    it('a dimmed map element does nothing; a target the flow does not name, nothing', async () => {
        const { session } = await table(['harvest', 'tax'], (state, { seat }) => {
            placeMarker(state, seat, emptySpace(state, 'farm'))
            state.recomputeRanks()
        })
        pickCard(session, 'harvest')
        await session.pressTurnTarget(stackTarget('desert'))
        expect(session.turn.value('space')).toBeUndefined()
    })
})
