import { Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { describe, expect, it } from 'vitest'
import { initialState } from '../testing/state.js'
import { moveConcealedSeal } from './seals.js'
import { FeudumVault } from './vault.js'
import { drawWrits, putWritsUnderInView } from './writDeck.js'

/** What the projection leaves: the same table, no vault. */
function stateWithoutVault() {
    const state = initialState()
    Reflect.deleteProperty(state, 'vault')
    return state
}

const VAULT_REQUIRED = 'requires the concealed vault'

describe('requireVault', () => {
    it('R-5-H1 gives the vault of a state that has one', () => {
        const state = initialState()
        expect(state.requireVault()).toBe(state.vault)
    })

    it('R-5-H1 fails on a state without a vault', () => {
        expect(() => stateWithoutVault().requireVault()).toThrow(VAULT_REQUIRED)
    })

    it('R-5.1 a writ draw and a writ going under both need the vault', () => {
        const state = stateWithoutVault()
        const { top, nextBottom } = state.writDeck

        expect(() => drawWrits(state, 1)).toThrow(VAULT_REQUIRED)
        expect(() => putWritsUnderInView(state, ['writ.mandate.1'])).toThrow(VAULT_REQUIRED)
        expect(state.writDeck).toEqual({ top, nextBottom })
    })

    it('R-5-H1 a seal move needs the vault', () => {
        const state = stateWithoutVault()
        const { sealPileCount } = state.supply

        expect(() =>
            moveConcealedSeal(state, { kind: 'pile' }, { kind: 'held', playerId: 'p1' })
        ).toThrow(VAULT_REQUIRED)
        expect(state.supply.sealPileCount).toBe(sealPileCount)
    })

    it('R-5-H1 fails under the execution guard with the error that defers to the host', () => {
        const projector = Visibility.createProjector(
            Type.Object({
                vault: Visibility.protect(FeudumVault, { policy: Visibility.Policy.HostOnly })
            })
        )
        const perspective: Visibility.Perspective = { kind: 'player', playerId: 'p1' }
        const guarded = projector.guardForExecution(stateWithoutVault(), perspective)

        expect(() => guarded.requireVault()).toThrow(Visibility.UnavailableProjectedValueError)
        expect(() => drawWrits(guarded, 1)).toThrow(Visibility.UnavailableProjectedValueError)
    })
})
