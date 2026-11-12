import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, Hydratable, PlayerState, Visibility, assertExists } from '@tabletop/common'
import { GOOD_FIELD_SUNFLOWERS, GOOD_FIELD_WORMS, LOAN_AMOUNT } from '../components/costs.js'
import { MAX_SUNFLOWERS, Variety } from '../components/potatoes.js'
import { Plan, SaleQuantities } from './plans.js'

export type FieldState = Type.Static<typeof FieldState>
export const FieldState = Type.Object({
    id: Type.Number(),
    worms: Type.Number(),
    sunflowers: Type.Number(),
    skull: Type.Boolean(),
    furrow: Type.Boolean(),
    seed: Type.Optional(Type.Enum(Variety)),
    fertilizer: Type.Number(),
    poison: Type.Boolean(),
    harvest: Type.Optional(Type.Number()),
    sale: Type.Optional(SaleQuantities)
})

export type DickeKartoffelnPlayerState = Type.Static<typeof DickeKartoffelnPlayerState>
export const DickeKartoffelnPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            farm: Type.Number(),
            cash: Type.Number(),
            loans: Type.Number(),
            fields: Type.Array(FieldState),
            freshCompost: Type.Number(),
            ripeCompost: Type.Number(),
            plan: Visibility.protect(Type.Optional(Plan), { policy: Visibility.Policy.Owner })
        })
    ])
)

export const DickeKartoffelnProjectedPlayerState = Visibility.createProjectionSchema(
    DickeKartoffelnPlayerState
)
export type DickeKartoffelnProjectedPlayerState = Type.Static<
    typeof DickeKartoffelnProjectedPlayerState
>
const DickeKartoffelnProjectedPlayerStateValidator = Compile(DickeKartoffelnProjectedPlayerState)

export type Payment = { paid: number; loansTaken: number }

export class HydratedDickeKartoffelnPlayerState
    extends Hydratable<typeof DickeKartoffelnProjectedPlayerState>
    implements DickeKartoffelnProjectedPlayerState
{
    declare playerId: string
    declare color: Color
    declare farm: number
    declare cash: number
    declare loans: number
    declare fields: FieldState[]
    declare freshCompost: number
    declare ripeCompost: number
    declare plan?: Plan

    constructor(data: DickeKartoffelnProjectedPlayerState) {
        super(data, DickeKartoffelnProjectedPlayerStateValidator)
    }

    field(fieldId: number): FieldState {
        const field = this.fields.find((candidate) => candidate.id === fieldId)
        assertExists(field, `Player ${this.playerId} has no field ${fieldId}`)
        return field
    }

    // A farmer can always get credit, in bills of 500 marks, so a payment never fails.
    pay(amount: number): Payment {
        const shortfall = amount - this.cash
        const loansTaken = shortfall > 0 ? loansToCover(shortfall) : 0
        this.loans += loansTaken
        this.cash += loansTaken * LOAN_AMOUNT - amount
        return { paid: amount, loansTaken }
    }

    fieldWorms(): number {
        return this.fields.reduce((sum, field) => sum + field.worms, 0)
    }

    compostWorms(): number {
        return this.freshCompost + this.ripeCompost
    }

    sunflowers(): number {
        return this.fields.reduce((sum, field) => sum + field.sunflowers, 0)
    }

    goodFields(): number {
        return this.fields.filter(isGoodField).length
    }

    deadFields(): number {
        return this.fields.filter((field) => field.worms === 0).length
    }

    debt(): number {
        return this.loans * LOAN_AMOUNT
    }
}

export function loansToCover(shortfall: number): number {
    return Math.ceil(shortfall / LOAN_AMOUNT)
}

export function isGoodField(field: FieldState): boolean {
    return field.worms >= GOOD_FIELD_WORMS && field.sunflowers >= GOOD_FIELD_SUNFLOWERS
}

// A field with three sunflowers is organic, and may sell its crop as Bio.
export function isOrganic(field: FieldState): boolean {
    return field.sunflowers === MAX_SUNFLOWERS
}

// Worms are the life of a field: one without them is dead and may hold no sunflowers.
export function setWorms(field: FieldState, worms: number) {
    field.worms = Math.max(0, worms)
    if (field.worms === 0) {
        field.sunflowers = 0
    }
}
