import { assertExists } from '@tabletop/common'
import { bannerHolder } from '../util/oathkeeper.js'
import { Banner, Suit } from '../model/oathEnums.js'
import { BattlePlanSide, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { PowerQuestionKind } from '../model/question.js'
import { one, PowerChoiceKind, type ChoiceDomain } from '../util/powerChoice.js'
import { askQuestion } from '../util/questions.js'
import { giveFavor, usableFavor } from '../util/favor.js'
import { attackingSiteOf } from '../util/campaignSite.js'
import {
    registerBattlePlan,
    registerEffect,
    registerPersistent,
    chosen,
    type CampaignContext
} from './registry.js'
import { siteHolding } from '../util/access.js'
import { faceupSitesWithCardOfSuit, pawnSiteId, regionOfPawn } from './vocabulary.js'
import { nextActionIndex } from '../util/freeActions.js'
import { siteChoicesYouRule } from './choiceDomains.js'
import { opposingLeadId } from '../util/battlePlans.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { collectDefensePool } from '../util/campaign.js'
import { addCosts, favorNeeded } from '../util/powerCost.js'
import { extraBattlePlanCost } from '../util/persistent.js'

// "As defender, you're victorious now. At end, discard Hearts and Minds unless you hold the People's Favor." Defender. Cost: place 3 favor.
const HEARTS_AND_MINDS = 'denizen.hearth.hearts-and-minds'
registerBattlePlan(HEARTS_AND_MINDS, powerIndexOf(HEARTS_AND_MINDS, PowerTiming.BattlePlan), {
    hooks: {
        decidesVictor: true,
        onOutcome: (ctx) => {
            if (bannerHolder(ctx.state, Banner.PeoplesFavor) === ctx.playerId)
                return "Hearts and Minds: kept, its user holds the People's Favor"
            const campaign = ctx.state.campaign
            assertExists(campaign, 'an outcome hook runs inside a Campaign')
            campaign.discardAtEnd = [...campaign.discardAtEnd, HEARTS_AND_MINDS]
            return "Hearts and Minds: discarded at the end, its user not holding the People's Favor"
        }
    }
})

// "You cannot use other battle plans. If your enemy's pawn is at your site, give them one [favor] per
//  [defenseDie] in the pool. You're victorious now. Ignore killing warbands." Either side. Cost: place 1 favor.
const PEACE_ENVOY = 'denizen.order.peace-envoy'
function envoyPaysEnemy(
    state: HydratedOathGameState,
    playerId: string,
    campaign: CampaignContext
): string | undefined {
    const enemyId = opposingLeadId(campaign.parties, campaign.side)
    if (!enemyId) return undefined
    const mySite =
        playerId === campaign.parties.attackerPlayerId
            ? attackingSiteOf(state, playerId)
            : pawnSiteId(state, playerId)
    return pawnSiteId(state, enemyId) === mySite ? enemyId : undefined
}
registerBattlePlan(PEACE_ENVOY, powerIndexOf(PEACE_ENVOY, PowerTiming.BattlePlan), {
    hooks: {
        exclusive: true,
        decidesVictor: true,
        ignoreKills: true,
        // Its victory is bought with the whole payment: one favor per defense die, beyond its cost.
        reasonCannotUse: (ctx) => {
            if (!envoyPaysEnemy(ctx.state, ctx.playerId, ctx.campaign)) return undefined
            const pool =
                ctx.campaign.side === BattlePlanSide.Defender && ctx.state.campaign
                    ? ctx.state.campaign.defensePool
                    : collectDefensePool(ctx.state, ctx.campaign.parties)
            const cost = favorNeeded(
                addCosts(
                    ctx.power.cost,
                    extraBattlePlanCost(
                        ctx.state,
                        ctx.playerId,
                        ctx.campaign.parties,
                        ctx.campaign.side
                    )
                )
            )
            const left = usableFavor(ctx.state, ctx.playerId) - cost
            return left < pool
                ? `Peace Envoy: one favor per defense die is ${pool} favor beyond its cost, and you would have ${left}`
                : undefined
        },
        onUse: (ctx) => {
            const { campaign, playerId } = ctx
            assertExists(playerId, 'Peace Envoy has a cost, so the bandits never use it')
            if (!opposingLeadId(campaign.parties, campaign.side))
                return 'Peace Envoy: the bandits have no pawn to pay'
            const enemyId = envoyPaysEnemy(ctx.state, playerId, campaign)
            if (!enemyId) return 'Peace Envoy: the enemy pawn is elsewhere, so nothing is given'
            const given = Math.min(usableFavor(ctx.state, playerId), campaign.pools.defensePool)
            giveFavor(ctx.state, playerId, enemyId, given)
            return `Peace Envoy: gave ${enemyId} ${given} favor, one per defense die`
        }
    }
})

/** "Action: Campaign at <site>. Act as if your pawn is there. Spend no Supply and add your warbands there to your force." */
function campaignFrom(cardId: string, what: string, domain: ChoiceDomain) {
    registerEffect(cardId, powerIndexOf(cardId, PowerTiming.Action), {
        choices: [one(PowerChoiceKind.Site, { what, domain })],
        resolve: (ctx) => {
            const [site] = chosen(ctx, PowerChoiceKind.Site)
            const me = ctx.state.getPlayerState(ctx.playerId)
            const next = nextActionIndex(ctx.state)
            me.campaignAsIf = { siteId: site.siteId, atAction: next }
            me.freeCampaignAtAction = next
            return {
                summary: `${cardId}: the next action is a Campaign at ${site.siteId}, as if the pawn were there, for no Supply`
            }
        }
    })
}

// Wild Allies — "any site with a [suit:beast] card". Cost: place 1 secret.
campaignFrom('denizen.beast.wild-allies', 'a site with a beast card', (state) =>
    faceupSitesWithCardOfSuit(state, Suit.Beast).map((siteId) => ({
        kind: PowerChoiceKind.Site,
        siteId
    }))
)

// Captains — "any site you rule". Site card. Cost: place 1 favor.
campaignFrom('denizen.order.captains', 'a site you rule', siteChoicesYouRule)

// "If any of your warbands would be killed, place them on Hospital's site instead if you still rule it." Either side. Site card.
const HOSPITAL = 'denizen.hearth.hospital'
registerBattlePlan(HOSPITAL, powerIndexOf(HOSPITAL, PowerTiming.BattlePlan), {
    hooks: { redirectKillsTo: (ctx) => siteHolding(ctx.state, ctx.power.cardId) }
})

// "After a player takes any relics and their pawn is in your region, you may use this power to roll one
//  [defenseDie] per relic taken. If you roll no [shield]/[shield][shield], take the relics." Adviser. Cost: place 1 favor, place 1 secret.
const RELIC_THIEF = 'denizen.discord.relic-thief'
registerPersistent(RELIC_THIEF, powerIndexOf(RELIC_THIEF, PowerTiming.Persistent), {
    afterRelicsTaken: (ctx, takerId, relicCardIds) => {
        const takerRegion = regionOfPawn(ctx.state, takerId)
        const notes: string[] = []
        for (const owner of ctx.ownerIds) {
            if (owner === takerId) continue
            if (regionOfPawn(ctx.state, owner) !== takerRegion) continue
            const note = askQuestion(ctx.state, takerId, {
                kind: PowerQuestionKind.RelicThiefRoll,
                cardId: RELIC_THIEF,
                askedPlayerId: owner,
                powerIndex: ctx.power.powerIndex,
                takerPlayerId: takerId,
                relicCardIds: [...relicCardIds]
            })
            notes.push(note ?? `${owner} may roll for ${relicCardIds.join(', ')}`)
        }
        return notes.length ? `Relic Thief: ${notes.join('; ')}` : undefined
    }
})
