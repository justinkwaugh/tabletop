import { describe, expect, it } from 'vitest'
import { Color, type GameAction } from '@tabletop/common'
import { Campaign } from '../actions/campaign.js'
import { CampaignSacrifice } from '../actions/campaignSacrifice.js'
import { CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { battlePlanUse, siteTarget } from '../testing/choices.js'
import { ongoingCampaign } from '../testing/required.js'
import { ATTACKER, DEFENDER, campaign, finishCampaignSteps } from '../testing/steps.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const BOOK_BURNING = 'denizen.discord.book-burning'

const atRevision = OathRevision.EngineFixes2
const before = OathRevision.CardFixes1

/** The attacker, holding Book Burning, campaigns from c1 against the defender, whose pawn is there. */
function table(oathRevision: number, seed: number, secrets: { secrets: number; secretsFacedown: number }) {
    const s = testState(
        withChancellor([
            testPlayer({ playerId: ATTACKER, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 5, favor: 4, secrets: 1, warbandsOnBoard: { [ATTACKER]: 6 }, warbandsInPersonalBank: { [ATTACKER]: 6 }, advisers: [{ cardId: BOOK_BURNING, faceUp: true }] }),
            testPlayer({ playerId: DEFENDER, color: Color.Yellow, status: PlayerStatus.Exile, siteId: 'c1', favor: 3, warbandsOnBoard: {}, warbandsInPersonalBank: { [DEFENDER]: 6 }, ...secrets })
        ]),
        {
            oathRevision,
            warbandsBySite: { c1: { [DEFENDER]: 1 } },
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            prng: { seed, invocations: 0 }
        }
    )
    openTurn(s, ATTACKER)
    return s
}

const targets = [siteTarget('c1'), { kind: CampaignTargetKind.PawnAndFavor as const }]
const burningAttack = () => campaign({ plans: [battlePlanUse(BOOK_BURNING)], targets, attackDice: 6 })

const victorySeed = (() => {
    for (let seed = 1; seed < 80; seed++) {
        const s = table(atRevision, seed, { secrets: 1, secretsFacedown: 0 })
        burningAttack().apply(s)
        if (ongoingCampaign(s).swords > ongoingCampaign(s).defense) return seed
    }
    throw new Error('no seed gave a victory')
})()

function burned(oathRevision: number, secrets: { secrets: number; secretsFacedown: number }) {
    const s = table(oathRevision, victorySeed, secrets)
    burningAttack().apply(s)
    const { sacrifice, victory } = finishCampaignSteps(s)
    expect(sacrifice.metadata?.attackerVictorious).toBe(true)
    const defender = s.getPlayerState(DEFENDER)
    return { faceup: defender.secrets, facedown: defender.secretsFacedown, triggered: victory?.metadata?.triggered }
}

describe('Book Burning burns facedown secrets too, keeping one (R-7.1.2.a, revision 5)', () => {
    it('faceup and facedown secrets burn alike; a faceup one is kept', () => {
        const after = burned(atRevision, { secrets: 2, secretsFacedown: 2 })
        expect(after).toMatchObject({ faceup: 1, facedown: 0 })
        expect(after.triggered).toContain('Book Burning: defender burned 3 secrets')
    })

    it('with only facedown secrets, one facedown secret is kept', () => {
        expect(burned(atRevision, { secrets: 0, secretsFacedown: 3 })).toMatchObject({ faceup: 0, facedown: 1 })
    })

    it('with only faceup secrets, one faceup secret is kept', () => {
        expect(burned(atRevision, { secrets: 3, secretsFacedown: 0 })).toMatchObject({ faceup: 1, facedown: 0 })
    })

    it('a defender with no secrets loses none', () => {
        expect(burned(atRevision, { secrets: 0, secretsFacedown: 0 })).toMatchObject({ faceup: 0, facedown: 0 })
    })
})

describe('R-X.4 — before revision 5, Book Burning leaves facedown secrets', () => {
    it('every faceup secret burns and the facedown ones stay', () => {
        expect(burned(before, { secrets: 2, secretsFacedown: 2 })).toMatchObject({ faceup: 0, facedown: 2 })
    })

    it('a Campaign recorded with Book Burning replays unchanged, the facedown secrets kept', () => {
        const game = testGame([ATTACKER, DEFENDER])
        const start = table(before, victorySeed, { secrets: 2, secretsFacedown: 2 }).dehydrate()
        const steps: GameAction[] = [
            buildAction(Campaign, { playerId: ATTACKER, defender: { kind: 'player', playerId: DEFENDER }, targets, attackDice: 6, plans: [battlePlanUse(BOOK_BURNING)] }),
            buildAction(CampaignSacrifice, { playerId: ATTACKER, sacrifice: 0, defeatKills: [] }),
            buildAction(CampaignResolveVictory, { playerId: ATTACKER, placements: [], burnFavor: false })
        ]
        let recorded: OathProjectedState = structuredClone(start)
        const processed: GameAction[] = []
        for (const step of steps) {
            const result = engine.runNext(step, recorded, game)
            processed.push(...result.processedActions)
            recorded = result.updatedState
        }
        const defender = new HydratedOathGameState(recorded).getPlayerState(DEFENDER)
        expect(defender.secrets).toBe(0)
        expect(defender.secretsFacedown).toBe(2)

        let replayed = structuredClone(start)
        for (const action of processed) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
        expect(replayed).toEqual(recorded)
    })
})
