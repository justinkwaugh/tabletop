import { expect, it } from 'vitest'
import { chooseTrainSource, chooseCompanyTrain, backFromTrainBuying } from './trainBuyingSelection.js'

it('undoes a priced train choice to its source, then returns to the default depot', () => {
    const source = chooseTrainSource('others')
    const selected = chooseCompanyTrain(source, {
        companyId: 'buyer', seller: { kind: 'company', companyId: 'seller' },
        asset: { kind: 'train', trainId: 'train-1' }, price: 17
    })
    const repriced = chooseCompanyTrain(selected, { ...selected.purchase!.value, price: 25 })
    expect(backFromTrainBuying(repriced)).toEqual(source)
    expect(backFromTrainBuying(source)).toEqual({})
    expect(chooseTrainSource('mine').purchase).toBeUndefined()
})
