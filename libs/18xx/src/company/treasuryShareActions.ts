import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import {
    FinishTreasuryShares,
    HydratedFinishTreasuryShares,
    HydratedTradeTreasuryShares,
    TradeTreasuryShares,
    isFinishTreasuryShares,
    isTradeTreasuryShares
} from './tradeTreasuryShares.js'
import type { TreasuryShareRules } from './treasuryShares.js'

export function treasuryShareActions(rules: TreasuryShareRules | undefined): ActionDefinition[] {
    return rules
        ? [
              defineAction(
                  TradeTreasuryShares,
                  isTradeTreasuryShares,
                  (action) => new HydratedTradeTreasuryShares(action, rules)
              ),
              defineAction(
                  FinishTreasuryShares,
                  isFinishTreasuryShares,
                  (action) => new HydratedFinishTreasuryShares(action)
              )
          ]
        : []
}
