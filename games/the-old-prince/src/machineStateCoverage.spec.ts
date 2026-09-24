import { machineStateCoverageTests } from '../../../libs/18xx/test/machineStateCoverage.js'
import { Definition } from './definition/gameDefinition.js'

machineStateCoverageTests(Definition, ['WaterfallAuction', 'AuctionBidding'])
