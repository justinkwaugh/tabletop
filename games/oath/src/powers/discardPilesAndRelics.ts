import { bannerHolder } from '../util/oathkeeper.js'
import { Banner, PlayerStatus } from '../model/oathEnums.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { visionsDrawnAfter } from '../data/visionsDrawnTrack.js'
import {
    one,
    optional,
    PowerChoiceKind,
    relicSlotChoicesAtYourSite,
    reliquarySlotChoices
} from '../util/powerChoice.js'
import { becomeCitizenByPower, visionDeposits } from '../util/citizenship.js'
import { sitesRuledBy } from '../util/rule.js'
import { giveBanner } from '../util/seize.js'
import { registerEffect, registerModifier, type EffectContext, chosen } from './registry.js'
import { gainWarbandsToBoard, pawnSiteId, regionOfPawn } from './vocabulary.js'
import { takeRelics, takeNotes, clearSiteRelicSlot, clearReliquarySlot } from '../util/relics.js'
import { otherRegionChoices } from './choiceDomains.js'
import { askQuestion } from '../util/questions.js'
import { PowerQuestionKind } from '../model/question.js'
import { siteLockedFor } from '../util/locked.js'

// "Action: Draw a relic and take it. Put any relic you hold except the Grand Scepter on the bottom of the relic deck."
// The relic to put down is chosen seeing the one drawn.
const FAE_MERCHANT = 'denizen.beast.fae-merchant'
registerEffect(FAE_MERCHANT, powerIndexOf(FAE_MERCHANT, PowerTiming.Action), {
    choices: [],
    hidden: () => ({ kind: 'relicDraw', count: 1 }),
    resolve: (ctx) => {
        const drawn = ctx.reveal?.kind === 'relics' ? ctx.reveal.relicCardIds[0] : undefined
        if (!drawn) return { summary: 'Fae Merchant: the relic deck is empty' }
        askQuestion(ctx.state, ctx.playerId, {
            kind: PowerQuestionKind.BottomRelic,
            cardId: FAE_MERCHANT,
            askedPlayerId: ctx.playerId,
            relicCardId: drawn
        })
        return {
            summary: 'Fae Merchant: drew a relic; one relic goes to the bottom of the relic deck',
            peeked: [drawn]
        }
    }
})

// "Action: Put a facedown relic at your site on the bottom of the relic deck to gain three warbands."
registerEffect(
    'denizen.hearth.relic-breaker',
    powerIndexOf('denizen.hearth.relic-breaker', PowerTiming.Action),
    {
        choices: [
            // Ancient Bloodline — a relic at a site its holder rules is locked for their enemies.
            one(PowerChoiceKind.RelicSlot, {
                what: 'a facedown relic at your site',
                domain: (state, playerId) =>
                    siteLockedFor(state, playerId, pawnSiteId(state, playerId))
                        ? []
                        : relicSlotChoicesAtYourSite(state, playerId)
            })
        ],
        // R-9.4 — the card never lets its user look, so the vault moves the relic by its slot.
        resolve: (ctx) => {
            const [slot] = chosen(ctx, PowerChoiceKind.RelicSlot)
            const here = pawnSiteId(ctx.state, ctx.playerId)
            clearSiteRelicSlot(ctx.state, here, slot.slotId)
            const gained = gainWarbandsToBoard(ctx.state, ctx.playerId, 3)
            return {
                summary: `Relic Breaker: the relic went to the bottom of the relic deck; gained ${gained} warbands`,
                relicSlotToBottom: slot.slotId
            }
        }
    }
)

// "Spend no Supply, but draw only one card (not three) from the bottom of your region's discard pile." Cost: place 1 secret.
registerModifier(
    'denizen.beast.mushrooms',
    powerIndexOf('denizen.beast.mushrooms', PowerTiming.Modifier),
    {
        hooks: {
            condition: (ctx) =>
                ctx.particulars?.drawFrom === 'discard'
                    ? undefined
                    : 'you are not searching a discard pile',
            supplyCost: () => 0,
            drawCount: () => 1,
            drawsFromBottom: true
        }
    }
)

// "Action: Peek at the top three cards of your region's discard pile."
registerEffect(
    'denizen.hearth.tavern-songs',
    powerIndexOf('denizen.hearth.tavern-songs', PowerTiming.Action),
    {
        choices: [],
        hidden: (ctx) => ({
            kind: 'discardPeek',
            region: regionOfPawn(ctx.state, ctx.playerId),
            count: 3
        }),
        resolve: (ctx) => {
            const seen = ctx.reveal?.kind === 'peek' ? ctx.reveal.cardIds : []
            const region = regionOfPawn(ctx.state, ctx.playerId)
            return {
                summary: `Tavern Songs: peeked at the top ${seen.length} cards of the ${region} discard pile`,
                peeked: seen
            }
        }
    }
)

// "Action: Peek at any one discard pile." Cost: place 1 secret.
registerEffect(
    'denizen.discord.scryer',
    powerIndexOf('denizen.discord.scryer', PowerTiming.Action),
    {
        choices: [one(PowerChoiceKind.Region, { what: 'the discard pile to peek at' })],
        hidden: (ctx) => {
            const [pick] = chosen(ctx, PowerChoiceKind.Region)
            return pick ? { kind: 'discardPeek', region: pick.region } : undefined
        },
        resolve: (ctx) => {
            const [pick] = chosen(ctx, PowerChoiceKind.Region)
            const seen = ctx.reveal?.kind === 'peek' ? ctx.reveal.cardIds : []
            return {
                summary: `Scryer: peeked at the ${pick.region} discard pile (${seen.length} cards)`,
                peeked: seen
            }
        }
    }
)

// "You may put all the cards you discard on the top or bottom of any one discard pile (even your region's)."
registerModifier(
    'denizen.beast.bracken',
    powerIndexOf('denizen.beast.bracken', PowerTiming.Modifier),
    {
        choices: [
            one(PowerChoiceKind.Region, { what: 'the pile your discards go to' }),
            optional(PowerChoiceKind.Yes, { what: 'under the pile rather than on top' })
        ],
        hooks: {
            discardTo: (ctx) => {
                const [pick] = chosen(ctx, PowerChoiceKind.Region)
                return pick
                    ? { region: pick.region, bottom: chosen(ctx, PowerChoiceKind.Yes).length > 0 }
                    : undefined
            }
        }
    }
)

// "Action: Take another region's discard pile and put it on top of your region's discard pile (even if empty)." Cost: place 1 favor.
registerEffect('denizen.nomad.convoys', powerIndexOf('denizen.nomad.convoys', PowerTiming.Action), {
    choices: [
        one(PowerChoiceKind.Region, {
            what: "another region's discard pile to take",
            domain: otherRegionChoices
        })
    ],
    resolve: (ctx) => {
        const [pick] = chosen(ctx, PowerChoiceKind.Region)
        const to = regionOfPawn(ctx.state, ctx.playerId)
        const moved = ctx.state.discardPileCounts[pick.region] ?? 0
        ctx.state.discardPileCounts[to] = (ctx.state.discardPileCounts[to] ?? 0) + moved
        ctx.state.discardPileCounts[pick.region] = 0
        // R-9.4
        const backs = { ...ctx.state.discardTopBackType }
        if (moved > 0 && backs[pick.region]) backs[to] = backs[pick.region]
        delete backs[pick.region]
        ctx.state.discardTopBackType = backs
        return {
            summary: `Convoys: moved the ${pick.region} discard pile (${moved} cards) onto the ${to} pile`,
            mergePiles: { from: pick.region, to }
        }
    }
})

// "Action: Draw the Vision closest to the top of the world deck. Play or discard it as if you searched." Cost: place 2 secrets.
registerEffect('denizen.nomad.oracle', powerIndexOf('denizen.nomad.oracle', PowerTiming.Action), {
    choices: [],
    hidden: () => ({ kind: 'worldDeckVision' }),
    resolve: (ctx) => {
        if (ctx.reveal?.kind !== 'vision')
            return { summary: 'Oracle: drawing the next Vision', opensSearch: true }
        const cardId = ctx.reveal.cardId
        if (!cardId) return { summary: 'Oracle: no Vision is left in the world deck' }
        // R-9.4 — the Vision may have been the top card, so the public top back follows the deck.
        ctx.state.topCardBackType = ctx.reveal.topCardBackType
        ctx.state.worldDeckExhausted = ctx.reveal.worldDeckExhausted
        ctx.state.getPlayerState(ctx.playerId).setHand([cardId])
        // R-2.7.1 — a Vision drawn moves the Visions Drawn marker, "as if you searched".
        ctx.state.visionsDrawn = visionsDrawnAfter(ctx.state.visionsDrawn, 1)
        return {
            summary: 'Oracle: drew the next Vision; keep it or discard it as if you had searched',
            opensSearch: true
        }
    }
})

function takeReliquaryRelic(
    ctx: EffectContext,
    slotId: string
): { relicCardId?: string; notes: string[] } {
    const relicCardId = ctx.reveal?.kind === 'relic' ? ctx.reveal.relicCardId : undefined
    clearReliquarySlot(ctx.state, slotId)
    if (!relicCardId) return { notes: [] }
    return { relicCardId, notes: takeRelics(ctx.state, ctx.playerId, [relicCardId]) }
}

function citizenshipWithRelic(
    cardId: string,
    name: string,
    condition: (ctx: EffectContext) => string | undefined,
    extra?: (ctx: EffectContext) => void
) {
    registerEffect(cardId, powerIndexOf(cardId, PowerTiming.WhenPlayed), {
        choices: [
            optional(PowerChoiceKind.Yes, { what: 'becoming a Citizen' }),
            optional(PowerChoiceKind.RelicSlot, {
                what: 'the Reliquary relic to take',
                domain: reliquarySlotChoices
            })
        ],
        hidden: (ctx) => {
            const [slot] = chosen(ctx, PowerChoiceKind.RelicSlot)
            return chosen(ctx, PowerChoiceKind.Yes).length > 0 && slot
                ? { kind: 'relicAtSlot', slotId: slot.slotId }
                : undefined
        },
        reasonCannotResolve: (ctx) => {
            if (chosen(ctx, PowerChoiceKind.Yes).length === 0) return undefined
            if (ctx.state.getPlayerState(ctx.playerId).status !== PlayerStatus.Exile)
                return 'only an Exile can become a Citizen'
            if (chosen(ctx, PowerChoiceKind.RelicSlot).length === 0)
                return `${name}: name the Reliquary relic to take`
            return condition(ctx)
        },
        resolve: (ctx) => {
            if (chosen(ctx, PowerChoiceKind.Yes).length === 0)
                return { summary: `${name}: stayed an Exile` }
            const [slot] = chosen(ctx, PowerChoiceKind.RelicSlot)
            extra?.(ctx)
            const c = becomeCitizenByPower(ctx.state, ctx.playerId)
            const relic = takeReliquaryRelic(ctx, slot.slotId)
            return {
                summary: `${name}: became a Citizen (${c.replacedCount} warbands became Imperial), took ${relic.relicCardId ?? 'a Reliquary relic'}${takeNotes(relic.notes)}; Supply refreshed, Act Phase over`,
                endsActPhase: true,
                pileDeposits: visionDeposits(c)
            }
        }
    })
}

// "When played, if you're an Exile and rule more sites than the Chancellor, you may become a Citizen — take any one Reliquary relic without peeking, …"
citizenshipWithRelic('denizen.discord.royal-ambitions', 'Royal Ambitions', (ctx) => {
    const chancellorId = ctx.state.chancellorId()
    const mine = sitesRuledBy(ctx.state, ctx.playerId).length
    const theirs = sitesRuledBy(ctx.state, chancellorId).length
    return mine > theirs
        ? undefined
        : `you rule ${mine} sites, not more than the Chancellor's ${theirs}`
})

// "When Played, you may give the Chancellor the Darkest Secret to become a Citizen — take any one Reliquary relic without peeking, …"
citizenshipWithRelic(
    'denizen.nomad.ancient-pact',
    'Ancient Pact',
    (ctx) => {
        return bannerHolder(ctx.state, Banner.DarkestSecret) === ctx.playerId
            ? undefined
            : 'you do not hold the Darkest Secret'
    },
    (ctx) => {
        // "Give the Chancellor the Darkest Secret" — given, not seized (R-10.11 and its Q&A).
        giveBanner(ctx.state, Banner.DarkestSecret, ctx.state.chancellorId())
    }
)
