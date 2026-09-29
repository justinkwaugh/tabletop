import { assert, type Color } from '@tabletop/common'
import { IMPERIAL_COLOR, PlayerStatus } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import {
    addWarbandsToBoard,
    addWarbandsToCard,
    forceTotal,
    removeWarbandsFrom,
    removeWarbandsFromCard,
    warbandsInBankFor
} from '../util/force.js'
import { optional, PowerChoiceKind, type ChoiceDomain } from '../util/powerChoice.js'
import { FALSE_PROPHET_ID } from '../util/revealedVision.js'
import { isImperialPlayer } from '../util/rule.js'
import { chosen, registerBattlePlan, registerEffect, type EffectContext } from './registry.js'
import { gainWarbandsToBoard } from './vocabulary.js'
import { countOf, warbandEntries } from '../util/warbands.js'

const OBSIDIAN_CAGE = 'relic.obsidian-cage'

registerBattlePlan(OBSIDIAN_CAGE, powerIndexOf(OBSIDIAN_CAGE, PowerTiming.BattlePlan), {
    hooks: {
        // R-7.6.5, R-10.3 — bandits are never warbands in a force, so none reach the Cage.
        takesEnemySurvivors: (ctx, survivors) => {
            for (const group of survivors) {
                removeWarbandsFrom(ctx.state, group.at, group.color, group.count)
                addWarbandsToCard(ctx.state, OBSIDIAN_CAGE, group.color, group.count)
            }
            return `Obsidian Cage: moved the enemy's ${forceTotal(survivors)} unkilled warbands to the Cage`
        }
    }
})

/** R-6.6.3 — every Imperial board holds purple; any other colour has its own player's board. */
function boardsOfColor(state: HydratedOathGameState, color: Color): string[] {
    if (color === IMPERIAL_COLOR) {
        return state.players
            .filter((player) => isImperialPlayer(state, player.playerId))
            .map((player) => player.playerId)
    }
    return [state.warbandOwnerOf(color)]
}

const cagedWarbandsByBoard: ChoiceDomain = (state) =>
    warbandEntries(state.warbandsOnCard(OBSIDIAN_CAGE))
        .filter(([, count]) => count > 0)
        .flatMap(([color, count]) =>
            boardsOfColor(state, color).map((playerId) => ({
                kind: PowerChoiceKind.Warbands,
                group: { at: { kind: 'board' as const, playerId }, color, count }
            }))
        )

function cagedWarbandsChosenByColor(ctx: EffectContext): Map<Color, number> {
    const wanted = new Map<Color, number>()
    for (const { group } of chosen(ctx, PowerChoiceKind.Warbands)) {
        wanted.set(group.color, (wanted.get(group.color) ?? 0) + group.count)
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
            what: 'warbands on the Obsidian Cage, and the board of their colour they move to'
        }
    ],
    reasonCannotResolve: (ctx) => {
        const caged = ctx.state.warbandsOnCard(OBSIDIAN_CAGE)
        for (const [color, count] of cagedWarbandsChosenByColor(ctx)) {
            const held = countOf(caged, color)
            if (count > held)
                return `the Obsidian Cage holds ${held} ${color} warbands, not ${count}`
        }
        return undefined
    },
    resolve: (ctx) => {
        const moves = chosen(ctx, PowerChoiceKind.Warbands).map(({ group }) => group)
        for (const { at, color, count } of moves) {
            assert(at.kind === 'board', 'Obsidian Cage moves warbands to a board')
            removeWarbandsFromCard(ctx.state, OBSIDIAN_CAGE, color, count)
            addWarbandsToBoard(ctx.state, at.playerId, color, count)
        }
        return {
            summary: `Obsidian Cage: moved ${forceTotal(moves)} warbands from the Cage to boards of their colour`
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
        const me = ctx.state.getPlayerState(ctx.playerId)
        const warbandToPlace = warbandsInBankFor(ctx.state, me.color) > 0
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
        removeWarbandsFrom(ctx.state, { kind: 'board', playerId: ctx.playerId }, me.color, gained)
        addWarbandsToCard(ctx.state, vision.cardId, me.color, gained)
        return {
            summary: `False Prophet: gained a warband and put it on ${vision.cardId}, which ${ctx.playerId} now also has revealed`
        }
    }
})
