import {
    TitleRequestKind,
    titleDefinition,
    type TitleChange,
    type TitleId
} from '@tabletop/stellar-horizons-2'

function titleNames(titleIds: readonly TitleId[]): string {
    return titleIds.map((titleId) => titleDefinition(titleId).name).join(' and ')
}

// A title bought or renounced in a Branch is settled with the span.
export const TITLE_REQUEST_WAITS = 'settled once everyone has finished the phase'

// "buys Cartographer for 12 IP; Navigator is laid out in its place", or the failed purchase that
// an earlier Player's took, with its IP back.
export function titleChangeText(change: TitleChange): string {
    const name = titleDefinition(change.titleId).name
    if (change.kind === TitleRequestKind.Renounce) {
        return `renounces ${name}`
    }
    if (change.failed) {
        return `cannot have ${name}, taken by a Player earlier in initiative order, and has the ${change.influence} IP back`
    }
    const renounced = change.renounced.length ? `, renouncing ${titleNames(change.renounced)}` : ''
    const replacement = change.replacement
        ? `; ${titleDefinition(change.replacement).name} is laid out in its place`
        : ''
    return `buys ${name} for ${change.influence} IP${renounced}${replacement}`
}

// A purchase or renunciation, settled at once or waiting for the span.
export function titleActionText(
    kind: TitleRequestKind,
    titleId: TitleId,
    change: TitleChange | undefined
): string {
    if (change) {
        return titleChangeText(change)
    }
    const verb = kind === TitleRequestKind.Buy ? 'buys' : 'renounces'
    return `${verb} ${titleDefinition(titleId).name}, ${TITLE_REQUEST_WAITS}`
}
