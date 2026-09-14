import { it, expect } from 'vitest'
import { TrackConstruction } from '@tabletop/18xx'
import { Definition as Top, TheOldPrinceTrackRules } from '@tabletop/the-old-prince'
import { example } from './stockTestUtils.js'
it('enumerates affordable construction over the full map', () => {
    const { state } = example(Top, 'routes')
    state.machineState = 'LayingTrack'
    state.trackStep = { companyId: 'ML', lays: [], completed: false }
    const cash = state.cash.find(
        (account) => account.owner.kind === 'company' && account.owner.companyId === 'ML'
    )!
    cash.amount = 10000
    const start = performance.now()
    const construction = new TrackConstruction(state, TheOldPrinceTrackRules)
    const choices = TheOldPrinceTrackRules.map.definition.locations.flatMap((location) =>
        construction.choices(location.id)
    )
    console.log('full map affordable choices', choices.length, 'ms', performance.now() - start)
    expect(choices).toHaveLength(15)
})
