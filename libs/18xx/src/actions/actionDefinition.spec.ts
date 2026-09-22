import { describe, expect, it } from 'vitest'
import { ActionSource, createAction } from '@tabletop/common'
import { FinishTrack, HydratedFinishTrack, isFinishTrack } from '../construction/finishTrack.js'
import {
    FinishStations,
    HydratedFinishStations,
    isFinishStations
} from '../stations/finishStations.js'
import { ActionRegistry, defineAction } from './actionDefinition.js'

const finishTrack = defineAction(
    FinishTrack,
    isFinishTrack,
    (action) => new HydratedFinishTrack(action)
)
const finishStations = defineAction(
    FinishStations,
    isFinishStations,
    (action) => new HydratedFinishStations(action)
)
function action(schema: typeof FinishTrack | typeof FinishStations, data: object) {
    return Object.assign(createAction(schema, data), {
        id: 'action',
        gameId: 'game',
        playerId: 'alex',
        source: ActionSource.User
    })
}

describe('action definitions', () => {
    it('names an action by the type literal of its schema', () => {
        expect(finishTrack.type).toBe('FinishTrack')
        expect(finishTrack.schema).toBe(FinishTrack)
    })

    it('publishes every schema under its action type', () => {
        const registry = new ActionRegistry([finishTrack, finishStations])
        expect(registry.schemas).toEqual({ FinishTrack, FinishStations })
    })

    it('hydrates an action with the definition for its type', () => {
        const registry = new ActionRegistry([finishTrack, finishStations])
        const hydrated = registry.hydrate(action(FinishTrack, { companyId: 'R' }))
        expect(hydrated).toBeInstanceOf(HydratedFinishTrack)
    })

    it('hydrates nothing for an unregistered type or a payload its schema rejects', () => {
        const registry = new ActionRegistry([finishTrack])
        expect(registry.hydrate(action(FinishStations, { companyId: 'R' }))).toBeUndefined()
        const malformed = { ...action(FinishTrack, { companyId: 'R' }), companyId: 7 }
        expect(registry.hydrate(malformed)).toBeUndefined()
    })

    it('refuses two definitions for one action type', () => {
        expect(() => new ActionRegistry([finishTrack, finishTrack])).toThrow('Duplicate action')
    })
})
