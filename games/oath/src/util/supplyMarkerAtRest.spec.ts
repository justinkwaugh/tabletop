import { describe, expect, it } from 'vitest'
import { Color, type Game } from '@tabletop/common'
import { buildAction, defendingSideChooses, machineContext } from '../testing/actions.js'
import { openTurn, testBanners, testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import { slot, yes } from '../testing/choices.js'
import { playDrawnCard } from '../testing/steps.js'
import { ongoingCampaign } from '../testing/required.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { Banner, PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { MachineState } from '../definition/states.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { SearchPlay } from '../actions/searchResolve.js'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedCampaignSacrifice, CampaignSacrifice } from '../actions/campaignSacrifice.js'
import { HydratedCampaignResolveVictory, CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { OfferCitizenship } from '../actions/offerCitizenship.js'
import { ResolveCitizenshipOffer } from '../actions/resolveCitizenshipOffer.js'
import { SelfExile } from '../actions/selfExile.js'
import { ExileCitizen } from '../actions/exileCitizen.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { RestPhaseStateHandler } from '../stateHandlers/restPhase.js'
import { MAX_SUPPLY } from './rest.js'
import { OathRevision } from './revision.js'
import { reliquarySlotId } from './setup.js'
import '../powers/index.js'

const AT = OathRevision.EngineFixes20
const BEFORE = OathRevision.EngineFixes19

const HEIR = 'denizen.beast.long-lost-heir'
const AMBITIONS = 'denizen.discord.royal-ambitions'
const BALLOT = 'denizen.hearth.ballot-box'
const BEWITCH = 'denizen.arcane.bewitch'
const PACT = 'denizen.nomad.ancient-pact'
const MARTIAL = 'denizen.order.martial-culture'
const DRUM = 'relic.dragonskin-drum'
const FRIEND = 'denizen.nomad.faithful-friend'

/** The Chancellor's marker, which a Citizen refreshes to (R-4.3.3). */
const CHANCELLOR_SUPPLY = 6

type Seat = Partial<OathPlayerState>

interface Scene {
    revision: number
    dana?: Seat
    ann?: Seat
    rhys?: Seat
    state?: Partial<OathProjectedState>
}

/**
 * Dana, an Exile, has spent all 7 of their Supply this turn and rules c1 and c2. Ann is the
 * Chancellor, on 6 Supply, ruling h1. Rhys is an Exile at Dana's site.
 */
function scene({ revision, dana, ann, rhys, state }: Scene): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                favor: 4,
                secrets: 3,
                supply: 0,
                supplySpentThisTurn: MAX_SUPPLY,
                warbandsOnBoard: { dana: 4 },
                warbandsInPersonalBank: { dana: 6 },
                ...dana
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                favor: 2,
                secrets: 2,
                supply: CHANCELLOR_SUPPLY,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 12 },
                ...ann
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                favor: 4,
                secrets: 2,
                supply: 5,
                warbandsOnBoard: { rhys: 3 },
                warbandsInPersonalBank: { rhys: 5 },
                ...rhys
            })
        ],
        {
            oathRevision: revision,
            chancellorPlayerId: 'ann',
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 }, c2: { dana: 2 }, p1: {}, h1: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            ...state
        }
    )
    openTurn(s, 'dana')
    return s
}

/** R-4.3 — the Rest Phase's own entry, which runs R-4.3.1 to R-4.3.4. */
function rest(s: HydratedOathGameState): number {
    new RestPhaseStateHandler().enter(machineContext(s))
    return s.getPlayerState('dana').supply
}

function becameCitizen(s: HydratedOathGameState): HydratedOathGameState {
    expect(s.getPlayerState('dana').status).toBe(PlayerStatus.Citizen)
    // The refresh to full happened: the marker stands at the leftmost space.
    expect(s.getPlayerState('dana').supply).toBe(MAX_SUPPLY)
    return s
}

function longLostHeir(revision: number) {
    const s = scene({ revision })
    const play = playDrawnCard(s, HEIR, SearchPlay.Adviser, [yes], 'dana')
    expect(play.metadata?.endsActPhase).toBe(true)
    return becameCitizen(s)
}

function royalAmbitions(revision: number) {
    const s = scene({ revision })
    s.vault = testVaultWithRelics({ [reliquarySlotId(0)]: DRUM })
    playDrawnCard(s, AMBITIONS, SearchPlay.Adviser, [yes, slot(reliquarySlotId(0))], 'dana')
    expect(s.getPlayerState('dana').relicIds).toEqual([DRUM])
    return becameCitizen(s)
}

function ancientPact(revision: number) {
    const s = scene({
        revision,
        state: { banners: testBanners({ [Banner.DarkestSecret]: 'dana' }) }
    })
    s.vault = testVaultWithRelics({ [reliquarySlotId(0)]: DRUM })
    playDrawnCard(s, PACT, SearchPlay.Adviser, [yes, slot(reliquarySlotId(0))], 'dana')
    return becameCitizen(s)
}

function ballotBox(revision: number) {
    const s = scene({
        revision,
        state: {
            denizensBySite: { c1: [BALLOT], c2: [], p1: [], h1: [] },
            banners: testBanners({ [Banner.PeoplesFavor]: 'dana' })
        }
    })
    const use = new HydratedUseActionPower(
        buildAction(UseActionPower, { playerId: 'dana', cardId: BALLOT, powerIndex: 0 })
    )
    use.apply(s)
    expect(use.metadata?.endsActPhase).toBe(true)
    return becameCitizen(s)
}

function bewitch(revision: number) {
    const s = scene({ revision })
    playDrawnCard(s, BEWITCH, SearchPlay.Site, [yes], 'dana')
    return becameCitizen(s)
}

/** Dana defeats Rhys, another Exile, with Martial Culture (a seed that gives the victory). */
function martialCulture(revision: number) {
    for (let seed = 1; seed < 40; seed++) {
        const s = scene({
            revision,
            // The Campaign spends the last 2 of the 7 (R-5.5.1).
            dana: { supply: 2, supplySpentThisTurn: 5, advisers: [{ cardId: MARTIAL, faceUp: true }] },
            state: { prng: { seed, invocations: 0 } }
        })
        new HydratedCampaign(
            buildAction(Campaign, {
                playerId: 'dana',
                defender: { kind: 'player', playerId: 'rhys' },
                targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
                attackDice: 4,
                plans: [{ cardId: MARTIAL, powerIndex: powerIndexOf(MARTIAL, PowerTiming.BattlePlan) }]
            })
        ).apply(s)
        expect(s.getPlayerState('dana').supply).toBe(0)
        if (!(ongoingCampaign(s).swords > ongoingCampaign(s).defense)) continue
        new HydratedCampaignSacrifice(
            buildAction(CampaignSacrifice, {
                playerId: 'dana',
                sacrifice: 0,
                defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0)
            })
        ).apply(s)
        defendingSideChooses(s)
        const victory = new HydratedCampaignResolveVictory(
            buildAction(CampaignResolveVictory, { playerId: 'dana', placements: [], burnFavor: false })
        )
        victory.apply(s)
        expect(victory.metadata?.endsActPhase).toBe(true)
        return becameCitizen(s)
    }
    throw new Error('no seed gave Dana the victory')
}

const REFRESHES_TO_FULL: [string, (revision: number) => HydratedOathGameState][] = [
    ['Long-Lost Heir', longLostHeir],
    ['Royal Ambitions', royalAmbitions],
    ['Ancient Pact', ancientPact],
    ['Ballot Box', ballotBox],
    ['Bewitch', bewitch],
    ['Martial Culture', martialCulture]
]

describe('R-4.3.4 — a refresh to full on your own turn is saved at the Rest (revision 24)', () => {
    it.each(REFRESHES_TO_FULL)(
        '%s after all 7 Supply is spent: the new Citizen rests on 7, not the Chancellor’s 6',
        (_name, play) => {
            const s = play(AT)
            // R-4.3.3 + R-4.3.4: the Chancellor's 6, plus the 7 on the marker, capped at the leftmost space.
            expect(rest(s)).toBe(MAX_SUPPLY)
        }
    )

    it('Long-Lost Heir never rests the marker down from 7, whatever the Chancellor’s Supply', () => {
        for (let chancellor = 0; chancellor <= MAX_SUPPLY; chancellor++) {
            const s = longLostHeir(AT)
            s.getPlayerState('ann').supply = chancellor
            expect(rest(s)).toBe(MAX_SUPPLY)
        }
    })
})

describe('R-4.3.4 — a Supply gain then a spend saves the marker left, at both revisions', () => {
    it.each([AT, BEFORE])('Faithful Friend’s 4, 3 of them spent: 4 + 1 (revision %i)', (revision) => {
        // R-4.3.3 — 2 banked warbands give an Exile 4 Supply.
        const s = scene({ revision, dana: { warbandsInPersonalBank: { dana: 2 } } })
        playDrawnCard(s, FRIEND, SearchPlay.Adviser, undefined, 'dana')
        const dana = s.getPlayerState('dana')
        // From 0: the When Played gain moved the marker.
        expect(dana.supply).toBe(4)
        dana.spendSupply(3)
        expect(rest(s)).toBe(4 + 1)
    })
})

describe('before revision 24 the saving is the turn’s Supply less what it spent (R-X.4)', () => {
    it.each(REFRESHES_TO_FULL)(
        '%s after all 7 Supply is spent: the new Citizen rests on the Chancellor’s 6, as recorded',
        (_name, play) => {
            const s = play(BEFORE)
            expect(rest(s)).toBe(CHANCELLOR_SUPPLY)
        }
    )

    it('keeps the stored player’s shape at both revisions', () => {
        const keys = (revision: number) => {
            const s = longLostHeir(revision)
            rest(s)
            return Object.keys(s.dehydrate().players[0]).sort()
        }
        expect(keys(AT)).toEqual(keys(BEFORE))
        expect(keys(AT)).toEqual(expect.arrayContaining(['supplyAtTurnStart', 'supplySpentThisTurn']))
    })
})

/** Through the engine: the turn opens in Dana's Act Phase, all 7 Supply already spent. */
function inActPhase(scene: HydratedOathGameState): OathProjectedState {
    const state = scene.dehydrate()
    state.machineState = MachineState.ActPhase
    state.activePlayerIds = ['dana']
    state.turnManager = {
        series: [{ type: 'turn', playerId: 'dana', start: 0 }],
        turnOrder: ['dana', 'ann', 'rhys'],
        turnCounts: { dana: 0, ann: 0, rhys: 0 }
    }
    return state
}

const GAME: Game = testGame(['dana', 'ann', 'rhys'])

/** R-6.6.1 — the Grand Scepter's holder knows the Reliquary, so it holds a real relic. */
const RELIQUARY: Partial<OathProjectedState> = {
    reliquary: [{ slotId: reliquarySlotId(0) }],
    vault: testVaultWithRelics({ [reliquarySlotId(0)]: DRUM })
}

function supplyOf(state: OathProjectedState, playerId: string): number {
    const player = state.players.find((p) => p.playerId === playerId)
    if (!player) throw new Error(`no seat ${playerId}`)
    return player.supply
}

/**
 * R-6.6.2 and R-6.8 end the Act Phase; with no Rest power to use, the Rest resolves itself (R-4.3-H1)
 * and the turn passes to Ann.
 */
function restedAndPassed(state: OathProjectedState): OathProjectedState {
    expect(state.turnManager.turnCounts['dana']).toBe(1)
    expect(state.activePlayerIds).toEqual(['ann'])
    return state
}

/** R-6.6.1 — "any Exile (including yourself)": Dana holds the Grand Scepter and offers to themselves. */
function selfOffer(revision: number): OathProjectedState {
    let state = inActPhase(
        scene({
            revision,
            dana: { relicIds: [GRAND_SCEPTER_ID] },
            state: RELIQUARY
        })
    )
    state = engine.runNext(
        buildAction(OfferCitizenship, {
            playerId: 'dana',
            exilePlayerId: 'dana',
            reliquarySlotId: reliquarySlotId(0)
        }),
        state,
        GAME
    ).updatedState
    state = engine.runNext(
        buildAction(ResolveCitizenshipOffer, { playerId: 'dana', granted: true }),
        state,
        GAME
    ).updatedState
    expect(state.players[0].status).toBe(PlayerStatus.Citizen)
    return restedAndPassed(state)
}

/** R-6.8 — Dana, a Citizen, exiles themselves; Ann holds the Grand Scepter (R-6.8-H1). */
function selfExile(revision: number): OathProjectedState {
    let state = inActPhase(
        scene({
            revision,
            dana: {
                status: PlayerStatus.Citizen,
                // R-6.8 — Self-Exile costs 7 favor (no title or banner).
                favor: 8,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 },
                // R-6.8 replaces the 4 Imperial warbands from this bank: 6 stay, an Exile's 5 Supply (R-4.3.3).
                warbandsInPersonalBank: { dana: 10 }
            },
            ann: { relicIds: [GRAND_SCEPTER_ID] },
            state: RELIQUARY
        })
    )
    state = engine.runNext(buildAction(SelfExile, { playerId: 'dana' }), state, GAME).updatedState
    expect(state.players[0].status).toBe(PlayerStatus.Exile)
    return restedAndPassed(state)
}

describe('R-4.3.4 through the engine: Citizenship and exile on your own turn', () => {
    it('an offer to yourself accepted after all 7 Supply is spent rests on 7 at revision 24', () => {
        expect(supplyOf(selfOffer(AT), 'dana')).toBe(MAX_SUPPLY)
    })

    it('… and on the Chancellor’s 6 before it', () => {
        expect(supplyOf(selfOffer(BEFORE), 'dana')).toBe(CHANCELLOR_SUPPLY)
    })

    it('Self-Exile after all 7 Supply is spent rests on 7 at revision 24 (R-6.8)', () => {
        expect(supplyOf(selfExile(AT), 'dana')).toBe(MAX_SUPPLY)
    })

    it('… and on the Exile band’s 5 before it', () => {
        const state = selfExile(BEFORE)
        const bank = Object.values(state.players[0].warbandsInPersonalBank).reduce((n, c) => n + c, 0)
        expect(bank).toBe(6)
        expect(supplyOf(state, 'dana')).toBe(5)
    })

    it.each([AT, BEFORE])(
        'exiled on the Chancellor’s turn (R-6.7), the marker at 7 rests on 7 on their own turn (revision %i)',
        (revision) => {
            const s = scene({
                revision,
                dana: {
                    status: PlayerStatus.Citizen,
                    supply: 2,
                    supplySpentThisTurn: 0,
                    warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 },
                    warbandsInPersonalBank: { dana: 10 }
                },
                ann: { favor: 10, relicIds: [GRAND_SCEPTER_ID] },
                state: RELIQUARY
            })
            let state = s.dehydrate()
            state.machineState = MachineState.ActPhase
            state.activePlayerIds = ['ann']
            state.turnManager = {
                series: [{ type: 'turn', playerId: 'ann', start: 0 }],
                turnOrder: ['ann', 'dana', 'rhys'],
                turnCounts: { dana: 0, ann: 0, rhys: 0 }
            }
            state = engine.runNext(
                buildAction(ExileCitizen, { playerId: 'ann', citizenPlayerId: 'dana' }),
                state,
                GAME
            ).updatedState
            expect(supplyOf(state, 'dana')).toBe(MAX_SUPPLY)

            // Ann's Rest, then Dana's Wake, resolve themselves (R-4.3-H1, R-4.1).
            state = engine.runNext(buildAction(EndActPhase, { playerId: 'ann' }), state, GAME).updatedState
            expect(state.machineState).toBe(MachineState.ActPhase)
            expect(state.activePlayerIds).toEqual(['dana'])

            state = engine.runNext(buildAction(EndActPhase, { playerId: 'dana' }), state, GAME).updatedState
            expect(state.activePlayerIds).toEqual(['rhys'])
            expect(supplyOf(state, 'dana')).toBe(MAX_SUPPLY)
        }
    )
})
