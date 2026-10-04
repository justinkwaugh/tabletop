import { assert } from '@tabletop/common'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS, type WarbandOwner } from '../model/warbandCounts.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import {
    addWarbandsToBoard,
    addWarbandsToCard,
    forceTotal,
    removeWarbandsFrom,
    removeWarbandsFromCard,
    soleOwner,
    warbandsInBankFor
} from '../util/force.js'
import { optional, PowerChoiceKind, type ChoiceDomain } from '../util/powerChoice.js'
import { FALSE_PROPHET_ID } from '../util/revealedVision.js'
import { isImperialPlayer, ownWarbandOwner } from '../util/rule.js'
import { chosen, registerBattlePlan, registerEffect, type EffectContext } from './registry.js'
import { gainWarbandsToBoard } from './vocabulary.js'
import { countOf, describeWarbands, warbandEntries } from '../util/warbands.js'

const OBSIDIAN_CAGE = 'relic.obsidian-cage'

registerBattlePlan(OBSIDIAN_CAGE, powerIndexOf(OBSIDIAN_CAGE, PowerTiming.BattlePlan), {
    hooks: {
        // R-7.6.5, R-10.3 — bandits are never warbands in a force, so none reach the Cage.
        takesEnemySurvivors: (ctx, survivors) => {
            for (const group of survivors) {
                removeWarbandsFrom(ctx.state, group.at, group.owner, group.count)
                addWarbandsToCard(ctx.state, OBSIDIAN_CAGE, group.owner, group.count)
            }
            return `Obsidian Cage: moved the enemy's ${forceTotal(survivors)} unkilled warbands to the Cage`
        }
    }
})

/** R-6.6.3 — every Imperial board holds the Empire's warbands; an Exile's go to their own board. */
function boardsFor(state: HydratedOathGameState, owner: WarbandOwner): string[] {
    if (owner === IMPERIAL_WARBANDS) {
        return state.players
            .filter((player) => isImperialPlayer(state, player.playerId))
            .map((player) => player.playerId)
    }
    return [state.warbandBankHolderOf(owner)]
}

const cagedWarbandsByBoard: ChoiceDomain = (state) =>
    warbandEntries(state.warbandsOnCard(OBSIDIAN_CAGE))
        .filter(([, count]) => count > 0)
        .flatMap(([owner, count]) =>
            boardsFor(state, owner).map((playerId) => ({
                kind: PowerChoiceKind.Warbands,
                group: { at: { kind: 'board' as const, playerId }, owner, count }
            }))
        )

function cagedWarbandsChosenByOwner(ctx: EffectContext): Map<WarbandOwner, number> {
    const wanted = new Map<WarbandOwner, number>()
    for (const { group } of chosen(ctx, PowerChoiceKind.Warbands)) {
        wanted.set(group.owner, (wanted.get(group.owner) ?? 0) + group.count)
    }
    return wanted
}

registerEffect(OBSIDIAN_CAGE, powerIndexOf(OBSIDIAN_CAGE, PowerTiming.Action), {
    choices: [
        {
            kind: PowerChoiceKind.Warbands,
            min: 1,
            max: 16,
            domain: cagedWarbandsByBoard,
            what: 'warbands on the Obsidian Cage, and the board of their owner they move to'
        }
    ],
    reasonCannotResolve: (ctx) => {
        const caged = ctx.state.warbandsOnCard(OBSIDIAN_CAGE)
        for (const [owner, count] of cagedWarbandsChosenByOwner(ctx)) {
            const held = countOf(caged, owner)
            if (count > held)
                return `the Obsidian Cage holds ${describeWarbands(held, owner)}, not ${count}`
        }
        return undefined
    },
    resolve: (ctx) => {
        const moves = chosen(ctx, PowerChoiceKind.Warbands).map(({ group }) => group)
        for (const { at, owner, count } of moves) {
            assert(at.kind === 'board', 'Obsidian Cage moves warbands to a board')
            removeWarbandsFromCard(ctx.state, OBSIDIAN_CAGE, owner, count)
            addWarbandsToBoard(ctx.state, at.playerId, owner, count)
        }
        return {
            summary: `Obsidian Cage: moved ${forceTotal(moves)} warbands from the Cage to their owners' boards`,
            warbandOwner: soleOwner(moves)
        }
    }
})

const revealedVisions: ChoiceDomain = (state, playerId) => {
    if (state.getPlayerState(playerId).status !== PlayerStatus.Exile) return []
    const visionIds = state.players
        .map((player) => player.revealedVisionId)
        .filter((visionId): visionId is string => visionId !== undefined)
    return [...new Set(visionIds)].map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))
}

registerEffect(FALSE_PROPHET_ID, powerIndexOf(FALSE_PROPHET_ID, PowerTiming.WhenPlayed), {
    choices: [
        optional(PowerChoiceKind.Card, { what: 'a revealed Vision', domain: revealedVisions })
    ],
    reasonCannotResolve: (ctx) => {
        if (chosen(ctx, PowerChoiceKind.Card).length > 0) return undefined
        const own = ownWarbandOwner(ctx.state, ctx.playerId)
        const warbandToPlace = warbandsInBankFor(ctx.state, own) > 0
        const visionToPlaceItOn = revealedVisions(ctx.state, ctx.playerId, ctx.power).length > 0
        // R-7.1.3 — no "may": with a warband to gain and a Vision revealed, one must be named.
        return warbandToPlace && visionToPlaceItOn
            ? 'choose the revealed Vision the warband goes on'
            : undefined
    },
    resolve: (ctx) => {
        const me = ctx.state.getPlayerState(ctx.playerId)
        if (me.status !== PlayerStatus.Exile) {
            return { summary: `False Prophet: a ${me.status} gains nothing from it` }
        }
        const [vision] = chosen(ctx, PowerChoiceKind.Card)
        if (!vision) {
            return { summary: 'False Prophet: no Vision is revealed, so no warband is gained' }
        }
        // R-9.3 — an empty bank gains nothing, and then no warband marks a Vision.
        const gained = gainWarbandsToBoard(ctx.state, ctx.playerId, 1)
        if (gained === 0) {
            return { summary: 'False Prophet: the bank is empty; no warband went on a Vision' }
        }
        const own = ownWarbandOwner(ctx.state, ctx.playerId)
        removeWarbandsFrom(ctx.state, { kind: 'board', playerId: ctx.playerId }, own, gained)
        addWarbandsToCard(ctx.state, vision.cardId, own, gained)
        return {
            summary: `False Prophet: gained a warband and put it on ${vision.cardId}, now revealed for ${ctx.playerId} too`
        }
    }
})
