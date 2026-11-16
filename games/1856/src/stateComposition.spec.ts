import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'

stateCompositionTests(
    Definition,
    {
        tranches: [],
        companyAuction: {},
        offerAuction: {},
        selectionAuction: {},
        pendingPar: {},
        privateStation: {},
        privatePowerWindow: {},
        privatePowerRequests: []
    },
    { role: 'mainline' }
)
