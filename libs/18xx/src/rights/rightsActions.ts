import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { AccessRightRules } from './accessRights.js'
import { BuyAccessRight, HydratedBuyAccessRight, isBuyAccessRight } from './buyAccessRight.js'

export function accessRightActions(rules: AccessRightRules | undefined): ActionDefinition[] {
    return rules
        ? [
              defineAction(
                  BuyAccessRight,
                  isBuyAccessRight,
                  (action) => new HydratedBuyAccessRight(action, rules)
              )
          ]
        : []
}
