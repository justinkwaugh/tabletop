import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { ActionType, Banner, WarbandMoveKind } from '@tabletop/oath'
import { OathSelection, OATH_STAGE_ORDER } from './oathSelection.svelte.js'
import { setStagedSelectionValue } from '@tabletop/frontend-components'

describe('Oath staged selection (docs/user-interactions.md)', () => {
    it('setting a stage clears everything after it', () => {
        const sel = new OathSelection()
        sel.set('action', ActionType.Trade)
        sel.set('site', 'slot.cradle.0')
        sel.set('card', 'denizen.order.longbows')
        sel.set('option', 'a')

        sel.set('site', 'slot.provinces.1')
        expect(sel.value('site')).toBe('slot.provinces.1')
        expect(sel.value('card')).toBeUndefined()
        expect(sel.value('option')).toBeUndefined()
        expect(sel.value('action')).toBe(ActionType.Trade)
    })

    it('Back pops the highest manual stage, one at a time', () => {
        const sel = new OathSelection()
        sel.set('action', ActionType.Travel)
        sel.set('site', 'slot.hinterland.2')

        expect(sel.back()).toBe('site')
        expect(sel.value('site')).toBeUndefined()
        expect(sel.value('action')).toBe(ActionType.Travel)

        expect(sel.back()).toBe('action')
        expect(sel.value('action')).toBeUndefined()

        // Undefined tells the caller to fall through to action-history undo.
        expect(sel.back()).toBeUndefined()
    })

    it('an auto-only selection leaves Undo to the action history', () => {
        const sel = new OathSelection()
        sel.autoSelect('action', ActionType.Recover)
        sel.autoSelect('banner', Banner.PeoplesFavor)

        expect(sel.value('banner')).toBe(Banner.PeoplesFavor)
        expect(sel.sourceOf('banner')).toBe('auto')
        expect(sel.hasManualSelection()).toBe(false)
        expect(sel.back()).toBeUndefined()

        sel.set('amount', 2)
        expect(sel.hasManualSelection()).toBe(true)
        expect(sel.back()).toBe('amount')
        expect(sel.value('banner')).toBe(Banner.PeoplesFavor)
        expect(sel.hasManualSelection()).toBe(false)
    })

    it('an unknown stage throws instead of silently doing nothing', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, string>, string>(
                {},
                OATH_STAGE_ORDER,
                'notAStage',
                'x',
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })

    it('reselecting the action abandons everything chosen under it', () => {
        const sel = new OathSelection()
        sel.set('action', ActionType.Muster)
        sel.set('site', 'slot.cradle.0')
        sel.set('card', 'denizen.hearth.hearth-guard')

        sel.set('action', ActionType.Campaign)
        expect(sel.value('action')).toBe(ActionType.Campaign)
        expect(sel.value('site')).toBeUndefined()
        expect(sel.value('card')).toBeUndefined()
    })

    it('re-running the same auto selection is a no-op', () => {
        // `docs/user-interactions.md` — auto selection is idempotent.
        const sel = new OathSelection()
        sel.autoSelect('action', ActionType.Peek)
        sel.set('relicSlot', 'slot.cradle.0.relic.0')

        sel.autoSelect('action', ActionType.Peek)
        expect(sel.value('relicSlot')).toBe('slot.cradle.0.relic.0')

        sel.autoSelect('action', ActionType.Travel)
        expect(sel.value('relicSlot')).toBeUndefined()
    })

    it('reselecting the kept card clears the discard order under it', () => {
        // R-1.23 — setup's stages: an auto action, a site, a kept card, then the discard order.
        const sel = new OathSelection()
        sel.autoSelect('action', ActionType.SetupChoice)
        sel.set('site', 'slot.cradle.0')
        sel.set('card', 'a')
        sel.set('discardOrder', ['b'])

        sel.set('card', 'b')
        expect(sel.value('discardOrder')).toBeUndefined()
        expect(sel.value('site')).toBe('slot.cradle.0')

        expect(sel.back()).toBe('card')
        expect(sel.back()).toBe('site')
        expect(sel.back()).toBeUndefined()
        expect(sel.action).toBe(ActionType.SetupChoice)
    })

    it('reset abandons the whole flow', () => {
        const sel = new OathSelection()
        sel.set('action', ActionType.Travel)
        sel.set('site', 'slot.cradle.1')
        sel.reset()
        expect(sel.hasManualSelection()).toBe(false)
        expect(sel.value('action')).toBeUndefined()
    })
})

const LONGBOWS = { cardId: 'denizen.order.longbows', powerIndex: 0 }
const WAYSIDE_INN = { cardId: 'denizen.hearth.wayside-inn', powerIndex: 0 }
const TO_SITE = { move: { kind: WarbandMoveKind.BoardToSite }, color: Color.Red, max: 3 } as const
const TO_BOARD = { move: { kind: WarbandMoveKind.SiteToBoard }, color: Color.Red, max: 2 } as const

/** R-7.4 — the modifiers declared on the staged action are one stage of the same flow. */
describe('modifiers in the staged selection (docs/user-interactions.md)', () => {
    it('declaring a modifier clears the site and card chosen under the old declaration', () => {
        const sel = new OathSelection()
        sel.set('action', ActionType.Trade)
        sel.set('site', 'slot.cradle.0')
        sel.set('card', 'denizen.order.longbows')

        sel.set('modifiers', [{ use: LONGBOWS }])
        expect(sel.modifiers).toEqual([{ use: LONGBOWS }])
        expect(sel.value('site')).toBeUndefined()
        expect(sel.value('card')).toBeUndefined()
    })

    it('Back takes the last modifier declared, one at a time, then the action', () => {
        const sel = new OathSelection()
        sel.set('action', ActionType.Travel)
        sel.set('modifiers', [{ use: LONGBOWS }])
        sel.set('modifiers', [{ use: LONGBOWS }, { use: WAYSIDE_INN }])
        sel.set('site', 'slot.provinces.0')

        expect(sel.back()).toBe('site')
        expect(sel.back()).toBe('modifiers')
        expect(sel.modifiers).toEqual([{ use: LONGBOWS }])
        expect(sel.back()).toBe('modifiers')
        expect(sel.modifiers).toEqual([])
        expect(sel.back()).toBe('action')
        expect(sel.back()).toBeUndefined()
    })

    it('with only an auto action left, a declared modifier is the only manual pick', () => {
        const sel = new OathSelection()
        sel.autoSelect('action', ActionType.Recover)
        expect(sel.hasManualSelection()).toBe(false)
        sel.set('modifiers', [{ use: LONGBOWS }])
        expect(sel.hasManualSelection()).toBe(true)
        expect(sel.back()).toBe('modifiers')
        expect(sel.hasManualSelection()).toBe(false)
        expect(sel.action).toBe(ActionType.Recover)
    })

    it('reselecting the action drops the modifiers declared on the last one', () => {
        const sel = new OathSelection()
        sel.set('action', ActionType.Muster)
        sel.set('modifiers', [{ use: LONGBOWS }])
        sel.set('action', ActionType.Trade)
        expect(sel.modifiers).toEqual([])
    })
})

/** R-6.5 — the warband move's direction, then its count. */
describe('the warband move in the staged selection (docs/user-interactions.md)', () => {
    it('choosing the direction clears the count chosen for the other one', () => {
        const sel = new OathSelection()
        sel.set('action', ActionType.MoveWarbands)
        sel.set('warbandMove', TO_SITE)
        sel.set('amount', 2)

        sel.set('warbandMove', TO_BOARD)
        expect(sel.value('warbandMove')).toEqual(TO_BOARD)
        expect(sel.value('amount')).toBeUndefined()
    })

    it('Back returns from the count to the direction, then to the grid', () => {
        const sel = new OathSelection()
        sel.set('action', ActionType.MoveWarbands)
        sel.set('warbandMove', TO_SITE)
        sel.set('amount', 2)

        expect(sel.back()).toBe('amount')
        expect(sel.back()).toBe('warbandMove')
        expect(sel.value('warbandMove')).toBeUndefined()
        expect(sel.back()).toBe('action')
    })

    it('reselecting the action abandons the direction', () => {
        const sel = new OathSelection()
        sel.set('action', ActionType.MoveWarbands)
        sel.set('warbandMove', TO_SITE)
        sel.set('action', ActionType.Travel)
        expect(sel.value('warbandMove')).toBeUndefined()
    })
})
