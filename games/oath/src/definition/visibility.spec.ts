import { describe, expect, it } from 'vitest'
import { ActionSource, GameStatus, GameStorage, Visibility, assert, getPrng, type Game, type GameAction } from '@tabletop/common'
import { buildAction } from '../testing/actions.js'
import { engine } from '../testing/engine.js'
import { OathRuntime } from './runtime.js'
import { OathApiActions } from './apiActions.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import { HydratedOathGameState, OathGameStateValidator, type OathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { Search, SearchSource } from '../actions/search.js'
import { isUseActionPower } from '../actions/useActionPower.js'
import { PeekTargetKind } from '../actions/peek.js'
import { required } from '../testing/required.js'
import { LetPeekSubjectKind } from '../actions/letPeek.js'
import { SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { testPlayer, testState, openTurn, testVaultWithRelics } from '../testing/fixture.js'
import { createOathVault } from '../model/vault.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { TOP_CRADLE_SLOT } from '../data/mapSlots.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { testGame } from '../testing/game.js'
import { FILLER } from '../testing/cards.js'
import { Color } from '@tabletop/common'

const MASTER_SEED = '0123456789abcdef0123456789abcdef'
const p1 = { kind: 'player', playerId: 'p1' } as const
const p2 = { kind: 'player', playerId: 'p2' } as const
const spectator = { kind: 'spectator' } as const

function buildGame(): Game {
    return testGame(['p1', 'p2', 'p3'], {
        status: GameStatus.WaitingToStart,
        hotseat: false,
        createdAt: new Date(0),
        storage: GameStorage.Remote
    })
}

function canonical(state: unknown): OathGameState {
    assert(OathGameStateValidator.Check(state), 'Expected complete canonical state')
    return state
}

function searchBoard() {
    const state = testState(
        [
            testPlayer({ playerId: 'p1', status: PlayerStatus.Chancellor, siteId: 'c1' }),
            testPlayer({ playerId: 'p2', siteId: 'c1' })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'p1',
            vault: createOathVault({ worldDeck: ['denizen.hearth.wayside-inn', 'denizen.nomad.tents', 'denizen.beast.wolves'] }, getPrng(1))
        }
    )
    openTurn(state, 'p1')
    return canonical(state.dehydrate())
}

const PILGRIMAGE = 'denizen.nomad.pilgrimage'
const DISPOSSESSED = ['denizen.arcane.tutor', 'denizen.hearth.storyteller', 'denizen.discord.scryer', 'denizen.order.scouts', 'denizen.beast.wolves', 'denizen.nomad.elders']

function pilgrimageBoard(atSite = ['denizen.hearth.wayside-inn']) {
    const state = testState(
        [
            testPlayer({ playerId: 'p1', status: PlayerStatus.Chancellor, siteId: 'c1', handIds: [PILGRIMAGE, FILLER] }),
            testPlayer({ playerId: 'p2', siteId: 'c1' })
        ],
        {
            machineState: MachineState.Searching,
            chancellorPlayerId: 'p1',
            denizensBySite: { c1: atSite },
            vault: { ...testVaultWithRelics({}), dispossessed: [...DISPOSSESSED] }
        }
    )
    openTurn(state, 'p1')
    return canonical(state.dehydrate())
}

const HEIRLOOM = 'denizen.hearth.family-heirloom'
const RELIC_BREAKER = 'denizen.hearth.relic-breaker'
const DOWSING_STICKS = 'relic.dowsing-sticks'
const CUP = 'relic.cup-of-plenty'
const TUTOR = 'denizen.arcane.tutor'
const INQUISITOR = 'denizen.arcane.inquisitor'
const IVORY_EYE = 'relic.ivory-eye'
const SKELETON_KEY = 'relic.skeleton-key'
const CONSPIRACY = 'vision.conspiracy'
const FALSE_PROPHET = 'denizen.discord.false-prophet'
const FAITH = 'vision.faith'
const WILD_CRY = 'denizen.beast.wild-cry'
const BIRDSONG = 'denizen.beast.birdsong'
const ORACULAR_PIG = 'relic.oracular-pig'

function relicBoard(machineState: MachineState, handIds: string[], advisers: { cardId: string; faceUp: boolean }[] = [], relicFacedown: Record<string, string> = {}) {
    const slots = Object.keys(relicFacedown)
    const state = testState(
        [
            testPlayer({ playerId: 'p1', status: PlayerStatus.Chancellor, siteId: 'c1', favor: 3, handIds, advisers }),
            testPlayer({ playerId: 'p2', siteId: 'c1' })
        ],
        {
            machineState,
            chancellorPlayerId: 'p1',
            relicsBySite: slots.length > 0 ? { c1: slots.map((slotId) => ({ slotId })) } : {},
            vault: createOathVault({ relicDeck: slots.length > 0 ? ['relic.map'] : [CUP], relicFacedown }, getPrng(1))
        }
    )
    openTurn(state, 'p1')
    return canonical(state.dehydrate())
}

function userAction(state: OathGameState, fields: { type: ActionType; playerId: string } & Record<string, unknown>): GameAction {
    return { id: `${fields.type}-${state.actionCount}`, gameId: 'game-1', source: ActionSource.User, index: state.actionCount, ...fields }
}

function playPilgrimage(state: OathGameState): GameAction {
    return buildAction(SearchResolve, {
        id: 'resolve-1',
        playerId: 'p1',
        keptCardId: PILGRIMAGE,
        discardOrder: [FILLER],
        play: SearchPlay.Adviser,
        faceUp: true,
        revealsInfo: true,
        index: state.actionCount
    })
}

function search(state: OathGameState): GameAction {
    return buildAction(Search, {
        id: 'search-1',
        playerId: 'p1',
        drawFrom: SearchSource.WorldDeck,
        revealsInfo: true,
        index: state.actionCount
    })
}

describe('Oath visibility', () => {
    it('registers a projector for every action type', () => {
        expect(Object.keys(OathApiActions).sort()).toEqual(Object.values(ActionType).sort())
    })

    it('starts a reproducible protected game whose vault and hands never reach a projection', () => {
        const game = buildGame()
        const { startedGame, initialState } = engine.startGame(game, { masterSeed: MASTER_SEED })
        expect(startedGame.protectedInformation).toBe(true)
        const state = canonical(initialState)
        expect(state.vault.worldDeck.length).toBeGreaterThan(0)
        expect(canonical(engine.startGame(buildGame(), { masterSeed: MASTER_SEED }).initialState).vault).toEqual(state.vault)

        for (const perspective of [p1, spectator]) {
            const view = OathRuntime.visibility.state.project(state, perspective)
            expect(view).not.toHaveProperty('vault')
            expect(view).not.toHaveProperty('masterSeed')
            expect(view.discardPileCounts).toEqual(state.discardPileCounts)
            expect(view.players.map((player) => player.handCount)).toEqual(state.players.map((player) => player.handCount))
        }

        // R-1.20 — hands are dealt at initialization, so each is hidden from the start.
        expect(state.players.map((player) => player.handCount)).toEqual([3, 3, 3])
        const own = OathRuntime.visibility.state.project(state, p1).players
        expect(own[0].handIds).toEqual(state.players[0].handIds)
        expect(own[1]).not.toHaveProperty('handIds')
        expect(OathRuntime.visibility.state.project(state, spectator).players[0]).not.toHaveProperty('handIds')
    })

    it('shows a drawn hand to its owner only, in state and in the action record', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = searchBoard()
        const result = engine.executeCanonicalAction({ action: search(before), state: before, game })
        const after = canonical(result.updatedState)
        const drawn = after.players[0].handIds
        expect(drawn).toHaveLength(3)

        expect(OathRuntime.visibility.state.project(after, p1).players[0].handIds).toEqual(drawn)
        expect(OathRuntime.visibility.state.project(after, p2).players[0]).not.toHaveProperty('handIds')
        expect(OathRuntime.visibility.state.project(after, spectator).players[0].handCount).toBe(3)

        const record = result.processedActions[0]
        expect(OathRuntime.visibility.actions.project(record, p1)).toHaveProperty('metadata.draw')
        expect(OathRuntime.visibility.actions.project(record, p2)).not.toHaveProperty('metadata.draw')
        expect(JSON.stringify(OathRuntime.visibility.actions.project(record, spectator))).not.toContain('wayside-inn')
    })

    it('refuses to draw from a projection and defers to the host', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const state = searchBoard()
        expect(() => engine.executeAction({ action: search(state), state, game, perspective: p1 })).toThrow(
            Visibility.UnavailableProjectedValueError
        )
    })

    it('keeps the Dispossessed from every client, and shows a Pilgrimage peek to the player who made it alone', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = pilgrimageBoard()
        for (const perspective of [p1, p2, spectator]) {
            const view = OathRuntime.visibility.state.project(before, perspective)
            expect(view).not.toHaveProperty('vault')
            expect(view).not.toHaveProperty('dispossessedIds')
            expect(JSON.stringify(view)).not.toContain(DISPOSSESSED[0])
        }

        const result = engine.executeCanonicalAction({ action: playPilgrimage(before), state: before, game })
        const after = canonical(result.updatedState)
        const drawn = after.vault.discardPiles.cradle
        expect(drawn).toHaveLength(1)
        expect(DISPOSSESSED).toContain(drawn[0])
        expect(after.vault.dispossessed).toHaveLength(DISPOSSESSED.length)
        expect(after.vault.dispossessed).toContain('denizen.hearth.wayside-inn')
        expect(after.discardPileCounts.cradle).toBe(1)

        const record = result.processedActions[0]
        const own = OathRuntime.visibility.actions.project(record, p1)
        expect(own).toHaveProperty('metadata.reveal', { kind: 'peek', cardIds: drawn })
        expect(own).toHaveProperty('metadata.peeked', drawn)
        expect(own).toHaveProperty('metadata.pileDeposits', [{ region: 'cradle', cardIds: drawn }])

        for (const perspective of [p2, spectator]) {
            const theirs = OathRuntime.visibility.actions.project(record, perspective)
            expect(theirs).not.toHaveProperty('metadata.reveal')
            expect(theirs).not.toHaveProperty('metadata.peeked')
            expect(theirs).toHaveProperty('metadata.pileDeposits', [{ region: 'cradle' }])
            expect(JSON.stringify(theirs)).not.toContain(drawn[0])
        }
        for (const perspective of [p1, p2, spectator]) {
            const view = OathRuntime.visibility.state.project(after, perspective)
            expect(view).not.toHaveProperty('vault')
            expect(JSON.stringify(view)).not.toContain(drawn[0])
        }
    })

    it('shows the cards a Pilgrimage player is to stack to that player alone, and the answer names none of them', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = pilgrimageBoard(['denizen.hearth.wayside-inn', 'denizen.nomad.tents'])
        const played = engine.executeCanonicalAction({ action: playPilgrimage(before), state: before, game })
        const asked = canonical(played.updatedState)
        const question = asked.pendingQuestions?.queue[0]
        expect(question).toMatchObject({ kind: PowerQuestionKind.OrderDrawnCards, askedPlayerId: 'p1' })
        const drawn = question?.kind === PowerQuestionKind.OrderDrawnCards ? question.cardIds : []
        expect(drawn).toHaveLength(2)
        expect(OathRuntime.visibility.state.project(asked, p1).pendingQuestions?.queue[0]).toHaveProperty('cardIds', drawn)
        for (const perspective of [p2, spectator]) {
            const view = OathRuntime.visibility.state.project(asked, perspective)
            expect(view.pendingQuestions?.queue[0]).not.toHaveProperty('cardIds')
            for (const id of drawn) expect(JSON.stringify(view)).not.toContain(id)
        }

        const answered = engine.executeCanonicalAction({ action: userAction(asked, { type: ActionType.AnswerQuestion, playerId: 'p1', answer: { kind: PowerQuestionKind.OrderDrawnCards, order: [1, 0] } }), state: asked, game })
        expect(canonical(answered.updatedState).vault.discardPiles.cradle).toEqual(drawn)
        const answer = answered.processedActions[0]
        expect(OathRuntime.visibility.actions.project(answer, p1)).toHaveProperty('metadata.pileDeposits', [{ region: 'cradle', cardIds: [drawn[1], drawn[0]] }])
        for (const perspective of [p2, spectator]) {
            const theirs = OathRuntime.visibility.actions.project(answer, perspective)
            expect(theirs).toHaveProperty('metadata.pileDeposits', [{ region: 'cradle' }])
            for (const id of drawn) expect(JSON.stringify(theirs)).not.toContain(id)
        }
    })

    // R-9.4
    it("keeps the relic Family Heirloom draws to its player: in state, in the play's record and in the answer's record", () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.Searching, [HEIRLOOM, FILLER])
        const played = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.SearchResolve, playerId: 'p1', keptCardId: HEIRLOOM, discardOrder: [FILLER], play: SearchPlay.Adviser, faceUp: true }), state: before, game })
        const asked = canonical(played.updatedState)
        const play = played.processedActions[0]
        expect(play.revealsInfo).toBe(true)
        expect(OathRuntime.visibility.actions.project(play, p1)).toHaveProperty('metadata.peeked', [CUP])
        expect(OathRuntime.visibility.state.project(asked, p1).pendingQuestions?.queue[0]).toHaveProperty('relicCardId', CUP)
        for (const perspective of [p2, spectator]) {
            expect(JSON.stringify(OathRuntime.visibility.actions.project(play, perspective))).not.toContain(CUP)
            expect(JSON.stringify(OathRuntime.visibility.state.project(asked, perspective))).not.toContain(CUP)
        }

        const answered = engine.executeCanonicalAction({ action: userAction(asked, { type: ActionType.AnswerQuestion, playerId: 'p1', answer: { kind: PowerQuestionKind.KeepOrBottomRelic, keep: false } }), state: asked, game })
        const answer = answered.processedActions[0]
        expect(canonical(answered.updatedState).vault.relicDeck.at(-1)).toBe(CUP)
        expect(OathRuntime.visibility.actions.project(answer, p1)).toHaveProperty('metadata.relicToDeckBottom', CUP)
        for (const perspective of [p2, spectator]) {
            expect(JSON.stringify(OathRuntime.visibility.actions.project(answer, perspective))).not.toContain(CUP)
        }
    })

    it('marks the R-6.1 flip of Family Heirloom as a vault read, and keeps its relic from other players', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.ActPhase, [], [{ cardId: HEIRLOOM, faceUp: false }])
        const result = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.PlayFacedownAdviser, playerId: 'p1', cardId: HEIRLOOM, play: SearchPlay.Adviser }), state: before, game })
        const flip = result.processedActions[0]
        expect(canonical(result.updatedState).vault.relicDeck).not.toContain(CUP)
        expect(flip.revealsInfo).toBe(true)
        for (const perspective of [p2, spectator]) {
            expect(JSON.stringify(OathRuntime.visibility.actions.project(flip, perspective))).not.toContain(CUP)
        }
    })

    it("keeps the relic Dowsing Sticks draws out of other players' view of its record and of the question", () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.ActPhase, [])
        before.players[0].relicIds = [DOWSING_STICKS]
        before.players[0].secrets = 1
        const result = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.UseActionPower, playerId: 'p1', cardId: DOWSING_STICKS, powerIndex: 0 }), state: before, game })
        const used = result.processedActions[0]
        const after = canonical(result.updatedState)
        expect(after.pendingQuestions?.queue[0]).toHaveProperty('relicCardId', CUP)
        expect(OathRuntime.visibility.actions.project(used, p1)).toHaveProperty('metadata.peeked', [CUP])
        for (const perspective of [p2, spectator]) {
            expect(JSON.stringify(OathRuntime.visibility.actions.project(used, perspective))).not.toContain(CUP)
            expect(JSON.stringify(OathRuntime.visibility.state.project(after, perspective))).not.toContain(CUP)
        }
    })

    it('keeps the facedown relic Relic Breaker sends to the bottom out of every record, its user\'s included', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.ActPhase, [], [{ cardId: RELIC_BREAKER, faceUp: true }], { 'c1.relic.0': CUP })
        const result = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.UseActionPower, playerId: 'p1', cardId: RELIC_BREAKER, powerIndex: 0, choices: [{ kind: 'relicSlot', slotId: 'c1.relic.0' }] }), state: before, game })
        const used = result.processedActions[0]
        expect(canonical(result.updatedState).vault.relicDeck.at(-1)).toBe(CUP)
        expect(used).toHaveProperty('metadata.relicSlotToBottom', 'c1.relic.0')
        assert(isUseActionPower(used), 'the record is the Relic Breaker use')
        expect(JSON.stringify(used.metadata)).not.toContain(CUP)
        for (const perspective of [p1, p2, spectator]) {
            expect(JSON.stringify(OathRuntime.visibility.actions.project(used, perspective))).not.toContain(CUP)
        }
    })

    it('refuses to run Pilgrimage from a projection and defers to the host', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const state = pilgrimageBoard()
        expect(() => engine.executeAction({ action: playPilgrimage(state), state, game, perspective: p1 })).toThrow(
            Visibility.UnavailableProjectedValueError
        )
    })
    // R-2.2.2, R-9.4
    it('keeps a facedown adviser to its holder: in state and in the SearchResolve record', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.Searching, [TUTOR, FILLER])
        const result = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.SearchResolve, playerId: 'p1', keptCardId: TUTOR, discardOrder: [FILLER], play: SearchPlay.Adviser, faceUp: false }), state: before, game })
        const after = canonical(result.updatedState)
        expect(after.players[0].advisers).toEqual([{ faceUp: false }])
        expect(after.players[0].adviserIds).toEqual([TUTOR])
        expect(OathRuntime.visibility.state.project(after, p1).players[0].adviserIds).toEqual([TUTOR])
        expect(OathRuntime.visibility.actions.project(result.processedActions[0], p1)).toHaveProperty('keptCardId', TUTOR)
        for (const perspective of [p2, spectator]) {
            const view = OathRuntime.visibility.state.project(after, perspective)
            expect(view.players[0]).not.toHaveProperty('adviserIds')
            expect(view.players[0].advisers).toEqual([{ faceUp: false }])
            expect(JSON.stringify(view)).not.toContain(TUTOR)
            const record = OathRuntime.visibility.actions.project(result.processedActions[0], perspective)
            expect(record).not.toHaveProperty('keptCardId')
            expect(JSON.stringify(record)).not.toContain(TUTOR)
            expect(JSON.stringify(record)).not.toContain(FILLER)
            expect(record).toMatchObject({ metadata: { discardedCount: 1 } })
        }
        expect(OathRuntime.visibility.actions.project(result.processedActions[0], p1)).toMatchObject({ metadata: { discardedCardIds: [FILLER], discardedCount: 1 } })
    })

    it("pays Wild Cry only for a card that shows, so a facedown adviser's suit stays with its holder", () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        function board() {
            const state = testState(
                [
                    testPlayer({ playerId: 'p1', color: Color.Red, siteId: 'c1', supply: 3, handIds: [BIRDSONG, FILLER], warbandsOnBoard: { [Color.Red]: 2 }, warbandsInPersonalBank: { [Color.Red]: 5 } }),
                    testPlayer({ playerId: 'p2', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c1' })
                ],
                {
                    machineState: MachineState.Searching,
                    chancellorPlayerId: 'p2',
                    denizensBySite: { c1: [WILD_CRY] },
                    warbandsBySite: { c1: { [Color.Red]: 1 } },
                    pendingSearchModifiers: [{ cardId: WILD_CRY, powerIndex: powerIndexOf(WILD_CRY, PowerTiming.Modifier) }]
                }
            )
            openTurn(state, 'p1')
            return canonical(state.dehydrate())
        }
        function play(faceUp: boolean) {
            const before = board()
            return engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.SearchResolve, playerId: 'p1', keptCardId: BIRDSONG, discardOrder: [FILLER], play: SearchPlay.Adviser, faceUp }), state: before, game })
        }

        const shown = canonical(play(true).updatedState)
        expect(shown.players[0].supply).toBe(4)

        const hidden = play(false)
        const after = canonical(hidden.updatedState)
        expect(after.players[0].supply).toBe(3)
        expect(after.players[0].warbandsOnBoard).toEqual({ [Color.Red]: 2 })
        for (const perspective of [p2, spectator]) {
            expect(JSON.stringify(OathRuntime.visibility.actions.project(hidden.processedActions[0], perspective))).not.toContain('Wild Cry')
        }
    })

    it('keeps the size of the world deck out of the public summary of an Oracular Pig peek', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.ActPhase, [])
        before.players[0].relicIds = [ORACULAR_PIG]
        before.vault.worldDeck = [TUTOR, FAITH]
        const result = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.UseActionPower, playerId: 'p1', cardId: ORACULAR_PIG, powerIndex: 0 }), state: before, game })
        const used = result.processedActions[0]
        expect(OathRuntime.visibility.actions.project(used, p1)).toHaveProperty('metadata.peeked', [TUTOR, FAITH])
        for (const perspective of [p2, spectator]) {
            const record = JSON.stringify(OathRuntime.visibility.actions.project(used, perspective))
            expect(record).toContain('Oracular Pig: peeked at the top of the world deck')
            expect(record).not.toMatch(/top \d/)
        }
    })

    it('names the adviser displaced by a Search to its player alone, and the kept card once it shows', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const full = [{ cardId: TUTOR, faceUp: false }, { cardId: 'denizen.beast.wolves', faceUp: true }, { cardId: 'denizen.nomad.tents', faceUp: true }]
        const before = relicBoard(MachineState.Searching, [FILLER, 'denizen.hearth.storyteller'], full)
        const result = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.SearchResolve, playerId: 'p1', keptCardId: FILLER, discardOrder: ['denizen.hearth.storyteller'], play: SearchPlay.Adviser, faceUp: true, discardedAdviserCardIds: [TUTOR] }), state: before, game })
        const record = result.processedActions[0]
        expect(OathRuntime.visibility.actions.project(record, p1)).toHaveProperty('discardedAdviserCardIds', [TUTOR])
        for (const perspective of [p2, spectator]) {
            const theirs = OathRuntime.visibility.actions.project(record, perspective)
            expect(theirs).not.toHaveProperty('discardedAdviserCardIds')
            expect(theirs).toHaveProperty('metadata.playedCardId', FILLER)
            expect(JSON.stringify(theirs)).not.toContain(TUTOR)
        }
    })

    it('keeps the adviser kept at setup to its player: in state and in the SetupChoice record', () => {
        const { startedGame, initialState } = engine.startGame(buildGame(), { masterSeed: MASTER_SEED })
        const state = canonical(initialState)
        const seat = state.players.find((player) => player.playerId === state.chancellorPlayerId)
        assert(seat !== undefined, 'setup seats a Chancellor')
        const [kept, ...discards] = seat.handIds
        const result = engine.executeCanonicalAction({ action: userAction(state, { type: ActionType.SetupChoice, playerId: seat.playerId, siteId: TOP_CRADLE_SLOT, adviserCardId: kept, discardOrder: discards }), state, game: startedGame })
        const after = canonical(result.updatedState)
        const owner = { kind: 'player', playerId: seat.playerId } as const
        const other = { kind: 'player', playerId: state.players.find((player) => player.playerId !== seat.playerId)?.playerId ?? '' } as const
        const index = after.players.findIndex((player) => player.playerId === seat.playerId)
        expect(OathRuntime.visibility.state.project(after, owner).players[index].adviserIds).toEqual([kept])
        expect(OathRuntime.visibility.actions.project(result.processedActions[0], owner)).toHaveProperty('adviserCardId', kept)
        for (const perspective of [other, spectator]) {
            expect(OathRuntime.visibility.state.project(after, perspective).players[index]).not.toHaveProperty('adviserIds')
            const record = OathRuntime.visibility.actions.project(result.processedActions[0], perspective)
            expect(record).not.toHaveProperty('adviserCardId')
            expect(JSON.stringify(record)).not.toContain(kept)
        }
    })

    it('keeps a facedown adviser discarded by R-6.1 out of other players\' view of the record', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.ActPhase, [], [{ cardId: TUTOR, faceUp: false }])
        const result = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.PlayFacedownAdviser, playerId: 'p1', cardId: TUTOR, play: SearchPlay.Discard }), state: before, game })
        const record = result.processedActions[0]
        expect(OathRuntime.visibility.actions.project(record, p1)).toHaveProperty('cardId', TUTOR)
        expect(JSON.stringify(record)).not.toContain('playedCardId')
        for (const perspective of [p2, spectator]) {
            const theirs = OathRuntime.visibility.actions.project(record, perspective)
            expect(theirs).not.toHaveProperty('cardId')
            expect(JSON.stringify(theirs)).not.toContain(TUTOR)
        }
    })

    // R-6.3 — the relic stays facedown.
    it('shows a peeked relic to the peeking player alone: in state and in the Peek record', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.ActPhase, [], [], { 'c1.relic.0': CUP })
        const result = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.Peek, playerId: 'p1', target: { kind: 'siteRelic', slotId: 'c1.relic.0' } }), state: before, game })
        const after = canonical(result.updatedState)
        expect(after.relicsBySite['c1']).toEqual([{ slotId: 'c1.relic.0' }])
        expect(after.vault.relicFacedown['c1.relic.0']).toBe(CUP)
        expect(OathRuntime.visibility.state.project(after, p1).players[0].peekedRelics).toEqual({ 'c1.relic.0': CUP })
        const record = result.processedActions[0]
        expect(OathRuntime.visibility.actions.project(record, p1)).toHaveProperty('metadata.relicCardId', CUP)
        for (const perspective of [p2, spectator]) {
            const view = OathRuntime.visibility.state.project(after, perspective)
            expect(view.players[0]).not.toHaveProperty('peekedRelics')
            expect(view.players[0].peekedRelicSlotIds).toEqual(['c1.relic.0'])
            expect(JSON.stringify(view)).not.toContain(CUP)
            expect(JSON.stringify(OathRuntime.visibility.actions.project(record, perspective))).not.toContain(CUP)
        }
    })

    // R-6.4-H1
    it("gives the Scepter's holder every Reliquary relic from setup, owner-known, and an Exile none", () => {
        const { initialState } = engine.startGame(buildGame(), { masterSeed: MASTER_SEED })
        const state = canonical(initialState)
        const holder = required(state.players.find((player) => player.relicIds.includes(GRAND_SCEPTER_ID)), 'the Scepter at setup')
        const slots = state.reliquary.map((slot) => slot.slotId)
        const relics = slots.map((slotId) => required(state.vault.relicFacedown[slotId], `a relic on ${slotId}`))
        expect(holder.playerId).toBe(state.chancellorPlayerId)
        expect(holder.peekedRelicSlotIds).toEqual(slots)

        const own = OathRuntime.visibility.state.project(state, { kind: 'player', playerId: holder.playerId })
        expect(own.players.find((player) => player.playerId === holder.playerId)?.peekedRelics).toEqual(Object.fromEntries(slots.map((slotId, i) => [slotId, relics[i]])))
        const exile = required(state.players.find((player) => player.playerId !== holder.playerId), 'an Exile')
        for (const perspective of [{ kind: 'player', playerId: exile.playerId } as const, spectator]) {
            const view = JSON.stringify(OathRuntime.visibility.state.project(state, perspective))
            for (const relic of relics) expect(view).not.toContain(`"${relic}"`)
        }
    })

    it('teaches a new holder of the Scepter the Reliquary in canonical execution, not in a projection', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.ActPhase, [])
        before.reliquary = [{ slotId: 'reliquary.0' }]
        before.vault.relicFacedown = { ...before.vault.relicFacedown, 'reliquary.0': CUP }
        before.players[1].relicIds = [GRAND_SCEPTER_ID]
        const result = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.EndActPhase, playerId: 'p1' }), state: before, game })
        const after = canonical(result.updatedState)
        expect(OathRuntime.visibility.state.project(after, p2).players[1].peekedRelics).toEqual({ 'reliquary.0': CUP })
        expect(result.processedActions[0].revealsInfo).toBe(true)
        for (const perspective of [p1, spectator]) {
            expect(JSON.stringify(OathRuntime.visibility.state.project(after, perspective))).not.toContain(`"${CUP}"`)
        }
    })

    // R-9.4
    it('shows the relic Fae Merchant draws to its user alone while they choose what goes down', () => {
        const state = relicBoard(MachineState.ActPhase, [])
        state.pendingQuestions = { queue: [{ kind: PowerQuestionKind.BottomRelic, cardId: 'denizen.beast.fae-merchant', askedPlayerId: 'p1', relicCardId: CUP }], askingPlayerId: 'p1', resumeMachineState: MachineState.ActPhase }
        expect(OathRuntime.visibility.state.project(state, p1).pendingQuestions?.queue[0]).toHaveProperty('relicCardId', CUP)
        for (const perspective of [p2, spectator]) {
            const view = OathRuntime.visibility.state.project(state, perspective)
            expect(view.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.BottomRelic })
            expect(JSON.stringify(view)).not.toContain(CUP)
        }
    })

    // R-6.1, R-9.4
    it('shows a facedown adviser let peeked at to its holder and the one shown alone', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.ActPhase, [], [{ cardId: TUTOR, faceUp: false }])
        const result = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.LetPeek, outOfTurn: true, playerId: 'p1', toPlayerId: 'p2', subject: { kind: LetPeekSubjectKind.Adviser, cardId: TUTOR } }), state: before, game })
        const record = result.processedActions[0]
        expect(record.revealsInfo).toBe(true)
        expect(OathRuntime.visibility.actions.project(record, p1)).toHaveProperty('subject.cardId', TUTOR)
        expect(OathRuntime.visibility.actions.project(record, p2)).toHaveProperty('subject.cardId', TUTOR)
        const p3 = { kind: 'player', playerId: 'p3' } as const
        for (const perspective of [p3, spectator]) {
            expect(JSON.stringify(OathRuntime.visibility.actions.project(record, perspective))).not.toContain(TUTOR)
            expect(JSON.stringify(OathRuntime.visibility.state.project(canonical(result.updatedState), perspective))).not.toContain(TUTOR)
        }
        // R-9.4 — the shown player keeps seeing the face while the card stays there facedown; the row says who was shown.
        const after = canonical(result.updatedState)
        const row = OathRuntime.visibility.state.project(after, p2).players[0].advisers[0]
        expect(row).toMatchObject({ faceUp: false, shownTo: ['p2'], shownCardId: TUTOR })
        expect(OathRuntime.visibility.state.project(after, p3).players[0].advisers[0]).not.toHaveProperty('shownCardId')
        const gone = new HydratedOathGameState(after)
        gone.getPlayerState('p1').removeAdviser(TUTOR)
        expect(JSON.stringify(OathRuntime.visibility.state.project(canonical(gone.dehydrate()), p2))).not.toContain(TUTOR)
    })

    // R-6.6.1
    it('shows a Reliquary relic the Scepter holder lets an Exile peek at to that Exile alone', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.ActPhase, [])
        before.players[0].relicIds = [GRAND_SCEPTER_ID]
        before.reliquary = [{ slotId: 'reliquary.0' }]
        before.vault.relicFacedown = { ...before.vault.relicFacedown, 'reliquary.0': CUP }
        const result = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.LetPeek, outOfTurn: true, playerId: 'p1', toPlayerId: 'p2', subject: { kind: LetPeekSubjectKind.Reliquary, slotId: 'reliquary.0' } }), state: before, game })
        const record = result.processedActions[0]
        const after = canonical(result.updatedState)
        expect(record.revealsInfo).toBe(true)
        expect(OathRuntime.visibility.actions.project(record, p2)).toHaveProperty('metadata.relicCardId', CUP)
        expect(OathRuntime.visibility.state.project(after, p2).players[1].peekedRelics).toEqual({ 'reliquary.0': CUP })
        const p3 = { kind: 'player', playerId: 'p3' } as const
        for (const perspective of [p1, p3, spectator]) {
            expect(JSON.stringify(OathRuntime.visibility.actions.project(record, perspective))).not.toContain(CUP)
            expect(JSON.stringify(OathRuntime.visibility.state.project(after, perspective))).not.toContain(CUP)
        }
    })

    it('shows the adviser Inquisitor peeks at to its user alone, found by its place among the advisers', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.ActPhase, [], [{ cardId: INQUISITOR, faceUp: true }])
        before.players[1].advisers = [{ faceUp: false }]
        before.players[1].adviserIds = [TUTOR]
        const result = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.UseActionPower, playerId: 'p1', cardId: INQUISITOR, powerIndex: powerIndexOf(INQUISITOR, PowerTiming.Action), choices: [{ kind: 'facedownAdviser', playerId: 'p2', index: 0 }] }), state: before, game })
        const record = result.processedActions[0]
        expect(record.revealsInfo).toBe(true)
        expect(OathRuntime.visibility.actions.project(record, p1)).toHaveProperty('metadata.peeked', [TUTOR])
        const p3 = { kind: 'player', playerId: 'p3' } as const
        for (const perspective of [p3, spectator]) {
            expect(JSON.stringify(OathRuntime.visibility.actions.project(record, perspective))).not.toContain(TUTOR)
            expect(JSON.stringify(OathRuntime.visibility.state.project(canonical(result.updatedState), perspective))).not.toContain(TUTOR)
        }
    })

    // R-9.4 — the relic stays facedown unless taken.
    it('shows the Reliquary relic Skeleton Key peeks at to its user alone, on the question and after leaving it', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.ActPhase, [])
        before.players[0].relicIds = [SKELETON_KEY]
        before.players[0].secrets = 2
        before.warbandsBySite = { c1: { purple: 1 } }
        before.reliquary = [{ slotId: 'reliquary.0' }]
        before.vault.relicFacedown = { ...before.vault.relicFacedown, 'reliquary.0': CUP }
        const used = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.UseActionPower, playerId: 'p1', cardId: SKELETON_KEY, powerIndex: powerIndexOf(SKELETON_KEY, PowerTiming.Action), choices: [{ kind: 'relicSlot', slotId: 'reliquary.0' }] }), state: before, game })
        const asked = canonical(used.updatedState)
        expect(asked.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.TakeOrLeaveRelic, askedPlayerId: 'p1', relicCardId: CUP })
        expect(OathRuntime.visibility.state.project(asked, p1).pendingQuestions?.queue[0]).toHaveProperty('relicCardId', CUP)
        for (const perspective of [p2, spectator]) {
            const view = OathRuntime.visibility.state.project(asked, perspective)
            expect(view.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.TakeOrLeaveRelic, slotId: 'reliquary.0' })
            expect(view.pendingQuestions?.queue[0]).not.toHaveProperty('relicCardId')
            expect(JSON.stringify(view)).not.toContain(CUP)
            expect(JSON.stringify(OathRuntime.visibility.actions.project(used.processedActions[0], perspective))).not.toContain(CUP)
        }

        const left = engine.executeCanonicalAction({ action: userAction(asked, { type: ActionType.AnswerQuestion, playerId: 'p1', answer: { kind: PowerQuestionKind.TakeOrLeaveRelic, take: false } }), state: asked, game })
        const after = canonical(left.updatedState)
        expect(after.vault.relicFacedown['reliquary.0']).toBe(CUP)
        for (const perspective of [p2, spectator]) {
            expect(JSON.stringify(OathRuntime.visibility.state.project(after, perspective))).not.toContain(CUP)
            expect(JSON.stringify(OathRuntime.visibility.actions.project(left.processedActions[0], perspective))).not.toContain(CUP)
        }
    })

    it("names the Conspiracy Inquisitor finds, which the favor it keeps makes public, and none of the holder's other facedown advisers", () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.ActPhase, [], [{ cardId: INQUISITOR, faceUp: true }])
        before.players[1].advisers = [{ faceUp: false }, { faceUp: false }]
        before.players[1].adviserIds = [CONSPIRACY, TUTOR]
        const result = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.UseActionPower, playerId: 'p1', cardId: INQUISITOR, powerIndex: powerIndexOf(INQUISITOR, PowerTiming.Action), choices: [{ kind: 'facedownAdviser', playerId: 'p2', index: 0 }] }), state: before, game })
        const after = canonical(result.updatedState)
        expect(after.players[1].favor).toBe(before.players[1].favor)
        expect(after.pendingQuestions?.queue[0]).toEqual({ kind: PowerQuestionKind.PlayOrDiscardConspiracy, cardId: INQUISITOR, askedPlayerId: 'p1', holderPlayerId: 'p2' })
        const p3 = { kind: 'player', playerId: 'p3' } as const
        for (const perspective of [p3, spectator]) {
            const view = OathRuntime.visibility.state.project(after, perspective)
            expect(view.pendingQuestions?.queue[0]).toEqual(after.pendingQuestions?.queue[0])
            expect(view.players[1]).not.toHaveProperty('adviserIds')
            expect(JSON.stringify(view)).not.toContain(TUTOR)
            const record = OathRuntime.visibility.actions.project(result.processedActions[0], perspective)
            expect(record).toHaveProperty('metadata.summary', "Inquisitor: p2's adviser is the Conspiracy — play it, or discard it")
            expect(record).not.toHaveProperty('metadata.peeked')
            expect(JSON.stringify(record)).not.toContain(TUTOR)
        }
    })

    // R-5.1.4.II — the discarded adviser may be facedown.
    it('names the adviser a False Prophet player discards to make room for the Vision to that player alone', () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const full = [{ cardId: FALSE_PROPHET, faceUp: true }, { cardId: TUTOR, faceUp: false }, { cardId: FILLER, faceUp: true }]
        const before = relicBoard(MachineState.PowerQuestion, [], full)
        before.pendingQuestions = { queue: [{ kind: PowerQuestionKind.PlayOrDiscardVision, cardId: FALSE_PROPHET, askedPlayerId: 'p1', visionCardId: FAITH }], askingPlayerId: 'p2', resumeMachineState: MachineState.ActPhase }
        const result = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.AnswerQuestion, playerId: 'p1', answer: { kind: PowerQuestionKind.PlayOrDiscardVision, play: SearchPlay.Adviser, discardedAdviserCardId: TUTOR } }), state: before, game })
        const after = canonical(result.updatedState)
        expect(after.players[0].adviserIds).toEqual([FALSE_PROPHET, FILLER, FAITH])
        const record = result.processedActions[0]
        expect(OathRuntime.visibility.actions.project(record, p1)).toHaveProperty('answer.discardedAdviserCardId', TUTOR)
        for (const perspective of [p2, spectator]) {
            const theirs = OathRuntime.visibility.actions.project(record, perspective)
            expect(theirs).not.toHaveProperty('answer.discardedAdviserCardId')
            expect(theirs).toHaveProperty('metadata.summary', `played ${FAITH} (adviser)`)
            expect(JSON.stringify(theirs)).not.toContain(TUTOR)
            expect(JSON.stringify(OathRuntime.visibility.state.project(after, perspective))).not.toContain(TUTOR)
        }
    })

    it("offers a player the same actions from their projection as from canonical state while others hold facedown advisers", () => {
        const game = { ...buildGame(), status: GameStatus.Started, protectedInformation: true as const }
        const before = relicBoard(MachineState.ActPhase, [], [{ cardId: INQUISITOR, faceUp: true }, { cardId: TUTOR, faceUp: false }])
        before.players[0].relicIds = [IVORY_EYE, GRAND_SCEPTER_ID]
        before.players[1].advisers = [{ faceUp: false }]
        before.players[1].adviserIds = ['denizen.nomad.tents']
        const canonicalOffer = engine.getValidActionTypesForPlayer(game, before, 'p1')
        const projected = OathRuntime.visibility.state.project(before, p1)
        expect(projected.players[1]).not.toHaveProperty('adviserIds')
        expect(canonicalOffer).toContain(ActionType.UseActionPower)
        expect(engine.getValidActionTypesForPlayer(game, projected, 'p1', { perspective: p1 })).toEqual(canonicalOffer)
    })
})
