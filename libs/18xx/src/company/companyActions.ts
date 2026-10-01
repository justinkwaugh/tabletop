import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { StockRules } from '../stock/stockRules.js'
import type { CompanyRules } from './companyRules.js'
import { StartCompany, HydratedStartCompany, isStartCompany } from './startCompany.js'
import { FloatCompany, HydratedFloatCompany, isFloatCompany } from './floatCompany.js'
import { ParCompany, HydratedParCompany, isParCompany } from './pendingPar.js'

export function companyActions(companies: CompanyRules, stock: StockRules): ActionDefinition[] {
    return [
        defineAction(
            StartCompany,
            isStartCompany,
            (action) => new HydratedStartCompany(action, stock, companies)
        ),
        defineAction(
            FloatCompany,
            isFloatCompany,
            (action) => new HydratedFloatCompany(action, companies)
        ),
        ...(companies.parAfterAward
            ? [
                  defineAction(
                      ParCompany,
                      isParCompany,
                      (action) => new HydratedParCompany(action, companies)
                  )
              ]
            : [])
    ]
}
