import { assertExists } from '@tabletop/common'
import { Suit } from '../model/oathEnums.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { suitOf } from '../data/cardRegistry.js'
import { gainSupply } from '../util/rest.js'
import { citizenshipEndsActPhase } from '../util/citizenship.js'
import { one, optional, PowerChoiceKind, type ChoiceDomain } from '../util/powerChoice.js'
import { registerEffect, type EffectContext, chosen } from './registry.js'
import {
    burnSecretsFromDarkestSecret,
    burnSecretsFromPlayer,
    discardAdviser,
    faceupSitesInYourRegion,
    gainFavorFromBank,
    gainSecrets,
    killWarbandsAtSite,
    killWarbandsOnBoard,
    moveAdviserToSite,
    otherPlayersAtYourSite,
    placeSecretsOnDarkestSecret,
    rollDefenseShields,
    regionOfPawn,
    siteHasRoom,
    takeFavorFromPlayer,
    takeSecretsFromPlayer,
    denizensOnMap,
    moveFavorBetweenBanks,
    moveWarbandsBoardToSite,
    moveWarbandsSiteToBoard,
    favorObtainableFromPicks,
    discardDenizensAtSites
} from './vocabulary.js'
import { rulesSite, rulingWarbandOwners, sitesRuledBy, warbandsFreeToLeave } from '../util/rule.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { totalWarbands, countOf, soleOwnerOf } from '../util/warbands.js'
import { playerChoicesAtYourSite, siteChoicesYouRule } from './choiceDomains.js'
import { RerolledRollKind } from '../model/question.js'
import { offerReroll, settleRoll } from '../util/reroll.js'
import { isLockedFor, reasonCannotMoveCardTo } from '../util/locked.js'
import { categoryAt } from '../util/sitePowers.js'
import { siteHolding } from '../util/access.js'

const anyPlayer: ChoiceDomain = (state) =>
    state.players.map((p) => ({ kind: PowerChoiceKind.Player, playerId: p.playerId }))

const sitesInYourRegion: ChoiceDomain = (state, playerId) =>
    faceupSitesInYourRegion(state, playerId).map((siteId) => ({
        kind: PowerChoiceKind.Site,
        siteId
    }))

// "Action: Gain 2 Supply."
registerEffect(
    'denizen.hearth.wayside-inn',
    powerIndexOf('denizen.hearth.wayside-inn', PowerTiming.Action),
    {
        choices: [],
        resolve: (ctx) => {
            const credited = gainSupply(ctx.state, ctx.playerId, 2)
            return { summary: `gained ${credited} Supply` }
        }
    }
)

// "Action: Place [secret] from the shared bank on the Darkest Secret."
registerEffect(
    'denizen.hearth.storyteller',
    powerIndexOf('denizen.hearth.storyteller', PowerTiming.Action),
    {
        choices: [],
        resolve: (ctx) => {
            placeSecretsOnDarkestSecret(ctx.state, 1)
            return { summary: 'placed a secret on the Darkest Secret' }
        }
    }
)

// "Action: Take [favor] from a player whose pawn is at your site."
registerEffect(
    'denizen.hearth.charming-friend',
    powerIndexOf('denizen.hearth.charming-friend', PowerTiming.Action),
    {
        choices: [
            one(PowerChoiceKind.Player, {
                what: 'a player at your site',
                domain: playerChoicesAtYourSite
            })
        ],
        resolve: (ctx) => {
            const [target] = chosen(ctx, PowerChoiceKind.Player)
            const taken = takeFavorFromPlayer(ctx.state, ctx.playerId, target.playerId, 1)
            return {
                summary: `took ${taken} favor from ${target.playerId}`,
                targetPlayerId: target.playerId
            }
        }
    }
)

// "Action: Gain [secret]."
registerEffect('denizen.arcane.tutor', powerIndexOf('denizen.arcane.tutor', PowerTiming.Action), {
    choices: [],
    resolve: (ctx) => {
        gainSecrets(ctx.state, ctx.playerId, 1)
        return { summary: 'gained a secret' }
    }
})

// "Action: Take [favor] from any one favor bank."
registerEffect(
    'denizen.arcane.spirit-snare',
    powerIndexOf('denizen.arcane.spirit-snare', PowerTiming.Action),
    {
        choices: [one(PowerChoiceKind.FavorBank, { what: 'a favor bank' })],
        resolve: (ctx) => {
            const [bank] = chosen(ctx, PowerChoiceKind.FavorBank)
            const gained = gainFavorFromBank(ctx.state, ctx.playerId, bank.suit, 1)
            return { summary: `took ${gained} favor from the ${bank.suit} bank` }
        }
    }
)

// "Action: Gain [favor][favor][favor][favor] from any favor bank or banks."
registerEffect(
    'denizen.arcane.alchemist',
    powerIndexOf('denizen.arcane.alchemist', PowerTiming.Action),
    {
        choices: Array.from({ length: 4 }, () =>
            optional(PowerChoiceKind.FavorBank, { what: 'a favor bank' })
        ),
        // R-7.1.3 — "Gain four": as many as the banks can give, not fewer by choice.
        reasonCannotResolve: (ctx) => {
            const picks = chosen(ctx, PowerChoiceKind.FavorBank).map((b) => b.suit)
            const inBanks = Object.values(ctx.state.favorBank).reduce((n, v) => n + v, 0)
            const required = Math.min(4, inBanks)
            const obtainable = favorObtainableFromPicks(ctx.state, picks)
            return obtainable < required
                ? `Alchemist gains four favor: the banks named yield ${obtainable}, and ${required} can be had`
                : undefined
        },
        resolve: (ctx) => {
            let gained = 0
            for (const bank of chosen(ctx, PowerChoiceKind.FavorBank)) {
                gained += gainFavorFromBank(ctx.state, ctx.playerId, bank.suit, 1)
            }
            return { summary: `gained ${gained} favor from the chosen banks` }
        }
    }
)

// "Action: Gain [secret], then end your Act Phase."
registerEffect(
    'denizen.arcane.wizard-school',
    powerIndexOf('denizen.arcane.wizard-school', PowerTiming.Action),
    {
        choices: [],
        resolve: (ctx) => {
            gainSecrets(ctx.state, ctx.playerId, 1)
            return {
                summary: 'gained a secret and ended the Act Phase',
                endsActPhase: citizenshipEndsActPhase(ctx.state, ctx.playerId)
            }
        }
    }
)

// "Action: Place [secret] from the shared bank on the Darkest Secret, or burn
// [secret] from the Darkest Secret."
registerEffect(
    'denizen.arcane.forgotten-vault',
    powerIndexOf('denizen.arcane.forgotten-vault', PowerTiming.Action),
    {
        choices: [optional(PowerChoiceKind.Yes, { what: 'burning instead of placing' })],
        resolve: (ctx) => {
            if (chosen(ctx, PowerChoiceKind.Yes).length > 0) {
                const burned = burnSecretsFromDarkestSecret(ctx.state, 1)
                return { summary: `burned ${burned} secret from the Darkest Secret` }
            }
            placeSecretsOnDarkestSecret(ctx.state, 1)
            return { summary: 'placed a secret on the Darkest Secret' }
        }
    }
)

// "Action: Kill one warband (even yours) on any one board."
registerEffect('denizen.beast.wolves', powerIndexOf('denizen.beast.wolves', PowerTiming.Action), {
    choices: [one(PowerChoiceKind.Player, { what: 'a board', domain: anyPlayer })],
    resolve: (ctx) => {
        const [target] = chosen(ctx, PowerChoiceKind.Player)
        const { owner, killed } = killWarbandsOnBoard(ctx.state, target.playerId, 1)
        return {
            summary: killed
                ? `killed a warband on ${target.playerId}'s board`
                : `${target.playerId}'s board held no warbands`,
            targetPlayerId: target.playerId,
            warbandOwner: owner
        }
    }
})

// "Action: Take [secret] from a player whose pawn is at your site. You cannot
// take their last [secret]."
registerEffect(
    'denizen.discord.sleight-of-hand',
    powerIndexOf('denizen.discord.sleight-of-hand', PowerTiming.Action),
    {
        choices: [
            one(PowerChoiceKind.Player, {
                what: 'a player at your site',
                domain: playerChoicesAtYourSite
            })
        ],
        resolve: (ctx) => {
            const [target] = chosen(ctx, PowerChoiceKind.Player)
            const taken = takeSecretsFromPlayer(ctx.state, ctx.playerId, target.playerId, 1, 1)
            return {
                summary: `took ${taken} secret from ${target.playerId}`,
                targetPlayerId: target.playerId
            }
        }
    }
)

// "Action: Roll 4[defenseDie] and take X[favor] equal to the total [shield]
// result from any one favor bank."
registerEffect(
    'denizen.discord.gambling-hall',
    powerIndexOf('denizen.discord.gambling-hall', PowerTiming.Action),
    {
        choices: [one(PowerChoiceKind.FavorBank, { what: 'a favor bank' })],
        resolve: (ctx) => {
            const [bank] = chosen(ctx, PowerChoiceKind.FavorBank)
            const shields = rollDefenseShields(ctx.state.getProtectedPrng(), 4)
            const roll = { kind: RerolledRollKind.GamblingHall as const, bank: bank.suit, shields }
            // Jinx — the favor waits on the reroll's answer.
            if (offerReroll(ctx.state, ctx.playerId, ctx.playerId, roll)) {
                return { summary: `rolled ${shields} shields; Jinx may reroll them`, rolled: true }
            }
            return { summary: settleRoll(ctx.state, ctx.playerId, roll), rolled: true }
        }
    }
)

// "Action: Discard a faceup adviser of a player whose pawn is at your site."
registerEffect(
    'denizen.discord.assassin',
    powerIndexOf('denizen.discord.assassin', PowerTiming.Action),
    {
        choices: [
            one(PowerChoiceKind.Player, {
                what: 'a player at your site',
                domain: playerChoicesAtYourSite
            }),
            one(PowerChoiceKind.Card, {
                what: "one of that player's faceup advisers",
                // R-7.2.2 — a locked adviser cannot be discarded.
                domain: (state, playerId) =>
                    otherPlayersAtYourSite(state, playerId).flatMap((id) =>
                        state
                            .getPlayerState(id)
                            .faceupAdviserIds()
                            .filter((cardId) => !isLockedFor(state, playerId, cardId))
                            .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))
                    )
            })
        ],
        reasonCannotResolve: (ctx) => {
            const [target] = chosen(ctx, PowerChoiceKind.Player)
            const [card] = chosen(ctx, PowerChoiceKind.Card)
            const holds = ctx.state.getPlayerState(target.playerId).isFaceupAdviser(card.cardId)
            return holds
                ? undefined
                : `${card.cardId} is not a faceup adviser of ${target.playerId}`
        },
        resolve: (ctx) => {
            const [target] = chosen(ctx, PowerChoiceKind.Player)
            const [card] = chosen(ctx, PowerChoiceKind.Card)
            return {
                summary: `discarded ${target.playerId}'s adviser ${card.cardId}`,
                targetPlayerId: target.playerId,
                pileDeposits: discardAdviser(
                    ctx.state,
                    ctx.playerId,
                    target.playerId,
                    card.cardId,
                    regionOfPawn(ctx.state, ctx.playerId)
                )
            }
        }
    }
)

// "Action: Gain [secret]."
registerEffect('denizen.nomad.elders', powerIndexOf('denizen.nomad.elders', PowerTiming.Action), {
    choices: [],
    resolve: (ctx) => {
        gainSecrets(ctx.state, ctx.playerId, 1)
        return { summary: 'gained a secret' }
    }
})

// "Action: Move a faceup [suit:nomad] card from any player's advisers to any site."
registerEffect(
    'denizen.nomad.resettle',
    powerIndexOf('denizen.nomad.resettle', PowerTiming.Action),
    {
        choices: [
            // R-7.2.1, R-7.2.2 — never an adviser-only or locked card.
            one(PowerChoiceKind.Card, {
                what: "a faceup Nomad adviser of any player's",
                domain: (state, playerId) =>
                    state.players.flatMap((p) =>
                        p
                            .faceupAdviserIds()
                            .filter(
                                (cardId) =>
                                    suitOf(cardId) === Suit.Nomad &&
                                    reasonCannotMoveCardTo(state, playerId, cardId, 'site') ===
                                        undefined
                            )
                            .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))
                    )
            }),
            // R-11.10 — a full Great Slum takes it once a card there is discarded first.
            one(PowerChoiceKind.Site, {
                what: 'a site with room, or the Great Slum',
                domain: (state) =>
                    state
                        .faceupSiteIds()
                        .filter(
                            (siteId) =>
                                siteHasRoom(state, siteId) ||
                                categoryAt(state, siteId) === 'greatSlum'
                        )
                        .map((siteId) => ({ kind: PowerChoiceKind.Site, siteId }))
            }),
            optional(PowerChoiceKind.Card, {
                what: 'a denizen at the Great Slum to discard first',
                domain: (state, playerId) =>
                    state
                        .faceupSiteIds()
                        .filter((siteId) => categoryAt(state, siteId) === 'greatSlum')
                        .flatMap((siteId) => state.denizensAt(siteId))
                        .filter((cardId) => !isLockedFor(state, playerId, cardId))
                        .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))
            })
        ],
        reasonCannotResolve: (ctx) => {
            const [site] = chosen(ctx, PowerChoiceKind.Site)
            const [, first] = chosen(ctx, PowerChoiceKind.Card)
            if (first && siteHolding(ctx.state, first.cardId) !== site.siteId) {
                return `${first.cardId} is not at ${site.siteId}`
            }
            return siteHasRoom(ctx.state, site.siteId) || first
                ? undefined
                : `${site.siteId} has no room for another denizen`
        },
        resolve: (ctx) => {
            const [card, first] = chosen(ctx, PowerChoiceKind.Card)
            const [site] = chosen(ctx, PowerChoiceKind.Site)
            const owner = ctx.state.adviserHolderOf(card.cardId)
            assertExists(owner, `${card.cardId} is a faceup adviser`)
            const { discarded, pileDeposits } = first
                ? discardDenizensAtSites(
                      ctx.state,
                      ctx.playerId,
                      [site.siteId],
                      (id) => id === first.cardId,
                      ctx.power.cardId
                  )
                : { discarded: [], pileDeposits: [] }
            moveAdviserToSite(ctx.state, owner.playerId, card.cardId, site.siteId)
            return {
                summary: `${discarded.length ? `discarded ${discarded[0]} first; ` : ''}moved ${card.cardId} from ${owner.playerId}'s advisers to ${site.siteId}`,
                targetPlayerId: owner.playerId,
                pileDeposits
            }
        }
    }
)

// "Action: Each player burns all their [secret] except their last."
registerEffect(
    'denizen.nomad.ancient-binding',
    powerIndexOf('denizen.nomad.ancient-binding', PowerTiming.Action),
    {
        choices: [],
        resolve: (ctx) => {
            let burned = 0
            for (const p of ctx.state.players) {
                // "(The only secret you keep is the one here)": the actor keeps none on their board.
                const keepFaceup =
                    p.playerId === ctx.playerId ? 0 : Math.max(0, 1 - p.secretsFacedown)
                burned += burnSecretsFromPlayer(
                    ctx.state,
                    p.playerId,
                    Math.max(0, p.secrets - keepFaceup)
                )
            }
            return { summary: `every player burned down to one secret (${burned} burned)` }
        }
    }
)

// "Action: Kill two warbands (even yours) at any one site in your region."
registerEffect(
    'denizen.order.siege-engines',
    powerIndexOf('denizen.order.siege-engines', PowerTiming.Action),
    {
        choices: [
            one(PowerChoiceKind.Site, { what: 'a site in your region', domain: sitesInYourRegion })
        ],
        resolve: (ctx) => {
            const [site] = chosen(ctx, PowerChoiceKind.Site)
            const killed = killWarbandsAtSite(ctx.state, site.siteId, 2)
            const total = totalWarbands(killed)
            return {
                summary: `killed ${total} warbands at ${site.siteId}`,
                warbandOwner: soleOwnerOf(killed)
            }
        }
    }
)

// "Action: Move a total of X[favor] from any favor banks to the [suit:beast] bank. X is the number of [suit:beast] cards on the map."
registerEffect(
    'denizen.beast.memory-of-nature',
    powerIndexOf('denizen.beast.memory-of-nature', PowerTiming.Action),
    {
        choices: Array.from({ length: 8 }, () =>
            optional(PowerChoiceKind.FavorBank, { what: 'a source bank' })
        ),
        reasonCannotResolve: (ctx) => {
            const x = denizensOnMap(ctx.state, Suit.Beast).length
            const picks = chosen(ctx, PowerChoiceKind.FavorBank)
            if (picks.length > x)
                return `${picks.length} favor named to move, but only ${x} beast cards are on the map`
            if (picks.some((b) => b.suit === Suit.Beast))
                return 'the beast bank cannot be a source for itself'
            // R-7.1.3 — "Move a total of X": all X if the other banks hold them.
            const elsewhere = Object.entries(ctx.state.favorBank)
                .filter(([suit]) => suit !== Suit.Beast)
                .reduce((n, [, v]) => n + v, 0)
            const required = Math.min(x, elsewhere)
            const obtainable = favorObtainableFromPicks(
                ctx.state,
                picks.map((b) => b.suit)
            )
            if (obtainable < required) {
                return `Memory of Nature moves ${x} favor: the banks named yield ${obtainable}, and ${required} can be moved`
            }
            return undefined
        },
        resolve: (ctx) => {
            let moved = 0
            for (const bank of chosen(ctx, PowerChoiceKind.FavorBank)) {
                moved += moveFavorBetweenBanks(ctx.state, bank.suit, Suit.Beast, 1)
            }
            return { summary: `moved ${moved} favor to the beast bank` }
        }
    }
)

// "Action: Move any warbands to and from your board and any sites you rule (except the last warband from a site)."
registerEffect(
    'denizen.order.messenger',
    powerIndexOf('denizen.order.messenger', PowerTiming.Action),
    {
        choices: Array.from({ length: 4 }, (_, i) => [
            i === 0
                ? one(PowerChoiceKind.Warbands, {
                      what: 'warbands to move',
                      domain: messengerSources,
                      sequential: true
                  })
                : optional(PowerChoiceKind.Warbands, {
                      what: 'more warbands to move',
                      domain: messengerSources,
                      sequential: true
                  }),
            optional(PowerChoiceKind.Site, {
                what: 'a site you rule to move them to',
                domain: siteChoicesYouRule,
                sequential: true
            })
        ]).flat(),
        reasonCannotResolve: (ctx) => messengerMovesOnCopy(ctx).reason,
        stateAfter: (ctx) => messengerMovesOnCopy(ctx).state,
        resolve: (ctx) => ({
            summary: applyMessengerMoves(ctx.state, ctx.playerId, ctx.choices).summary
        })
    }
)

// Function declarations: the registration above reaches them at module load, inside a `const`'s temporal dead zone.
function messengerSources(
    ...[state, playerId]: Parameters<ChoiceDomain>
): ReturnType<ChoiceDomain> {
    const owners = rulingWarbandOwners(state, playerId)
    const player = state.getPlayerState(playerId)
    const out: ReturnType<ChoiceDomain> = []
    for (const owner of owners) {
        const onBoard = countOf(player.warbandsOnBoard, owner)
        if (onBoard > 0) {
            out.push({
                kind: PowerChoiceKind.Warbands,
                group: { at: { kind: 'board', playerId }, owner, count: onBoard }
            })
        }
    }
    for (const siteId of sitesRuledBy(state, playerId)) {
        for (const owner of owners) {
            // "except the last warband from a site"
            const free = warbandsFreeToLeave(state, playerId, siteId, owner)
            if (free > 0) {
                out.push({
                    kind: PowerChoiceKind.Warbands,
                    group: { at: { kind: 'site', siteId }, owner, count: free }
                })
            }
        }
    }
    return out
}

function messengerMovesOnCopy(ctx: EffectContext): {
    state: HydratedOathGameState
    reason?: string
} {
    const copy = new HydratedOathGameState(ctx.state.dehydrate())
    return { state: copy, reason: applyMessengerMoves(copy, ctx.playerId, ctx.choices).reason }
}

function applyMessengerMoves(
    state: EffectContext['state'],
    playerId: string,
    choices: EffectContext['choices']
): { reason?: string; summary: string } {
    const moves: string[] = []
    for (let i = 0; i < choices.length; i += 1) {
        const c = choices[i]
        if (c.kind !== PowerChoiceKind.Warbands) continue
        const next = choices[i + 1]
        const dest = next && next.kind === PowerChoiceKind.Site ? next : undefined
        const { at, owner, count } = c.group
        if (at.kind === 'board') {
            if (!dest)
                return {
                    reason: 'warbands on your board need a site you rule to move to',
                    summary: ''
                }
            if (!rulesSite(state, playerId, dest.siteId))
                return { reason: `you do not rule ${dest.siteId}`, summary: '' }
            const moved = moveWarbandsBoardToSite(state, playerId, owner, dest.siteId, count)
            if (moved < count)
                return {
                    reason: `only ${moved} of those warbands on your board to move`,
                    summary: ''
                }
            moves.push(`${moved} board → ${dest.siteId}`)
        } else {
            if (!rulesSite(state, playerId, at.siteId))
                return { reason: `you do not rule ${at.siteId}`, summary: '' }
            const lifted = moveWarbandsSiteToBoard(state, playerId, owner, at.siteId, count)
            if (lifted < count)
                return {
                    reason: `only ${lifted} of those warbands may leave ${at.siteId} (the last must stay)`,
                    summary: ''
                }
            if (dest) {
                if (!rulesSite(state, playerId, dest.siteId))
                    return { reason: `you do not rule ${dest.siteId}`, summary: '' }
                moveWarbandsBoardToSite(state, playerId, owner, dest.siteId, lifted)
                moves.push(`${lifted} ${at.siteId} → ${dest.siteId}`)
            } else {
                moves.push(`${lifted} ${at.siteId} → board`)
            }
        }
    }
    return { summary: moves.length ? `moved ${moves.join('; ')}` : 'moved nothing' }
}
