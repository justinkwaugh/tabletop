import { ActionType } from './actions.js'
import { AdjustMarket } from '../actions/adjustMarket.js'
import { Develop } from '../actions/develop.js'
import { ExpandCapacity } from '../actions/expandCapacity.js'
import { PassDevelopment } from '../actions/passDevelopment.js'
import { PayTaxes } from '../actions/payTaxes.js'
import { Ship } from '../actions/ship.js'

export const LwApiActions = {
    [ActionType.Develop]: Develop,
    [ActionType.PassDevelopment]: PassDevelopment,
    [ActionType.ExpandCapacity]: ExpandCapacity,
    [ActionType.Ship]: Ship,
    [ActionType.PayTaxes]: PayTaxes,
    [ActionType.AdjustMarket]: AdjustMarket
}
