import * as Type from 'typebox'
import { MAX_SUNFLOWERS, MAX_WORMS } from '../components/potatoes.js'
import { isOrganic, setWorms, type FieldState } from './playerState.js'

export type SunflowerChange = Type.Static<typeof SunflowerChange>
export const SunflowerChange = Type.Object({
    fieldId: Type.Number(),
    before: Type.Number(),
    after: Type.Number()
})

// A clean, living field grows a sunflower each year, up to three. Fertilizer or poison wipes
// them out; a skull from earlier chemicals holds them where they are.
export function growSunflowers(field: FieldState): SunflowerChange | undefined {
    const before = field.sunflowers
    if (field.worms === 0 || field.fertilizer > 0 || field.poison) {
        field.sunflowers = 0
    } else if (!field.skull) {
        field.sunflowers = Math.min(MAX_SUNFLOWERS, before + 1)
    }
    return field.sunflowers === before
        ? undefined
        : { fieldId: field.id, before, after: field.sunflowers }
}

// Whether a field kept free of fertilizer and poison this year has three sunflowers by the
// harvest, and so may sell its crop as Bio.
export function organicIfKeptClean(field: FieldState): boolean {
    const kept = { ...field, fertilizer: 0, poison: false }
    growSunflowers(kept)
    return isOrganic(kept)
}

export type SoilChange = Type.Static<typeof SoilChange>
export const SoilChange = Type.Object({
    fieldId: Type.Number(),
    wormsBefore: Type.Number(),
    wormsAfter: Type.Number(),
    skullBefore: Type.Boolean(),
    skullAfter: Type.Boolean()
})

// Round 9: chemicals leave a skull, a clean year removes it, a living fallow field breeds a worm,
// and the seed, the poison cloud and each sack of fertilizer each cost the field a worm.
export function reactSoil(field: FieldState): SoilChange | undefined {
    const wormsBefore = field.worms
    const skullBefore = field.skull
    field.skull = field.fertilizer > 0 || field.poison
    if (field.seed === undefined) {
        if (field.worms > 0) {
            setWorms(field, Math.min(MAX_WORMS, field.worms + 1))
        }
    } else {
        setWorms(field, field.worms - 1 - (field.poison ? 1 : 0) - field.fertilizer)
    }
    clearSeason(field)
    return field.worms === wormsBefore && field.skull === skullBefore
        ? undefined
        : {
              fieldId: field.id,
              wormsBefore,
              wormsAfter: field.worms,
              skullBefore,
              skullAfter: field.skull
          }
}

function clearSeason(field: FieldState) {
    field.furrow = false
    field.seed = undefined
    field.fertilizer = 0
    field.poison = false
    field.harvest = undefined
    field.sale = undefined
}
