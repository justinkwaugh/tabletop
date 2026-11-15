import { describe, expect, it } from 'vitest'
import {
    defaultGameConfig,
    GameEngine,
    normalizeGameConfig,
    type GameConfig
} from '@tabletop/common'
import { createTestGame, firstEmptyCellDisk } from '../util/testHelper.js'
import { ActionType } from './actions.js'
import { FreshFishConfigurator } from './configurator.js'
import { auctioneerWinsTie, forceThreeDisks, RuleSet } from './gameConfig.js'
import { FreshFishRuntime } from './runtime.js'

const configurator = new FreshFishConfigurator()

function rules(config: GameConfig) {
    const normalized = normalizeGameConfig(config, configurator)
    return {
        auctioneerWinsTie: auctioneerWinsTie(normalized),
        forceThreeDisks: forceThreeDisks(normalized)
    }
}

describe('Fresh Fish rule sets', () => {
    it("defaults to Kyle's Rules", () => {
        expect(defaultGameConfig(configurator.options)).toEqual({
            ruleSet: RuleSet.Kyles,
            boardSeed: null
        })
        expect(normalizeGameConfig({}, configurator)).toEqual({ ruleSet: RuleSet.Kyles })
        expect(rules({})).toEqual({ auctioneerWinsTie: false, forceThreeDisks: true })
    })

    it('turns on auctioneer ties and turns off the three disks for Classic', () => {
        expect(rules({ ruleSet: RuleSet.Classic })).toEqual({
            auctioneerWinsTie: true,
            forceThreeDisks: false
        })
    })

    it.each([
        [{ auctioneerWinsTie: false, forceThreeDisks: true }, { ruleSet: RuleSet.Kyles }],
        [{ auctioneerWinsTie: true, forceThreeDisks: false }, { ruleSet: RuleSet.Classic }],
        [
            { auctioneerWinsTie: true, forceThreeDisks: true },
            { ruleSet: RuleSet.Classic, diskRuleOverride: true }
        ],
        [
            { auctioneerWinsTie: false, forceThreeDisks: false },
            { ruleSet: RuleSet.Kyles, diskRuleOverride: false }
        ],
        [{ auctioneerWinsTie: true }, { ruleSet: RuleSet.Classic, diskRuleOverride: true }],
        [{ numTurnsWithDisksToStart: 3 }, { ruleSet: RuleSet.Kyles }]
    ])('keeps the rules a game was created with: %o', (legacy: GameConfig, expected) => {
        const stored = structuredClone(legacy)
        const normalized = normalizeGameConfig(legacy, configurator)
        expect(normalized).toEqual(expected)
        expect(normalizeGameConfig(normalized, configurator)).toEqual(normalized)
        // Before rule sets, a missing option meant the auctioneer lost ties and three disks.
        expect(rules(legacy)).toEqual({
            auctioneerWinsTie: legacy.auctioneerWinsTie ?? false,
            forceThreeDisks: legacy.forceThreeDisks ?? true
        })
        expect(legacy).toEqual(stored)
    })

    it('keeps legacy rules when a form or tournament draft merges in defaults', () => {
        const legacy = { auctioneerWinsTie: true, forceThreeDisks: true }
        const normalized = normalizeGameConfig(legacy, configurator)
        const saved = normalizeGameConfig({
            ...defaultGameConfig(configurator.options),
            ...normalized
        })
        expect(normalizeGameConfig(saved, configurator)).toEqual(normalized)
        expect(() => configurator.validateConfig(saved)).not.toThrow()
        // An older form adding the default rule set without translating still keeps the rules.
        expect(normalizeGameConfig({ ...legacy, ruleSet: RuleSet.Kyles }, configurator)).toEqual(
            normalized
        )
    })

    it.each([
        [{ auctioneerWinsTie: true, forceThreeDisks: true }, RuleSet.Kyles],
        [{ auctioneerWinsTie: false, forceThreeDisks: false }, RuleSet.Classic]
    ])('drops an older game’s own disk rule when a rule set is chosen: %o', (legacy, ruleSet) => {
        const config = normalizeGameConfig(legacy, configurator)
        configurator.updateConfig(config, { id: 'ruleSet', value: ruleSet })
        expect(normalizeGameConfig(config, configurator)).toEqual({ ruleSet })
    })

    it('rejects unknown rule sets', () => {
        expect(() => normalizeGameConfig({ ruleSet: 'house' }, configurator)).toThrow()
    })

    it.each([
        [RuleSet.Kyles, [ActionType.PlaceDisk]],
        [RuleSet.Classic, [ActionType.PlaceDisk, ActionType.DrawTile]]
    ])('%s offers these actions on a second turn: %o', (ruleSet, expected) => {
        const engine = new GameEngine(FreshFishRuntime)
        const game = createTestGame(2, { ruleSet })
        let state = engine.startGame(game).initialState
        for (const playerId of [...state.turnManager.turnOrder]) {
            const action = firstEmptyCellDisk(game, state, playerId)
            state = engine.executeCanonicalAction({ game, state, action }).updatedState
        }
        const [first] = state.activePlayerIds
        expect(engine.getValidActionTypesForPlayer(game, state, first)).toEqual(expected)
    })
})
