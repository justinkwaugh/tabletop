import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'

stateCompositionTests(
    Definition,
    {
        tranches: [],
        cashCrisis: {},
        companyAuction: {},
        offerAuction: {},
        selectionAuction: {},
        privatePowerWindow: {},
        privatePowerRequests: []
    },
    { role: 'mainline' }
)
