import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    DETACHMENT_REACH,
    MAX_FRENCH_DETACHMENTS,
    Side,
    suggestedDeployment,
    type Deployment,
    type HydratedNapoleonsTriumphGameState
} from '@tabletop/napoleons-triumph'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import {
    detachmentTargets,
    previewDeployment,
    settleFixedBattery,
    setupLocaleOf,
    withBatteryFixed,
    withCorpsOffMapToggled,
    withDetachmentRecalled,
    stanceTargets,
    withCorpsStance,
    withUnitAssigned,
    withUnitDetached
} from './deploymentEdits.js'
import { TargetKind } from './targets.js'

const LANNES_GUNS = 'F36'
const VANDAMME_GUNS = 'F05'
const LANNES_FOOT = 'F19'

interface FrenchSetup {
    state: HydratedNapoleonsTriumphGameState
    playerId: string
    deployment: Deployment
}

function frenchSetup(): FrenchSetup {
    const game = new TestGame()
    game.deploy(Side.Allied)
    const state = game.hydrated
    return {
        state,
        playerId: game.playerOf(Side.French),
        deployment: suggestedDeployment(state, Side.French)
    }
}

function approachesAround(state: HydratedNapoleonsTriumphGameState, commanderId: string) {
    return state.map
        .passableApproachesOf(setupLocaleOf(state.map, commanderId).id)
        .map((approach) => approach.id)
}

function facing(deployment: Deployment, commanderId: string, approach: number): Deployment {
    return {
        ...deployment,
        corps: deployment.corps.map((corps) =>
            corps.commanderId === commanderId ? { ...corps, approach } : corps
        )
    }
}

describe('the fixed battery of a set-up', () => {
    it('is not asked of the Allies', () => {
        const game = new TestGame()
        const allied = suggestedDeployment(game.hydrated, Side.Allied)
        expect(settleFixedBattery(game.hydrated, Side.Allied, allied)).toBe(allied)
    })

    it('is the first guns on the map, aimed across an approach of their locale, when none is named', () => {
        const { state, deployment } = frenchSetup()
        const settled = settleFixedBattery(state, Side.French, {
            ...deployment,
            fixedBattery: undefined
        })
        expect(settled.fixedBattery?.unitId).toBe(LANNES_GUNS)
        expect(approachesAround(state, 'lannes')).toContain(settled.fixedBattery?.approach)
    })

    it('stays with the guns the player named, aimed where the player aimed them', () => {
        const { state, deployment } = frenchSetup()
        const [, second] = approachesAround(state, 'vandamme')
        const named = settleFixedBattery(state, Side.French, {
            ...deployment,
            fixedBattery: { unitId: VANDAMME_GUNS, approach: second }
        })
        expect(named.fixedBattery).toEqual({ unitId: VANDAMME_GUNS, approach: second })
    })

    it('is aimed anew when the approach named no longer borders the guns', () => {
        const { state, deployment } = frenchSetup()
        const [elsewhere] = approachesAround(state, 'lannes')
        const moved = settleFixedBattery(state, Side.French, {
            ...deployment,
            fixedBattery: { unitId: VANDAMME_GUNS, approach: elsewhere }
        })
        expect(moved.fixedBattery?.unitId).toBe(VANDAMME_GUNS)
        expect(approachesAround(state, 'vandamme')).toContain(moved.fixedBattery?.approach)
    })

    it('names no approach for guns that already stand on one', () => {
        const { state, deployment } = frenchSetup()
        const [front] = approachesAround(state, 'lannes')
        const settled = settleFixedBattery(state, Side.French, {
            ...facing(deployment, 'lannes', front),
            fixedBattery: undefined
        })
        expect(settled.fixedBattery).toEqual({ unitId: LANNES_GUNS, approach: undefined })
    })

    it('passes to other guns when the ones named leave the map, and to none when no guns are left on it', () => {
        const { state, deployment } = frenchSetup()
        const withoutLannes = withCorpsOffMapToggled(deployment, 'lannes')
        const passed = settleFixedBattery(state, Side.French, withoutLannes)
        expect(passed.fixedBattery?.unitId).toBe(VANDAMME_GUNS)

        const withoutGuns = withCorpsOffMapToggled(withoutLannes, 'vandamme')
        expect(settleFixedBattery(state, Side.French, withoutGuns).fixedBattery).toBeUndefined()
    })
})

describe('arranging a set-up', () => {
    it('gives a unit to another corps, taking it from its own and recalling it if detached', () => {
        const { deployment } = frenchSetup()
        const detached = withUnitDetached(deployment, LANNES_FOOT, { locale: 64 })
        const given = withUnitAssigned(detached, LANNES_FOOT, 'murat')
        const unitsOf = (commanderId: string) =>
            given.corps.find((corps) => corps.commanderId === commanderId)?.unitIds
        expect(unitsOf('murat')?.at(-1)).toBe(LANNES_FOOT)
        expect(unitsOf('lannes')).not.toContain(LANNES_FOOT)
        expect(given.detachments).toEqual([])
    })

    it('detaches a unit to one place at a time, and recalls it', () => {
        const { deployment } = frenchSetup()
        const first = withUnitDetached(deployment, LANNES_FOOT, { locale: 64 })
        const second = withUnitDetached(first, LANNES_FOOT, { locale: 63 })
        expect(second.detachments).toEqual([{ unitId: LANNES_FOOT, position: { locale: 63 } }])
        expect(withDetachmentRecalled(second, LANNES_FOOT).detachments).toEqual([])
    })

    it('offers a corps every approach of its own locale, and its reserve once it stands on one', () => {
        const { state, deployment } = frenchSetup()
        const approaches = approachesAround(state, 'lannes')
        const offered = (arranged: Deployment) =>
            stanceTargets(state.map, arranged, 'lannes').map((target) => ({
                kind: target.kind,
                approach: target.kind === TargetKind.Approach ? target.position.approach : undefined
            }))
        expect(offered(deployment)).toEqual(
            approaches.map((approach) => ({ kind: TargetKind.Approach, approach }))
        )

        const [front, ...others] = approaches
        const forward = withCorpsStance(deployment, 'lannes', front)
        expect(forward.corps.find((corps) => corps.commanderId === 'lannes')?.approach).toBe(front)
        expect(offered(forward)).toEqual([
            { kind: TargetKind.Reserve, approach: undefined },
            ...others.map((approach) => ({ kind: TargetKind.Approach, approach }))
        ])
        expect(withCorpsStance(forward, 'lannes', undefined)).toEqual(deployment)
    })

    it('offers no stance to a corps held off the map', () => {
        const { state, deployment } = frenchSetup()
        expect(stanceTargets(state.map, deployment, 'bernadotte')).toEqual([])
    })

    it('holds a corps off the map, without a stance, and brings it back', () => {
        const { state, deployment } = frenchSetup()
        const [front] = approachesAround(state, 'lannes')
        const held = withCorpsOffMapToggled(facing(deployment, 'lannes', front), 'lannes')
        const lannes = held.corps.find((corps) => corps.commanderId === 'lannes')
        expect(lannes).toEqual({
            commanderId: 'lannes',
            unitIds: deployment.corps.find((corps) => corps.commanderId === 'lannes')?.unitIds,
            offMap: true
        })
        const back = withCorpsOffMapToggled(held, 'lannes')
        expect(back.corps.find((corps) => corps.commanderId === 'lannes')).not.toHaveProperty(
            'offMap'
        )
    })

    it('names guns as the fixed battery', () => {
        const { deployment } = frenchSetup()
        expect(withBatteryFixed(deployment, VANDAMME_GUNS).fixedBattery).toEqual({
            unitId: VANDAMME_GUNS
        })
    })
})

describe('where a French unit may be detached to', () => {
    it('is every reserve and approach the rules allow within reach of its corps', () => {
        const { state, playerId, deployment } = frenchSetup()
        const home = setupLocaleOf(state.map, 'lannes').id
        const targets = detachmentTargets(state, playerId, deployment, LANNES_FOOT)
        expect(targets.some((target) => target.kind === TargetKind.Reserve)).toBe(true)
        expect(targets.some((target) => target.kind === TargetKind.Approach)).toBe(true)
        expect(new Set(targets.map((target) => target.key)).size).toBe(targets.length)
        for (const target of targets) {
            expect(state.map.distance(home, target.position.locale)).toBeLessThanOrEqual(
                DETACHMENT_REACH
            )
            const detached = settleFixedBattery(
                state,
                Side.French,
                withUnitDetached(deployment, LANNES_FOOT, target.position)
            )
            expect(previewDeployment(state, playerId, detached).problem).toBeUndefined()
        }
    })

    it('is nowhere for a unit of a corps held off the map, or for the Allies', () => {
        const { state, playerId, deployment } = frenchSetup()
        const offMap = deployment.corps.find((corps) => corps.offMap)
        assertExists(offMap, 'The French hold reinforcements off the map')
        expect(detachmentTargets(state, playerId, deployment, offMap.unitIds[0])).toEqual([])

        const game = new TestGame()
        const allied = suggestedDeployment(game.hydrated, Side.Allied)
        expect(
            detachmentTargets(
                game.hydrated,
                game.playerOf(Side.Allied),
                allied,
                allied.corps[0].unitIds[0]
            )
        ).toEqual([])
    })

    it('is nowhere for one more unit once the army has detached all it may, though those may still be moved', () => {
        const { state, playerId, deployment } = frenchSetup()
        const onMap = deployment.corps.filter((corps) => !corps.offMap)
        const detachedIds = onMap.slice(0, MAX_FRENCH_DETACHMENTS).map((corps) => corps.unitIds[0])
        const full = detachedIds.reduce((arranged, unitId) => {
            const [target] = detachmentTargets(state, playerId, arranged, unitId)
            return settleFixedBattery(
                state,
                Side.French,
                withUnitDetached(arranged, unitId, target.position)
            )
        }, deployment)
        expect(full.detachments).toHaveLength(MAX_FRENCH_DETACHMENTS)
        expect(detachmentTargets(state, playerId, full, onMap[0].unitIds[1])).toEqual([])
        expect(detachmentTargets(state, playerId, full, detachedIds[0]).length).toBeGreaterThan(0)
    })
})

describe('previewing a set-up', () => {
    it('shows the army standing where the set-up puts it', () => {
        const { state, playerId, deployment } = frenchSetup()
        const preview = previewDeployment(state, playerId, deployment)
        expect(preview.problem).toBeUndefined()
        expect(preview.state?.commander('lannes').position).toEqual({
            locale: setupLocaleOf(state.map, 'lannes').id,
            approach: undefined
        })
        expect(state.commander('lannes').position).toBeUndefined()
    })

    it('says what is wrong with a set-up the rules refuse', () => {
        const { state, playerId, deployment } = frenchSetup()
        const lannes = deployment.corps.find((corps) => corps.commanderId === 'lannes')
        assertExists(lannes, 'Lannes commands a French corps')
        const emptied = lannes.unitIds.reduce(
            (arranged, unitId) => withUnitAssigned(arranged, unitId, 'murat'),
            deployment
        )
        const preview = previewDeployment(state, playerId, emptied)
        expect(preview.state).toBeUndefined()
        expect(preview.problem).toEqual(expect.any(String))
    })
})
