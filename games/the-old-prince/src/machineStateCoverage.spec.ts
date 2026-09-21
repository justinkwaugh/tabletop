import { machineStateCoverageTests } from '../../../libs/18xx/test/machineStateCoverage.js'
import { Definition } from './definition.js'

machineStateCoverageTests(Definition, ['WaterfallAuction', 'AuctionBidding'])
