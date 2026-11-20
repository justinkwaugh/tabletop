import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'

stateCompositionTests(
    Definition,
    {
        tranches: [],
        cashCrisis: {},
        offerAuction: {},
        openingAuction: {},
        privatePowerWindow: {},
        privatePowerRequests: []
    },
    { loans: 1, role: 'mainline' }
)
