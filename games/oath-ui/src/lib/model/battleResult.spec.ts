import { describe, expect, it } from 'vitest'
import { assert, type GameAction } from '@tabletop/common'
import {
    HydratedOathGameState,
    isCampaign,
    type Campaign,
    type OathProjectedState
} from '@tabletop/oath'
import { required, served, spectator } from '@tabletop/oath/testing'
import {
    battleResultTable,
    type Battle,
    type BattleResultScene
} from '$lib/testing/battleResultTable.js'
import {
    battleLine,
    currentCampaignSteps,
    resultWords,
    spoilsLine,
    type ResultPart
} from './battleResult.js'

function hydrated(state: OathProjectedState): HydratedOathGameState {
    return new HydratedOathGameState(state)
}

function battle(scene: BattleResultScene, more: Partial<Battle> = {}, actions?: GameAction[]) {
    const table = battleResultTable(scene, more)
    const state = hydrated(table.state)
    const steps = currentCampaignSteps(actions ?? table.actions)
    return battleLine(state, required(state.campaign, 'the battle'), steps)
}

function spoils(scene: BattleResultScene, viewerId?: string, more: Partial<Battle> = {}) {
    const table = battleResultTable(scene, more)
    const state = hydrated(table.state)
    const campaign = required(state.campaign, 'the spoils')
    return spoilsLine(state, campaign, currentCampaignSteps(table.actions), viewerId)
}

const words = (parts: readonly ResultPart[] | undefined) => resultWords(required(parts, 'a line'))
const rose = (parts: readonly ResultPart[]) =>
    parts.flatMap((part) => (part.kind === 'rose' ? [part.text] : []))

describe('R-5.5.5 — the battle line, before the sacrifice', () => {
    it('counts the gap in swords: 4 against 6 is 3 short, a tie being the defender’s', () => {
        const line = battle('gap')
        expect(resultWords(line)).toBe(
            '1 [skull] rolled: 1 [warband] died. 4 [sword] against 6 [shield]: you are 3 short.'
        )
        expect(rose(line)).toEqual(['died', '3 short'])
    })

    it('with Zealots, the same gap in swords over a sacrifice of 1', () => {
        expect(resultWords(battle('zealots'))).toBe(
            '1 [skull] rolled: 1 [warband] died. 4 [sword] against 6 [shield]: you are 3 short.'
        )
    })

    it('a battle too far short says so the same way, with no skull rolled', () => {
        expect(resultWords(battle('short'))).toBe('2 [sword] against 6 [shield]: you are 5 short.')
    })

    it('who won and why, with counts: the skulls, then the swords against the defense', () => {
        expect(resultWords(battle('outright'))).toBe(
            '2 [skull] rolled: 2 [warband] died. 6 [sword] against 5 [shield]: you win.'
        )
        expect(resultWords(battle('bandits'))).toBe('3 [sword] against 2 [shield]: you win.')
    })

    it('a battle a plan decided names the card and the victor', () => {
        const line = battle('hearts')
        expect(resultWords(line)).toBe(
            '[Hearts and Minds]Hearts and Minds decided the battle: [Ann] is victorious.'
        )
        expect(line[0]).toEqual({ kind: 'card', cardId: 'denizen.hearth.hearts-and-minds' })
    })

    it('skulls the record says took nothing (Outriders) leave the skulls out', () => {
        expect(resultWords(battle('outright', { skullsKilled: 0 }))).toBe(
            '6 [sword] against 5 [shield]: you win.'
        )
    })

    it("the skulls' warbands the attacker's own Hospital holds are set aside, not dead", () => {
        const line = battle('outright', { attackerHospital: true })
        expect(resultWords(line)).toBe(
            '2 [skull] rolled: 2 [warband] are set aside at Hospital. 6 [sword] against 5 [shield]: you win.'
        )
        expect(rose(line)).toEqual([])
    })

    it("counts only this Campaign's skulls, not an earlier Campaign's", () => {
        const table = battleResultTable('gap')
        const declared = table.actions[0]
        assert(isCampaign(declared), 'the history starts with the declaration')
        const metadata = required(declared.metadata, 'the declaration’s record')
        const battleRecord = required(metadata.battle, 'the battle as recorded')
        const earlier: Campaign = {
            ...declared,
            id: 'earlier',
            metadata: { ...metadata, battle: { ...battleRecord, skullsKilled: 3 } }
        }
        expect(resultWords(battle('gap', {}, [earlier, ...table.actions]))).toMatch(
            /^1 \[skull\] rolled: 1 \[warband\] died\./
        )
    })
})

describe('R-5.5.6 — where the defence went, first in the spoils', () => {
    it('the dead, in rose, and the survivors home to their board', () => {
        const line = spoils('outrightSpoils', 'Dana')
        expect(words(line)).toBe(
            "You won: 2 of [Ann]'s defence died, and the other 2 went home to their board."
        )
        expect(rose(required(line, 'a line'))).toEqual(['died'])
    })

    it("Hospital's warbands are set aside at Hospital, not dead", () => {
        const line = spoils('hospitalSpoils', 'Dana')
        expect(words(line)).toBe(
            "You won: 2 of [Ann]'s defence are set aside at Hospital, and the other 2 went home to their board."
        )
        expect(rose(required(line, 'a line'))).toEqual([])
    })

    it("Wrestlers' warband Hospital set aside before the roll is not one of the defence's losses", () => {
        expect(words(spoils('hospitalSpoils', 'Dana', { wrestlers: true }))).toBe(
            "You won: 2 of [Ann]'s defence are set aside at Hospital, and the other 2 went home to their board."
        )
    })

    it('the bandits went into hiding', () => {
        expect(words(spoils('banditsSpoils', 'Dana'))).toBe('You won: the bandit went into hiding.')
    })

    it("an ally's survivors went home to their boards; Ann's own pick of which died", () => {
        expect(words(spoils('allySpoils', 'Dana'))).toBe(
            "You won: 3 of [Ann]'s defence died, and the other 3 went home to their boards."
        )
        expect(words(spoils('allyHospitalSpoils', 'Dana'))).toBe(
            "You won: 1 of [Ann]'s defence died, 2 are set aside at Hospital, and the other 3 went home to their boards."
        )
    })

    it('the Obsidian Cage took the other 3', () => {
        const line = required(spoils('cageSpoils', 'Dana'), 'a line')
        expect(resultWords(line)).toBe(
            "You won: 3 of [Ann]'s defence died, and [Obsidian Cage]Obsidian Cage took the other 3."
        )
        expect(line).toContainEqual({ kind: 'card', cardId: 'relic.obsidian-cage' })
    })

    it("Peace Envoy's victory kills nothing: the defence went home", () => {
        expect(words(spoils('envoySpoils', 'Dana'))).toBe(
            "You won: [Ann]'s defence went home to their board."
        )
    })

    it('another seat reads who won by their chip', () => {
        expect(words(spoils('outrightSpoils', 'Ann'))).toBe(
            "[Dana] won: 2 of [Ann]'s defence died, and the other 2 went home to their board."
        )
        expect(words(spoils('outrightSpoils', undefined))).toMatch(/^\[Dana\] won: /)
    })

    it("every seat's served view reads the same lines as the server's state", () => {
        for (const scene of ['allyHospitalSpoils', 'cageSpoils'] as const) {
            const table = battleResultTable(scene)
            const state = hydrated(table.state)
            const steps = currentCampaignSteps(table.actions)
            const line = (view: HydratedOathGameState) =>
                resultWords(
                    required(
                        spoilsLine(view, required(view.campaign, 'the spoils'), steps, 'Rhys'),
                        'a line'
                    )
                )
            for (const viewer of [
                spectator,
                ...state.players.map((p) => ({ kind: 'player' as const, playerId: p.playerId }))
            ]) {
                expect(line(new HydratedOathGameState(served(state, viewer)))).toBe(line(state))
            }
        }
    })
})
