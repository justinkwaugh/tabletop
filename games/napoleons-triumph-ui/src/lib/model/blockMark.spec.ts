import { describe, expect, it } from 'vitest'
import { Side, type ProjectedUnit } from '@tabletop/napoleons-triumph'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import { BattleRole } from './battleStage.js'
import { blockMarkOf, shownMovedInUnitStrip, type BlockMarkContext } from './blockMark.js'

const GROUP = 'corps'

function ownUnits(): { viewerId: string; fresh: ProjectedUnit; moved: ProjectedUnit } {
    const game = new TestGame()
    game.deployBoth()
    const viewerId = game.playerOf(Side.Allied)
    const [fresh, second] = game.hydrated.corpsUnits('langeron')
    return { viewerId, fresh, moved: { ...second, movesThisTurn: 1 } }
}

function commanding(viewerId: string, changes: Partial<BlockMarkContext> = {}): BlockMarkContext {
    return {
        viewerId,
        viewingHistory: false,
        settling: false,
        fighting: false,
        pickableIds: [],
        roles: {},
        pickedUnitIds: [],
        riderIds: [],
        ...changes
    }
}

describe('the moved mark of a block', () => {
    it('is on the viewer’s own units that have moved this turn', () => {
        const { viewerId, fresh, moved } = ownUnits()
        expect(blockMarkOf(moved, GROUP, commanding(viewerId)).moved).toBe(true)
        expect(blockMarkOf(fresh, GROUP, commanding(viewerId)).moved).toBe(false)
    })

    it('is not shown to the other player, during an attack or in History View', () => {
        const { viewerId, moved } = ownUnits()
        expect(blockMarkOf(moved, GROUP, commanding('someone else')).moved).toBe(false)
        expect(blockMarkOf(moved, GROUP, commanding(viewerId, { fighting: true })).moved).toBe(
            false
        )
        expect(
            blockMarkOf(moved, GROUP, commanding(viewerId, { viewingHistory: true })).moved
        ).toBe(false)
    })

    it('stays on cavalry that is riding on', () => {
        const { viewerId, moved } = ownUnits()
        const riding = commanding(viewerId, {
            riderIds: [moved.id],
            selectedGroupKey: GROUP,
            pickedUnitIds: [moved.id]
        })
        expect(blockMarkOf(moved, GROUP, riding).moved).toBe(true)
    })
})

describe('a moved unit in the unit strip', () => {
    it('is set aside as moved, unless it is cavalry that may still ride on', () => {
        const { viewerId, fresh, moved } = ownUnits()
        expect(shownMovedInUnitStrip(moved, commanding(viewerId))).toBe(true)
        expect(shownMovedInUnitStrip(fresh, commanding(viewerId))).toBe(false)
        expect(shownMovedInUnitStrip(moved, commanding(viewerId, { riderIds: [moved.id] }))).toBe(
            false
        )
        expect(shownMovedInUnitStrip(moved, commanding(viewerId, { riderIds: ['another'] }))).toBe(
            true
        )
    })
})

describe('dimming a block', () => {
    it('sets aside the units of the picked-up group that are left out of the command', () => {
        const { viewerId, fresh, moved } = ownUnits()
        const picked = commanding(viewerId, {
            selectedGroupKey: GROUP,
            pickedUnitIds: [fresh.id]
        })
        expect(blockMarkOf(fresh, GROUP, picked).dimmed).toBe(false)
        expect(blockMarkOf(moved, GROUP, picked).dimmed).toBe(true)
        expect(blockMarkOf(moved, 'another group', picked).dimmed).toBe(false)
    })

    it('sets aside every piece with no part in an attack that cannot be picked for it', () => {
        const { viewerId, fresh, moved } = ownUnits()
        const fighting = commanding(viewerId, {
            fighting: true,
            pickableIds: [fresh.id],
            roles: { [moved.id]: BattleRole.Defends }
        })
        const bystander = { ...fresh, id: 'bystander' }
        expect(blockMarkOf(fresh, GROUP, fighting).dimmed).toBe(false)
        expect(blockMarkOf(moved, GROUP, fighting).dimmed).toBe(false)
        expect(blockMarkOf(bystander, GROUP, fighting).dimmed).toBe(true)
    })
})

describe('picking and naming a block', () => {
    it('offers the units the step allows, but not while the table is settling', () => {
        const { viewerId, fresh, moved } = ownUnits()
        const step = commanding(viewerId, { fighting: true, pickableIds: [fresh.id] })
        expect(blockMarkOf(fresh, GROUP, step).pickable).toBe(true)
        expect(blockMarkOf(moved, GROUP, step).pickable).toBe(false)
        expect(blockMarkOf(fresh, GROUP, { ...step, settling: true }).pickable).toBe(false)
    })

    it('carries the role of the unit and the mark that role is drawn with', () => {
        const { viewerId, fresh, moved } = ownUnits()
        const named = commanding(viewerId, {
            fighting: true,
            roles: { [fresh.id]: BattleRole.Leads, [moved.id]: BattleRole.Stays }
        })
        expect(blockMarkOf(fresh, GROUP, named)).toMatchObject({
            role: BattleRole.Leads,
            roleMark: { letter: 'L' }
        })
        expect(blockMarkOf(moved, GROUP, named)).toMatchObject({
            role: BattleRole.Stays,
            roleMark: undefined
        })
    })
})
