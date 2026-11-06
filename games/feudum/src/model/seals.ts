import { assert, assertExists, shuffle } from '@tabletop/common'
import type { SpaceId } from '../data/board.js'
import type { ScrollSpaceId } from '../data/guilds.js'
import type { SealId } from '../data/seals.js'
import type { HydratedFeudumGameState } from './gameState.js'

/** R-3.14.2 The marker a Royal Immunity seal lies under. */
export type ImmunityRole = 'subject' | 'serf'

/** R-5-H1 Where a seal lies red side up. The identity is in the vault; public state counts it. */
export type ConcealedSealPlace =
    | { kind: 'pile' }
    | { kind: 'scroll'; spaceId: ScrollSpaceId }
    | { kind: 'held'; playerId: string }
    | { kind: 'charter'; playerId: string }
    | { kind: 'immunity'; spaceId: SpaceId; role: ImmunityRole }

/** R-4.4.3 A sealed charter keeps its seal to the end, so a charter is never a source. */
export type ConcealedSealSource = Exclude<ConcealedSealPlace, { kind: 'charter' }>

/** R-3.11.2, R-3.13.2 Beads go back as a player's held seal or to the pile. */
export type BeadReturn = Extract<ConcealedSealPlace, { kind: 'held' | 'pile' }>

/** R-3.11.1, R-4.6.5, R-1.3 Where a seal lies bead side up, in public state. */
export type BeadPlace =
    { kind: 'player'; playerId: string } | { kind: 'rosary' } | { kind: 'chicken'; index: number }

/** R-3.14.2 The vault's key for a Royal Immunity seal. */
export function immunityKey(spaceId: SpaceId, role: ImmunityRole): string {
    return `${spaceId}.${role}`
}

/**
 * R-5-H1 A seal moves unseen, staying red side up. Nothing is returned: the mover learns nothing and
 * no record can name it. Public counts and occupancy follow on both ends.
 */
export function moveConcealedSeal(
    state: HydratedFeudumGameState,
    from: ConcealedSealSource,
    to: ConcealedSealPlace
) {
    placeConcealedSeal(state, to, takeConcealedSeal(state, from))
}

/** R-5-H1 A flip moves the identity out of the vault and into public state. */
export function flipSeal(
    state: HydratedFeudumGameState,
    from: ConcealedSealSource,
    to: BeadPlace
): SealId {
    const sealId = takeConcealedSeal(state, from)
    placeBead(state, to, sealId)
    return sealId
}

/** R-3.11.2, R-3.13.2 A bead flips back: its identity returns to the vault. */
export function beadToSeal(
    state: HydratedFeudumGameState,
    sealId: SealId,
    from: BeadPlace,
    to: BeadReturn
) {
    // Read the vault first: a projected state defers before any public change.
    state.requireVault()
    takeBead(state, from, sealId)
    placeConcealedSeal(state, to, sealId)
}

/** R-4.6.4 A bead moves bead side up, from one public place to another. */
export function moveBead(
    state: HydratedFeudumGameState,
    sealId: SealId,
    from: BeadPlace,
    to: BeadPlace
): void {
    takeBead(state, from, sealId)
    placeBead(state, to, sealId)
}

/** R-5-H1 Takes the identity out of the vault; the public count or occupancy follows. */
function takeConcealedSeal(state: HydratedFeudumGameState, from: ConcealedSealSource): SealId {
    const vault = state.requireVault()
    switch (from.kind) {
        case 'pile': {
            // R-5-H1 A pile draw takes the top.
            const top = vault.sealPile.shift()
            assertExists(top, 'The seal pile is empty')
            state.supply.sealPileCount -= 1
            return top
        }
        case 'scroll': {
            const sealId = vault.scrollSeals[from.spaceId]
            assertExists(sealId, `No seal lies on ${from.spaceId}`)
            delete vault.scrollSeals[from.spaceId]
            state.guilds.noble.scrolls[from.spaceId] = false
            return sealId
        }
        case 'held': {
            // R-5-H1 No one knows a player's held seals apart, so any one may leave.
            const sealId = vault.heldSeals[from.playerId]?.shift()
            assertExists(sealId, `${from.playerId} holds no seal`)
            state.getPlayerState(from.playerId).sealCount -= 1
            return sealId
        }
        case 'immunity': {
            const key = immunityKey(from.spaceId, from.role)
            const sealId = vault.immunitySeals[key]
            assertExists(sealId, `No seal lies under ${key}`)
            delete vault.immunitySeals[key]
            markImmune(state, from.spaceId, from.role, false)
            return sealId
        }
    }
}

/** R-5-H1 Puts the identity into the vault; the public count or occupancy follows. */
function placeConcealedSeal(
    state: HydratedFeudumGameState,
    to: ConcealedSealPlace,
    sealId: SealId
) {
    const vault = state.requireVault()
    switch (to.kind) {
        case 'pile': {
            // R-5-H1 A return to the pile reshuffles it.
            vault.sealPile.push(sealId)
            shuffle(vault.sealPile, state.getProtectedPrng().random)
            state.supply.sealPileCount += 1
            return
        }
        case 'scroll': {
            assert(!state.guilds.noble.scrolls[to.spaceId], `${to.spaceId} already holds a seal`)
            vault.scrollSeals[to.spaceId] = sealId
            state.guilds.noble.scrolls[to.spaceId] = true
            return
        }
        case 'held': {
            vault.heldSeals[to.playerId].push(sealId)
            state.getPlayerState(to.playerId).sealCount += 1
            return
        }
        case 'charter': {
            // R-4.4.3 The charter's own writ moves with the action that seals it.
            vault.charterSeals[to.playerId].push(sealId)
            state.getPlayerState(to.playerId).sealedCharterCount += 1
            return
        }
        case 'immunity': {
            markImmune(state, to.spaceId, to.role, true)
            vault.immunitySeals[immunityKey(to.spaceId, to.role)] = sealId
            return
        }
    }
}

/** R-3.14.2 Public occupancy: which markers are immune. */
function markImmune(
    state: HydratedFeudumGameState,
    spaceId: SpaceId,
    role: ImmunityRole,
    immune: boolean
) {
    const space = state.spaces[spaceId]
    if (role === 'serf') {
        assertExists(space.serf, `No serf on ${spaceId}`)
        if (immune) {
            space.serf.immune = true
        } else {
            delete space.serf.immune
        }
        return
    }
    assert(space.ruler?.subject, `No subject on ${spaceId}`)
    if (immune) {
        space.ruler.subjectImmune = true
    } else {
        delete space.ruler.subjectImmune
    }
}

/** R-3.11.1, R-4.6.5, R-1.3 A flip's end: the bead lies in public state. */
function placeBead(state: HydratedFeudumGameState, to: BeadPlace, sealId: SealId) {
    switch (to.kind) {
        case 'player': {
            state.getPlayerState(to.playerId).beads.push(sealId)
            return
        }
        case 'rosary': {
            state.guilds.monk.rosary.push(sealId)
            return
        }
        case 'chicken': {
            assert(
                state.guilds.farmer.chickens[to.index] === null,
                `Chicken ${to.index} is not empty`
            )
            state.guilds.farmer.chickens[to.index] = sealId
            return
        }
    }
}

/** R-3.11.2, R-3.13.2 A bead leaves public state, from where it is known to lie. */
function takeBead(state: HydratedFeudumGameState, from: BeadPlace, sealId: SealId) {
    if (from.kind === 'chicken') {
        const { chickens } = state.guilds.farmer
        assert(chickens[from.index] === sealId, `${sealId} is not on chicken ${from.index}`)
        chickens[from.index] = null
        return
    }
    const beads =
        from.kind === 'player'
            ? state.getPlayerState(from.playerId).beads
            : state.guilds.monk.rosary
    const index = beads.indexOf(sealId)
    assert(index >= 0, `${sealId} is not among the beads there`)
    beads.splice(index, 1)
}
