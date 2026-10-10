import type { GameAction } from '@tabletop/common'
import {
    isChooseLarvaCubes,
    isEatCoral,
    isEndGame,
    isExchangeConsumedPolyp,
    isExchangeLarvaCube,
    isFeedParrotfish,
    isIntroduceShrimp,
    isMoveShrimp,
    isPassFinalTurn,
    isPlacePolyp,
    isPlayAlgaCylinder,
    isPlayLarvaCube,
    isRefillOpenSea,
    isTakeOpenSeaSpace,
    type CoralColor
} from '@tabletop/reef-encounter'

const listed = (words: readonly string[]): string =>
    words.length <= 1
        ? (words[0] ?? '')
        : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`

export const withArticle = (word: string): string => `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`

const polyps = (colors: readonly CoralColor[]): string =>
    colors.length === 1 ? `${withArticle(colors[0])} polyp` : `${listed(colors)} polyps`

// What an action did, as a phrase following its actor's name; `own` is "your" when the viewer
// acted and "their" otherwise. Undefined for actions the history leaves out.
export function describeAction(action: GameAction, own: 'your' | 'their'): string | undefined {
    if (isFeedParrotfish(action)) {
        return action.color
            ? `fed ${withArticle(action.color)} polyp to ${own} parrotfish.`
            : `fed a polyp to ${own} parrotfish.`
    }
    if (isChooseLarvaCubes(action)) {
        const [first, second] = action.colors
        return first === second
            ? `took two ${first} larva cubes.`
            : `took ${withArticle(first)} and ${withArticle(second)} larva cube.`
    }
    if (isPlayLarvaCube(action)) {
        return `played ${withArticle(action.color)} larva cube.`
    }
    if (isPlacePolyp(action)) {
        const placement = action.metadata
        if (!placement) return undefined
        const source = action.fromConsumed ? 'consumed ' : ''
        const attack = placement.attacked
            ? `, consuming ${withArticle(placement.attacked)} polyp`
            : ''
        const growth = placement.extraGrowth
            ? `; a bonus ${placement.color} polyp grew beside it`
            : ''
        return `placed ${withArticle(`${source}${placement.color}`)} polyp on board ${action.boardId}${attack}${growth}.`
    }
    if (isIntroduceShrimp(action)) {
        return `introduced a shrimp on board ${action.boardId}.`
    }
    if (isMoveShrimp(action)) {
        return action.to
            ? `moved a shrimp${action.to.boardId === action.from.boardId ? '' : ` to board ${action.to.boardId}`}.`
            : `took a shrimp back behind ${own} screen.`
    }
    if (isExchangeConsumedPolyp(action)) {
        return `traded a consumed ${action.color} polyp for ${withArticle(action.color)} larva cube.`
    }
    if (isExchangeLarvaCube(action)) {
        return `traded ${withArticle(action.color)} larva cube for ${withArticle(action.color)} polyp.`
    }
    if (isPlayAlgaCylinder(action)) {
        const flipped = action.metadata?.flippedTileIds.length ?? 0
        const flips =
            flipped === 0 ? '' : `, flipping ${flipped} coral tile${flipped === 1 ? '' : 's'}`
        return action.tileId === undefined
            ? `put ${withArticle(action.alga)} cylinder on the open sea${flips}.`
            : `locked coral tile ${action.tileId} with ${withArticle(action.alga)} cylinder${flips}.`
    }
    if (isEatCoral(action)) {
        const eaten = action.metadata
        if (!eaten) return undefined
        return `fed a coral of ${eaten.polyps} ${eaten.color} polyps to ${own} parrotfish, ${eaten.returnedToBag} of them going back into the bag.`
    }
    if (isTakeOpenSeaSpace(action)) {
        const taken = action.metadata?.polyps ?? []
        return taken.length === 0
            ? `took the ${action.larvaColor} larva cube from the open sea.`
            : `took the ${action.larvaColor} larva cube from the open sea with ${polyps(taken)}.`
    }
    if (isPassFinalTurn(action)) {
        return `passed ${own} final turn.`
    }
    return undefined
}

// What a system action did, as a whole sentence.
export function describeSystemAction(action: GameAction): string | undefined {
    if (isRefillOpenSea(action)) {
        const refill = action.metadata
        if (!refill) return undefined
        if (refill.shortage) {
            return 'The open sea could not be refilled.'
        }
        const added = refill.additions.map((addition) => addition.polyp)
        return added.length === 0
            ? 'The open sea was refilled.'
            : `The open sea was refilled with ${polyps(added)}.`
    }
    if (isEndGame(action)) {
        return 'The game ended.'
    }
    return undefined
}

// A turn's phrases, with consecutive plain placements of one colour on one board merged.
export function describeActions(actions: readonly GameAction[], own: 'your' | 'their'): string[] {
    const phrases: string[] = []
    let run:
        | { key: string; count: number; color: CoralColor; boardId: number; consumed: boolean }
        | undefined
    const closeRun = () => {
        if (run) {
            const source = run.consumed ? 'consumed ' : ''
            phrases.push(
                run.count === 1
                    ? `placed ${withArticle(`${source}${run.color}`)} polyp on board ${run.boardId}.`
                    : `placed ${run.count} ${source}${run.color} polyps on board ${run.boardId}.`
            )
        }
        run = undefined
    }
    for (const action of actions) {
        const placement = isPlacePolyp(action) ? action.metadata : undefined
        if (isPlacePolyp(action) && placement && !placement.attacked && !placement.extraGrowth) {
            const key = `${placement.color}:${action.boardId}:${action.fromConsumed}`
            if (run?.key === key) {
                run.count += 1
                continue
            }
            closeRun()
            run = {
                key,
                count: 1,
                color: placement.color,
                boardId: action.boardId,
                consumed: action.fromConsumed
            }
            continue
        }
        closeRun()
        const phrase = action.playerId ? describeAction(action, own) : describeSystemAction(action)
        if (phrase) phrases.push(phrase)
    }
    closeRun()
    return phrases
}

export function capitalised(phrase: string): string {
    return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}
