import { describe, expect, it } from 'vitest'
import { ActionSource, latestPlayerUndoTarget, type GameAction } from '@tabletop/common'
import { Campaign, HydratedCampaign } from '../actions/campaign.js'
import {
    CampaignResolveVictory,
    HydratedCampaignResolveVictory
} from '../actions/campaignResolveVictory.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { HydratedMuster } from '../actions/muster.js'
import { HydratedRecover, Recover, RecoverTargetKind } from '../actions/recover.js'
import { HydratedTrade, TradeOption } from '../actions/trade.js'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { ActionType } from '../definition/actions.js'
import { BattlePlanSide, PowerTiming } from '../data/cardPowers.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { Banner, Suit } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { siteTarget } from '../testing/choices.js'
import {
    ANCIENT_FORGE,
    DANA,
    HALL_OF_DEBATE,
    PLAINS_SLOT,
    RHYS,
    SPRAWLING_RAMPART,
    STONES_SLOT,
    WOLVES,
    edificeTable,
    placeEdifice
} from '../testing/edifices.js'
import { engine } from '../testing/engine.js'
import { openTurn, testBanners } from '../testing/fixture.js'
import { testGame } from '../testing/game.js'
import { ongoingCampaign } from '../testing/required.js'
import { defend } from '../testing/steps.js'
import { banditBattlePlans, resolveBattlePlans, usableBattlePlans } from '../util/battlePlans.js'
import { declaredParties, reasonCannotDeclareTargets, targetDefenseDice } from '../util/campaign.js'
import { persistentRefusesBannerTake, persistentsInPlay } from '../util/persistent.js'
import { legalPowers, reasonCannotUsePower } from '../util/powerDoorway.js'
import { returnFavorFromCards, returnSecretsToBoard } from '../util/rest.js'
import { peoplesFavorStepCount } from '../util/wake.js'
import './index.js'

const INTACT = 0
const RUINED = 1
const CUP = 'relic.cup-of-plenty'
const CIRCLET = 'relic.circlet-of-command'
const PYTHON = 'denizen.beast.giant-python'
const MOUNTAIN_SLOT = 'h1'
const RIVER_SLOT = 'c2'
const PEOPLES_FAVOR: CampaignTarget = {
    kind: CampaignTargetKind.Banner,
    banner: Banner.PeoplesFavor
}

/** Moves Hall of Debate from the Plains to the Mountain, a site with no warbands: the bandits'. */
function hallToBanditSite(state: HydratedOathGameState, ruined = false): void {
    state.denizensBySite[PLAINS_SLOT] = [WOLVES]
    placeEdifice(state, MOUNTAIN_SLOT, HALL_OF_DEBATE, { ruined })
}

/** Rhys, with four warbands on their board, to act; Dana holds the People's Favor. */
function rhysTable(
    over: Record<string, Record<string, unknown>> = {},
    state: Record<string, unknown> = {}
): HydratedOathGameState {
    const s = edificeTable(
        {
            ...over,
            [RHYS]: { warbandsOnBoard: { [RHYS]: 4 }, ...over[RHYS] }
        },
        { banners: testBanners({ [Banner.PeoplesFavor]: DANA }), ...state }
    )
    openTurn(s, RHYS)
    return s
}

function campaignReason(
    state: HydratedOathGameState,
    attackerId: string,
    defenderId: string | undefined,
    targets: CampaignTarget[]
): string | undefined {
    return HydratedCampaign.reasonCannotCampaign(state, attackerId, {
        defender: defenderId ? { kind: 'player', playerId: defenderId } : { kind: 'bandits' },
        targets,
        attackDice: 2,
        plans: []
    })
}

function campaign(
    attackerId: string,
    defenderId: string | undefined,
    targets: CampaignTarget[],
    attackDice: number
): HydratedCampaign {
    return new HydratedCampaign(
        buildAction(Campaign, {
            playerId: attackerId,
            defender: defenderId ? { kind: 'player', playerId: defenderId } : { kind: 'bandits' },
            targets,
            attackDice
        })
    )
}

function recoverPeoplesFavor(playerId: string, amountPaid: number): HydratedRecover {
    return new HydratedRecover(
        buildAction(Recover, {
            playerId,
            target: { kind: RecoverTargetKind.Banner, banner: Banner.PeoplesFavor },
            amountPaid,
            redistributeFrom: Suit.Hearth
        })
    )
}

function useForge(playerId: string, powerIndex: number): HydratedUseActionPower {
    return new HydratedUseActionPower(
        buildAction(UseActionPower, { playerId, cardId: ANCIENT_FORGE, powerIndex })
    )
}

describe("Hall of Debate — Players cannot target the People's Favor (R-5.4.1-H1)", () => {
    const refusal = "Hall of Debate: the People's Favor cannot be targeted"

    it('refuses it as a Campaign target while its holder rules the Hall', () => {
        const state = rhysTable()
        expect(campaignReason(state, RHYS, DANA, [siteTarget(PLAINS_SLOT)])).toBeUndefined()
        expect(campaignReason(state, RHYS, DANA, [siteTarget(PLAINS_SLOT), PEOPLES_FAVOR])).toBe(
            refusal
        )
    })

    it('binds the Hall’s own ruler: Dana cannot target it in Rhys’s hands', () => {
        const state = edificeTable(
            { [DANA]: { warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 } } },
            { banners: testBanners({ [Banner.PeoplesFavor]: RHYS }) }
        )
        const pawn: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }
        expect(campaignReason(state, DANA, RHYS, [pawn])).toBeUndefined()
        expect(campaignReason(state, DANA, RHYS, [pawn, PEOPLES_FAVOR])).toBe(refusal)
    })

    it('binds every player when the bandits rule the Hall', () => {
        const state = rhysTable()
        hallToBanditSite(state)
        expect(campaignReason(state, RHYS, DANA, [siteTarget(PLAINS_SLOT), PEOPLES_FAVOR])).toBe(
            refusal
        )
    })

    it('Hall of Mockery, the ruined side, refuses nothing', () => {
        const state = rhysTable()
        state.setEdificeRuined(HALL_OF_DEBATE, true)
        expect(
            campaignReason(state, RHYS, DANA, [siteTarget(PLAINS_SLOT), PEOPLES_FAVOR])
        ).toBeUndefined()
    })

    it('a Recover of it, and any take that is not a Campaign target, stay legal', () => {
        const state = rhysTable()
        expect(
            HydratedRecover.reasonCannotRecover(state, RHYS, {
                target: { kind: RecoverTargetKind.Banner, banner: Banner.PeoplesFavor },
                amountPaid: 2,
                redistributeFrom: Suit.Hearth
            })
        ).toBeUndefined()
        for (const how of ['recover', 'seize'] as const) {
            expect(
                persistentRefusesBannerTake(state, RHYS, Banner.PeoplesFavor, how, DANA)
            ).toBeUndefined()
        }
    })

    it('meets Circlet of Command: the first refusal is reported', () => {
        const state = rhysTable({ [DANA]: { relicIds: [CIRCLET] } })
        expect(campaignReason(state, RHYS, DANA, [siteTarget(PLAINS_SLOT), PEOPLES_FAVOR])).toBe(
            "Circlet of Command: dana's People's Favor cannot be targeted or taken"
        )
    })
})

describe("Hall of Mockery — Recovering the People's Favor always flips it to the Mob side", () => {
    it('acts only while its side is up, as Hall of Debate does only while its side is', () => {
        const state = edificeTable()
        const halls = () =>
            persistentsInPlay(state)
                .filter((p) => p.ctx.cardId === HALL_OF_DEBATE)
                .map((p) => p.ctx.power.powerIndex)
        expect(halls()).toEqual([INTACT])
        state.setEdificeRuined(HALL_OF_DEBATE, true)
        expect(halls()).toEqual([RUINED])
    })

    it('a Recover from another player leaves it on its Mob side, and the rest of R-5.4.4 is unchanged', () => {
        const state = rhysTable()
        state.setEdificeRuined(HALL_OF_DEBATE, true)
        const recover = recoverPeoplesFavor(RHYS, 2)
        recover.apply(state)
        expect(state.banners[Banner.PeoplesFavor]).toMatchObject({
            holderPlayerId: RHYS,
            value: 2,
            mobSide: true
        })
        expect(recover.metadata).toMatchObject({
            amountPaid: 2,
            favorRedistributedTo: [Suit.Hearth],
            flippedToMob: true
        })
        expect(state.getPlayerState(RHYS).favor).toBe(2)
        // R-4.1.1 — the Mob side's Wake step then applies.
        expect(peoplesFavorStepCount(state)).toBe(2)
    })

    it('without it the Recover flips it to its other side, as R-5.4.4 says', () => {
        const state = rhysTable()
        state.banners[Banner.PeoplesFavor].mobSide = true
        const recover = recoverPeoplesFavor(RHYS, 2)
        recover.apply(state)
        expect(state.banners[Banner.PeoplesFavor].mobSide).toBe(false)
        expect(recover.metadata?.flippedToMob).toBeUndefined()
        expect(peoplesFavorStepCount(state)).toBe(1)
    })

    it('a Recover from yourself, and one on the Mob side already, end on the Mob side', () => {
        const state = edificeTable(
            { [DANA]: { favor: 8 } },
            { banners: testBanners({ [Banner.PeoplesFavor]: DANA }) }
        )
        state.setEdificeRuined(HALL_OF_DEBATE, true)
        recoverPeoplesFavor(DANA, 2).apply(state)
        expect(state.banners[Banner.PeoplesFavor]).toMatchObject({
            holderPlayerId: DANA,
            mobSide: true
        })
        recoverPeoplesFavor(DANA, 3).apply(state)
        expect(state.banners[Banner.PeoplesFavor].mobSide).toBe(true)
    })

    it('acts while the bandits rule it', () => {
        const state = rhysTable()
        hallToBanditSite(state, true)
        recoverPeoplesFavor(RHYS, 2).apply(state)
        expect(state.banners[Banner.PeoplesFavor].mobSide).toBe(true)
    })

    it('Hall of Debate, the intact side, flips nothing', () => {
        const state = rhysTable()
        recoverPeoplesFavor(RHYS, 2).apply(state)
        expect(state.banners[Banner.PeoplesFavor].mobSide).toBe(false)
    })
})

describe('Ancient Forge — Action: Draw a relic. Take it or put it on the bottom of the relic deck', () => {
    /** The Forge intact at Standing Stones, a relic in the deck; Dana's pawn there, or Dana ruling it. */
    function forgeTable(by: 'pawn' | 'rule', relicDeck = [CUP]) {
        const state =
            by === 'pawn'
                ? edificeTable({ [DANA]: { siteId: STONES_SLOT } })
                : edificeTable(
                      {},
                      {
                          warbandsBySite: {
                              [PLAINS_SLOT]: {},
                              [STONES_SLOT]: { [IMPERIAL_WARBANDS]: 1 }
                          }
                      }
                  )
        state.setEdificeRuined(ANCIENT_FORGE, false)
        state.requireVault().relicDeck = relicDeck
        return state
    }

    it.each(['pawn', 'rule'] as const)(
        'draws, asks the drawer to take it or bottom it, and pays its cost onto the card (%s)',
        (by) => {
            const state = forgeTable(by)
            expect(
                legalPowers(state, DANA, PowerTiming.Action).filter(
                    (use) => use.cardId === ANCIENT_FORGE
                )
            ).toEqual([{ cardId: ANCIENT_FORGE, powerIndex: INTACT, choices: [] }])
            const use = useForge(DANA, INTACT)
            use.apply(state)
            expect(use.metadata?.summary).toBe(
                'Ancient Forge: drew a relic — take it, or put it on the bottom'
            )
            expect(state.pendingQuestions?.queue[0]).toMatchObject({
                kind: PowerQuestionKind.KeepOrBottomRelic,
                cardId: ANCIENT_FORGE,
                askedPlayerId: DANA,
                relicCardId: CUP
            })
            expect(state.tokensOn(ANCIENT_FORGE)).toEqual({ favor: 2, secrets: 0 })
            expect(state.getPlayerState(DANA)).toMatchObject({ favor: 2, secrets: 1 })
            // R-4.3.1 — the favor on the intact Forge goes to the Nomad bank at Rest.
            const nomad = state.favorBank[Suit.Nomad]
            returnFavorFromCards(state)
            expect(state.favorBank[Suit.Nomad]).toBe(nomad + 2)
        }
    )

    it('an empty relic deck draws nothing', () => {
        const state = forgeTable('pawn', [])
        const use = useForge(DANA, INTACT)
        use.apply(state)
        expect(use.metadata?.summary).toBe('Ancient Forge: no relic was drawn')
        expect(state.pendingQuestions).toBeUndefined()
    })

    it('R-7.1.2.a — refused while the card holds favor or secrets', () => {
        const state = forgeTable('pawn')
        state.addTokensOn(ANCIENT_FORGE, { secrets: 1 })
        expect(reasonCannotUsePower(state, DANA, ANCIENT_FORGE, INTACT, PowerTiming.Action)).toBe(
            `${ANCIENT_FORGE} already has favor or secrets on it`
        )
    })
})

describe('Broken Forge — Action: Flip this card over', () => {
    function brokenTable(by: 'pawn' | 'rule') {
        return by === 'pawn'
            ? edificeTable({ [DANA]: { siteId: STONES_SLOT } })
            : edificeTable(
                  {},
                  {
                      warbandsBySite: {
                          [PLAINS_SLOT]: {},
                          [STONES_SLOT]: { [IMPERIAL_WARBANDS]: 1 }
                      }
                  }
              )
    }

    it.each(['pawn', 'rule'] as const)(
        'pays its cost onto the card and flips it to Ancient Forge, whose tokens then bar it (%s)',
        (by) => {
            const state = brokenTable(by)
            const offered = () =>
                legalPowers(state, DANA, PowerTiming.Action).filter(
                    (use) => use.cardId === ANCIENT_FORGE
                )
            expect(offered()).toEqual([{ cardId: ANCIENT_FORGE, powerIndex: RUINED, choices: [] }])
            const use = useForge(DANA, RUINED)
            use.apply(state)
            expect(use.metadata?.summary).toBe('Broken Forge: flipped it to Ancient Forge')
            expect(state.isRuined(ANCIENT_FORGE)).toBe(false)
            expect(state.tokensOn(ANCIENT_FORGE)).toEqual({ favor: 2, secrets: 2 })
            expect(state.getPlayerState(DANA)).toMatchObject({ favor: 2, secrets: 0 })
            // The flip changes what is offered at once, and the tokens bar Ancient Forge (R-7.1.2.a).
            expect(offered()).toEqual([])
            state.getPlayerState(DANA).favor = 4
            state.getPlayerState(DANA).secrets = 2
            expect(
                reasonCannotUsePower(state, DANA, ANCIENT_FORGE, INTACT, PowerTiming.Action)
            ).toBe(`${ANCIENT_FORGE} already has favor or secrets on it`)
            expect(
                reasonCannotUsePower(state, DANA, ANCIENT_FORGE, RUINED, PowerTiming.Action)
            ).toBe('Broken Forge: that side of the card is face down')
        }
    )

    it('R-5.2.1, R-5.3.2 — the card cannot be mustered or traded on until a Rest clears it', () => {
        const state = brokenTable('pawn')
        useForge(DANA, RUINED).apply(state)
        expect(HydratedMuster.reasonCannotMuster(state, DANA, ANCIENT_FORGE)).toBeDefined()
        expect(
            HydratedTrade.reasonCannotTrade(state, DANA, ANCIENT_FORGE, TradeOption.ForSecrets)
        ).toBeDefined()
        const nomad = state.favorBank[Suit.Nomad]
        returnFavorFromCards(state)
        returnSecretsToBoard(state, DANA)
        expect(state.favorBank[Suit.Nomad]).toBe(nomad + 2)
        expect(state.getPlayerState(DANA).secrets).toBe(2)
        expect(state.tokensOn(ANCIENT_FORGE)).toEqual({ favor: 0, secrets: 0 })
        expect(HydratedMuster.reasonCannotMuster(state, DANA, ANCIENT_FORGE)).toBeUndefined()
    })

    it('R-X.3 — the flip reveals nothing, so Undo puts the ruin and the tokens back', () => {
        const game = testGame([DANA, RHYS])
        const start = brokenTable('pawn').dehydrate()
        start.activePlayerIds = [DANA]
        const use = {
            type: ActionType.UseActionPower,
            playerId: DANA,
            cardId: ANCIENT_FORGE,
            powerIndex: RUINED
        }
        const action: GameAction = {
            id: 'use-1',
            gameId: game.id,
            source: ActionSource.User,
            index: start.actionCount,
            ...use
        }
        const result = engine.run(action, start, game)
        expect(result.updatedState.ruinedEdificeIds).toBeUndefined()
        expect(result.processedActions.map((a) => a.revealsInfo)).not.toContain(true)
        const target = latestPlayerUndoTarget(result.processedActions, DANA)
        expect(target?.type).toBe(ActionType.UseActionPower)
        let state = result.updatedState
        for (const processed of result.processedActions.toReversed())
            state = engine.undoProcessedAction({ state, action: processed })
        expect(state).toEqual(start)
    })
})

describe('Sprawling Rampart — Each site ruled by its ruler adds one more defense die when targeted', () => {
    /** The Rampart at the Mountain, with the Empire's warbands there unless the bandits are to rule it. */
    function rampartTable(ruler: 'empire' | 'bandits', ruined = false) {
        const state = rhysTable(
            {},
            {
                warbandsBySite: {
                    [PLAINS_SLOT]: { [IMPERIAL_WARBANDS]: 2 },
                    ...(ruler === 'empire' ? { [MOUNTAIN_SLOT]: { [IMPERIAL_WARBANDS]: 1 } } : {})
                }
            }
        )
        placeEdifice(state, MOUNTAIN_SLOT, SPRAWLING_RAMPART, { ruined })
        return state
    }

    function siteDice(
        state: HydratedOathGameState,
        defenderId: string | undefined,
        siteId: string
    ) {
        return targetDefenseDice(
            state,
            declaredParties(state, RHYS, defenderId, [siteTarget(siteId)])
        )
    }

    it('an Imperial ruler’s Rampart adds a die to another site the Empire rules (R-6.6.3)', () => {
        expect(siteDice(rampartTable('empire'), DANA, PLAINS_SLOT)).toBe(2)
    })

    it('Bandit Rampart, the ruined side, adds none', () => {
        expect(siteDice(rampartTable('empire', true), DANA, PLAINS_SLOT)).toBe(1)
    })

    it('a bandit-ruled Rampart adds a die to each bandit site targeted, and none to a player’s', () => {
        const state = rampartTable('bandits')
        expect(siteDice(state, DANA, PLAINS_SLOT)).toBe(1)
        state.getPlayerState(RHYS).siteId = STONES_SLOT
        expect(siteDice(state, undefined, STONES_SLOT)).toBe(2)
    })

    it("meets Giant Python's Q&A: one site alone is legal (2 dice), a site and a 1-die relic is not (3)", () => {
        const state = rampartTable('empire')
        const dana = state.getPlayerState(DANA)
        dana.advisers = [{ cardId: PYTHON, faceUp: true }]
        dana.adviserIds = [PYTHON]
        dana.relicIds = [CIRCLET]
        const relic: CampaignTarget = { kind: CampaignTargetKind.Relic, cardId: CIRCLET }
        const parties = (targets: CampaignTarget[]) => declaredParties(state, RHYS, DANA, targets)
        expect(
            reasonCannotDeclareTargets(state, parties([siteTarget(PLAINS_SLOT)]))
        ).toBeUndefined()
        expect(reasonCannotDeclareTargets(state, parties([siteTarget(PLAINS_SLOT), relic]))).toBe(
            'Giant Python: the targets must add an even total of defense dice, not 3'
        )
        state.setEdificeRuined(SPRAWLING_RAMPART, true)
        expect(reasonCannotDeclareTargets(state, parties([siteTarget(PLAINS_SLOT)]))).toBe(
            'Giant Python: the targets must add an even total of defense dice, not 1'
        )
    })
})

describe('Bandit Rampart — −2 attack dice if this site is targeted (a defender battle plan, R-7.5)', () => {
    /** Bandit Rampart at `siteId`, no warbands there unless `ruledBy` the Empire; Rhys there to attack. */
    function banditRampartTable(siteId: string, ruledBy?: 'empire') {
        const state = rhysTable(
            { [RHYS]: { siteId } },
            {
                warbandsBySite: {
                    [PLAINS_SLOT]: { [IMPERIAL_WARBANDS]: 2 },
                    ...(ruledBy ? { [siteId]: { [IMPERIAL_WARBANDS]: 1 } } : {})
                }
            }
        )
        placeEdifice(state, siteId, SPRAWLING_RAMPART, { ruined: true })
        return state
    }

    it('the bandits use it when they defend its site (R-5.5.3, R-5.5.3-H1): 3 attack dice become 1', () => {
        const state = banditRampartTable(RIVER_SLOT)
        const parties = declaredParties(state, RHYS, undefined, [siteTarget(RIVER_SLOT)])
        expect(banditBattlePlans(state, parties).map((p) => p.power.powerIndex)).toEqual([RUINED])
        campaign(RHYS, undefined, [siteTarget(RIVER_SLOT)], 3).apply(state)
        expect(ongoingCampaign(state).attackPool).toBe(1)
    })

    it("meets the Mountain's −1: 2 attack dice lose 3, so one becomes a defense die (R-5.5.3)", () => {
        const state = banditRampartTable(MOUNTAIN_SLOT)
        campaign(RHYS, undefined, [siteTarget(MOUNTAIN_SLOT)], 2).apply(state)
        expect(ongoingCampaign(state).attackPool).toBe(0)
        expect(ongoingCampaign(state).defensePool).toBe(2)
    })

    it('is locked, so never discarded at the end (R-5.5.8)', () => {
        const state = banditRampartTable(RIVER_SLOT)
        campaign(RHYS, undefined, [siteTarget(RIVER_SLOT)], 3).apply(state)
        expect(ongoingCampaign(state).discardAtEnd).toEqual([])
        new HydratedCampaignSacrifice(
            buildAction(CampaignSacrifice, {
                playerId: RHYS,
                sacrifice: 0,
                defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(state, 0)
            })
        ).apply(state)
        defendingSideChooses(state)
        if (state.campaign) {
            new HydratedCampaignResolveVictory(
                buildAction(CampaignResolveVictory, {
                    playerId: RHYS,
                    placements: [],
                    burnFavor: false
                })
            ).apply(state)
        }
        expect(state.campaign).toBeUndefined()
        expect(state.denizensAt(RIVER_SLOT)).toEqual([SPRAWLING_RAMPART])
    })

    it('a player who rules it may use it when its site is targeted', () => {
        const state = banditRampartTable(RIVER_SLOT, 'empire')
        expect(
            usableBattlePlans(
                state,
                DANA,
                BattlePlanSide.Defender,
                declaredParties(state, RHYS, DANA, [siteTarget(RIVER_SLOT)])
            ).map((p) => [p.cardId, p.powerIndex])
        ).toContainEqual([SPRAWLING_RAMPART, RUINED])
        campaign(RHYS, DANA, [siteTarget(RIVER_SLOT)], 3).apply(state)
        const before = ongoingCampaign(state).attackPool
        defend([{ cardId: SPRAWLING_RAMPART, powerIndex: RUINED }], DANA).apply(state)
        expect(ongoingCampaign(state).attackPool).toBe(before - 2)
    })

    it('does nothing when its site is not targeted', () => {
        const state = banditRampartTable(RIVER_SLOT, 'empire')
        state.getPlayerState(RHYS).siteId = PLAINS_SLOT
        campaign(RHYS, DANA, [siteTarget(PLAINS_SLOT)], 3).apply(state)
        const before = ongoingCampaign(state).attackPool
        defend([{ cardId: SPRAWLING_RAMPART, powerIndex: RUINED }], DANA).apply(state)
        expect(ongoingCampaign(state).attackPool).toBe(before)
    })

    it('Sprawling Rampart, the intact side, is no battle plan', () => {
        const state = banditRampartTable(RIVER_SLOT, 'empire')
        state.setEdificeRuined(SPRAWLING_RAMPART, false)
        const parties = declaredParties(state, RHYS, DANA, [siteTarget(RIVER_SLOT)])
        expect(
            usableBattlePlans(state, DANA, BattlePlanSide.Defender, parties).map((p) => p.cardId)
        ).not.toContain(SPRAWLING_RAMPART)
        expect(
            resolveBattlePlans(
                state,
                DANA,
                BattlePlanSide.Defender,
                [{ cardId: SPRAWLING_RAMPART, powerIndex: RUINED }],
                parties
            ).reason
        ).toBe('Bandit Rampart: that side of the card is face down')
    })
})
