import { describe, expect, it } from 'vitest'
import { setStagedSelectionValue } from '@tabletop/frontend-components'
import { CommandKind } from '@tabletop/napoleons-triumph'
import {
    AttackWidth,
    StageKind,
    attackerSelection,
    chooseFeint,
    chooseRetreat,
    defenceSelection,
    emptyBattleSelections,
    hasManualBattleSelection,
    nameAttackers,
    nameLeaders,
    retreatSelection,
    setAttackCommand,
    setAttackWidth,
    setCommandersGoing,
    setKeptInCorps,
    sendRetreating,
    setRetreatLosses,
    setStruckLeader,
    undoBattleSelection,
    type BattleSelections
} from './battleSelection.js'
import {
    addWayStep,
    chooseCorpsUnit,
    chooseDetachedUnit,
    chosenCommandOf,
    chosenUnitsOf,
    destinationOf,
    guardAttackAnnounced,
    hasManualCommandSelection,
    noCommandSelection,
    pickedUpOf,
    rideOf,
    setCommand,
    setDestination,
    setGuardAttack,
    setPickedUp,
    setRide,
    undoCommandSelection,
    unitsPickedUpWith,
    wayStepsOf,
    type CommandSelection
} from './commandSelection.js'
import { RideChoice } from './moveCommands.js'
import type { ArmySetup } from './armySetup.js'
import {
    DestinationKind,
    hasManualSetupSelection,
    latestArrangement,
    noSetupSelection,
    recordArrangement,
    sameDestination,
    undoSetupSelection,
    type SetupDestination
} from './setupSelection.js'
import { stagedSelection } from './stagedSelection.js'

function corpsPickedUp() {
    return setPickedUp({ groupKey: 'corps' })
}

describe('command selection', () => {
    it('starts over when other pieces are picked up', () => {
        const announced = setGuardAttack(setCommand(corpsPickedUp(), CommandKind.Detach), true)
        const other = setPickedUp({ groupKey: 'other' })
        expect(pickedUpOf(announced)).toEqual({ groupKey: 'corps' })
        expect(pickedUpOf(other)).toEqual({ groupKey: 'other' })
        expect(chosenCommandOf(other)).toBeUndefined()
        expect(guardAttackAnnounced(other)).toBe(false)
    })

    it('undoes the latest manual stage and what followed it, one press at a time', () => {
        const announced = setGuardAttack(setCommand(corpsPickedUp(), CommandKind.Corps), true)
        const commanded = undoCommandSelection(announced)
        expect(guardAttackAnnounced(commanded)).toBe(false)
        expect(chosenCommandOf(commanded)).toBe(CommandKind.Corps)

        const picked = undoCommandSelection(commanded)
        expect(chosenCommandOf(picked)).toBeUndefined()
        expect(pickedUpOf(picked)).toEqual({ groupKey: 'corps' })

        const nothing = undoCommandSelection(picked)
        expect(nothing).toEqual(noCommandSelection())
    })

    it('returns to the units a pick-up starts with when leaving some out is undone', () => {
        const thinned = chooseDetachedUnit(corpsPickedUp(), 'F01', ['F02'], false)
        expect(chosenUnitsOf(thinned)).toEqual(['F01'])
        const restored = undoCommandSelection(thinned)
        expect(chosenUnitsOf(restored)).toBeUndefined()
        expect(pickedUpOf(restored)).toEqual({ groupKey: 'corps' })
    })

    it('commands detached units one at a time, or two together where they may be', () => {
        const one = chooseDetachedUnit(corpsPickedUp(), 'F01', [], false)
        expect(chosenUnitsOf(chooseDetachedUnit(one, 'F02', ['F01'], false))).toEqual(['F02'])

        const two = chooseDetachedUnit(one, 'F02', ['F01'], true)
        expect(chosenUnitsOf(two)).toEqual(['F01', 'F02'])
        expect(chosenUnitsOf(chooseDetachedUnit(two, 'F01', ['F01', 'F02'], false))).toEqual([
            'F02'
        ])
        expect(chooseDetachedUnit(one, 'F01', ['F01'], false)).toEqual(noCommandSelection())
    })

    it('leaves Undo to the last action when nothing has been chosen', () => {
        expect(hasManualCommandSelection(noCommandSelection())).toBe(false)
        expect(undoCommandSelection(noCommandSelection())).toEqual(noCommandSelection())
    })

    it('changes the command without withdrawing the Guard Attack, and withdraws it when asked', () => {
        const announced = setGuardAttack(setCommand(corpsPickedUp(), CommandKind.Corps), true)
        const recommanded = setCommand(announced, CommandKind.Detach)
        expect(chosenCommandOf(recommanded)).toBe(CommandKind.Detach)
        expect(guardAttackAnnounced(recommanded)).toBe(true)
        expect(guardAttackAnnounced(setGuardAttack(recommanded, false))).toBe(false)
    })
})

describe('a staged selection', () => {
    type Values = { first: string; second: string }
    const selection = stagedSelection<Values>()(['first', 'second'])

    it('clears later stages when an earlier one is set', () => {
        const both = selection.set(
            selection.set(selection.empty(), 'first', 'a', 'manual'),
            'second',
            'b',
            'manual'
        )
        const reset = selection.set(both, 'first', 'c', 'manual')
        expect(selection.value(reset, 'first')).toBe('c')
        expect(selection.value(reset, 'second')).toBeUndefined()
    })

    it('keeps later stages when an earlier one is revised or withdrawn', () => {
        const both = selection.set(
            selection.set(selection.empty(), 'first', 'a', 'manual'),
            'second',
            'b',
            'manual'
        )
        expect(selection.value(selection.revise(both, 'first', 'c', 'manual'), 'second')).toBe('b')
        const withdrawn = selection.withdraw(both, 'first')
        expect(selection.value(withdrawn, 'first')).toBeUndefined()
        expect(selection.value(withdrawn, 'second')).toBe('b')
    })

    it('leaves automatic picks alone when Undo is pressed', () => {
        const automatic = selection.set(selection.empty(), 'first', 'a', 'auto')
        expect(selection.hasManual(automatic)).toBe(false)
        expect(selection.undo(automatic)).toEqual(automatic)
    })

    it('rejects a stage its order does not hold', () => {
        expect(() =>
            setStagedSelectionValue<Values, 'second'>({}, ['first'], 'second', 'b', 'manual')
        ).toThrow(/does not exist in stage order/)
    })
})

describe('choosing units of a corps', () => {
    const MOVABLE = ['F01', 'F02', 'F03']

    it('sends only the units tapped, one more with each tap', () => {
        const one = chooseCorpsUnit(corpsPickedUp(), 'F02', MOVABLE)
        expect(chosenUnitsOf(one)).toEqual(['F02'])
        const two = chooseCorpsUnit(one, 'F03', MOVABLE)
        expect(chosenUnitsOf(two)).toEqual(['F02', 'F03'])
    })

    it('is the whole corps again once every unit is chosen, or none', () => {
        const two = chooseCorpsUnit(
            chooseCorpsUnit(corpsPickedUp(), 'F01', MOVABLE),
            'F02',
            MOVABLE
        )
        expect(chosenUnitsOf(chooseCorpsUnit(two, 'F03', MOVABLE))).toBeUndefined()

        const one = chooseCorpsUnit(corpsPickedUp(), 'F01', MOVABLE)
        const none = chooseCorpsUnit(one, 'F01', MOVABLE)
        expect(chosenUnitsOf(none)).toBeUndefined()
        expect(pickedUpOf(none)).toEqual({ groupKey: 'corps' })
    })

    it('keeps the command and the Guard Attack announcement when the units change', () => {
        const announced = setGuardAttack(
            setCommand(chooseCorpsUnit(corpsPickedUp(), 'F01', MOVABLE), CommandKind.Corps),
            true
        )
        const more = chooseCorpsUnit(announced, 'F02', MOVABLE)
        expect(chosenUnitsOf(more)).toEqual(['F01', 'F02'])
        expect(chosenCommandOf(more)).toBe(CommandKind.Corps)
        expect(guardAttackAnnounced(more)).toBe(true)

        const whole = chooseCorpsUnit(more, 'F03', MOVABLE)
        expect(chosenUnitsOf(whole)).toBeUndefined()
        expect(chosenCommandOf(whole)).toBe(CommandKind.Corps)
        expect(guardAttackAnnounced(whole)).toBe(true)

        const another = chooseDetachedUnit(
            setCommand(corpsPickedUp(), CommandKind.Unit),
            'F02',
            ['F01'],
            false
        )
        expect(chosenCommandOf(another)).toBe(CommandKind.Unit)
    })
})

describe('what a pick-up starts with', () => {
    const MOVABLE = ['F02', 'F03']
    const NO_RIDERS: string[] = []

    it('is every unit of a corps that can still move', () => {
        expect(unitsPickedUpWith({ groupKey: 'corps' }, MOVABLE, true, NO_RIDERS)).toEqual(MOVABLE)
    })

    it('is the detached unit that was tapped, when it can still move', () => {
        expect(
            unitsPickedUpWith({ groupKey: 'loose', tappedUnitId: 'F03' }, MOVABLE, false, NO_RIDERS)
        ).toEqual(['F03'])
    })

    it('is the first detached unit that can move when the tapped one cannot, or none was tapped', () => {
        expect(
            unitsPickedUpWith({ groupKey: 'loose', tappedUnitId: 'F01' }, MOVABLE, false, NO_RIDERS)
        ).toEqual(['F02'])
        expect(unitsPickedUpWith({ groupKey: 'loose' }, MOVABLE, false, NO_RIDERS)).toEqual(['F02'])
        expect(unitsPickedUpWith({ groupKey: 'loose' }, [], false, NO_RIDERS)).toEqual([])
    })

    it('is the cavalry riding on in the group, unless another unit that can move was tapped', () => {
        const RIDERS = ['F01']
        expect(unitsPickedUpWith(undefined, MOVABLE, false, RIDERS)).toEqual(RIDERS)
        expect(unitsPickedUpWith({ groupKey: 'loose' }, MOVABLE, false, RIDERS)).toEqual(RIDERS)
        expect(
            unitsPickedUpWith({ groupKey: 'loose', tappedUnitId: 'F01' }, MOVABLE, false, RIDERS)
        ).toEqual(RIDERS)
        expect(
            unitsPickedUpWith({ groupKey: 'loose', tappedUnitId: 'F03' }, MOVABLE, false, RIDERS)
        ).toEqual(['F03'])
        expect(unitsPickedUpWith({ groupKey: 'corps' }, [], true, ['F01', 'F02'])).toEqual([
            'F01',
            'F02'
        ])
    })
})

describe('a new command for cavalry riding on', () => {
    it('is the player’s own choice, taken back by Undo or by choosing riding on again', () => {
        expect(rideOf(noCommandSelection())).toBe(RideChoice.RidingOn)
        const anew = setRide(noCommandSelection(), RideChoice.NewCommand)
        expect(rideOf(anew)).toBe(RideChoice.NewCommand)
        expect(hasManualCommandSelection(anew)).toBe(true)
        expect(rideOf(undoCommandSelection(anew))).toBe(RideChoice.RidingOn)
        expect(setRide(anew, RideChoice.RidingOn)).toEqual(noCommandSelection())
    })

    it('keeps the command chosen for it, and is dropped when other units are chosen', () => {
        const commanded = setCommand(
            setRide(noCommandSelection(), RideChoice.NewCommand),
            CommandKind.Unit
        )
        const otherUnits = [
            chooseDetachedUnit(commanded, 'F02', ['F01'], false),
            chooseCorpsUnit(commanded, 'F01', ['F01', 'F02'])
        ]
        expect(rideOf(commanded)).toBe(RideChoice.NewCommand)
        expect(chosenCommandOf(commanded)).toBe(CommandKind.Unit)
        expect(otherUnits.map(rideOf)).toEqual([RideChoice.RidingOn, RideChoice.RidingOn])
    })
})

describe('the place a march is bound for', () => {
    function bound(): CommandSelection {
        return addWayStep(setDestination(setPickedUp({ groupKey: 'corps' }), 'Reserve:53:r'), 'a')
    }

    it('is kept with the steps of the way tapped so far, and Undo takes them back one at a time', () => {
        expect(destinationOf(bound())).toBe('Reserve:53:r')
        const twoSteps = addWayStep(bound(), 'b')
        expect(wayStepsOf(twoSteps)).toEqual(['a', 'b'])
        expect(wayStepsOf(undoCommandSelection(twoSteps))).toEqual(['a'])
        const steppedBack = undoCommandSelection(bound())
        expect(wayStepsOf(steppedBack)).toEqual([])
        expect(destinationOf(steppedBack)).toBe('Reserve:53:r')
        expect(destinationOf(undoCommandSelection(steppedBack))).toBeUndefined()
    })

    it('is forgotten when the order changes, since the places on offer change with it', () => {
        expect(destinationOf(setCommand(bound(), CommandKind.Detach))).toBeUndefined()
        expect(destinationOf(chooseCorpsUnit(bound(), 'F01', ['F01', 'F02']))).toBeUndefined()
        expect(destinationOf(chooseDetachedUnit(bound(), 'F02', ['F01'], false))).toBeUndefined()
        expect(destinationOf(setGuardAttack(bound(), true))).toBeUndefined()
        expect(wayStepsOf(setCommand(bound(), CommandKind.Detach))).toEqual([])
    })
})

describe('battle selections', () => {
    function defended(): BattleSelections {
        const start = emptyBattleSelections()
        return {
            ...start,
            defence: defenceSelection.set(start.defence, 'defenders', ['A01'], 'manual')
        }
    }

    function attacking(): BattleSelections {
        const start = emptyBattleSelections()
        const led = nameLeaders(nameAttackers(start.attackers, ['F01', 'F02']), ['F01'])
        return {
            ...start,
            attackers: setAttackCommand(setAttackWidth(led, AttackWidth.Narrow), CommandKind.Detach)
        }
    }

    it('keeps the defence picked while a retreat is arranged, and returns to it', () => {
        const retreating = { ...defended(), defence: chooseRetreat(defended().defence) }
        const sent = {
            ...retreating,
            retreat: sendRetreating(retreating.retreat, [{ unitId: 'A01', locale: 83 }])
        }
        const afterFirst = undoBattleSelection(sent, StageKind.Retreat)
        expect(retreatSelection.hasManual(afterFirst.retreat)).toBe(false)
        expect(defenceSelection.value(afterFirst.defence, 'retreating')).toBe(true)

        const afterSecond = undoBattleSelection(afterFirst, StageKind.Retreat)
        expect(defenceSelection.value(afterSecond.defence, 'retreating')).toBeUndefined()
        expect(defenceSelection.value(afterSecond.defence, 'defenders')).toEqual(['A01'])

        const afterThird = undoBattleSelection(afterSecond, StageKind.Defence)
        expect(hasManualBattleSelection(afterThird, StageKind.Defence)).toBe(false)
    })

    it('pops exactly one manual stage with each press of Undo: the highest of the step in front of the player', () => {
        const chosen = attacking()
        const once = undoBattleSelection(chosen, StageKind.Declaration)
        expect(attackerSelection.value(once.attackers, 'width')).toBeUndefined()
        expect(attackerSelection.value(once.attackers, 'leaders')).toEqual(['F01'])
        expect(attackerSelection.value(once.attackers, 'command')).toBe(CommandKind.Detach)
        expect(attackerSelection.value(once.attackers, 'attackers')).toEqual(['F01', 'F02'])

        const twice = undoBattleSelection(once, StageKind.Declaration)
        expect(attackerSelection.value(twice.attackers, 'leaders')).toBeUndefined()
        expect(attackerSelection.value(twice.attackers, 'command')).toBe(CommandKind.Detach)
    })

    it('leaves the picks of every other step alone', () => {
        const start = emptyBattleSelections()
        const everyStep: BattleSelections = {
            ...attacking(),
            defence: chooseRetreat(defended().defence),
            retreat: setKeptInCorps(setRetreatLosses(start.retreat, { A01: 1 }), {
                langeron: 'A01'
            }),
            advance: setCommandersGoing(start.advance, ['lannes'])
        }
        const undone = undoBattleSelection(everyStep, StageKind.Declaration)
        expect(undone.defence).toEqual(everyStep.defence)
        expect(undone.retreat).toEqual(everyStep.retreat)
        expect(undone.advance).toEqual(everyStep.advance)
        expect(undone.counter).toEqual(everyStep.counter)
        expect(undone.excessLosses).toEqual(everyStep.excessLosses)
        expect(undone.regroup).toEqual(everyStep.regroup)
        expect(undone.attackers).not.toEqual(everyStep.attackers)

        const advanceUndone = undoBattleSelection(everyStep, StageKind.Advance)
        expect(advanceUndone.attackers).toEqual(everyStep.attackers)
        expect(hasManualBattleSelection(advanceUndone, StageKind.Advance)).toBe(false)
    })

    it('offers Undo only for picks of the step in front of the player', () => {
        expect(hasManualBattleSelection(attacking(), StageKind.Declaration)).toBe(true)
        expect(hasManualBattleSelection(attacking(), StageKind.Feint)).toBe(true)
        expect(hasManualBattleSelection(attacking(), StageKind.Defence)).toBe(false)
        expect(hasManualBattleSelection(attacking(), StageKind.OddLoss)).toBe(false)
        expect(undoBattleSelection(attacking(), StageKind.OddLoss)).toEqual(attacking())
    })

    it('takes back calling a feint after the pieces named for it', () => {
        const start = emptyBattleSelections()
        const named = {
            ...start,
            attackers: nameAttackers(chooseFeint(start.attackers), ['F01'])
        }
        const unnamed = undoBattleSelection(named, StageKind.Feint)
        expect(attackerSelection.value(unnamed.attackers, 'attackers')).toBeUndefined()
        expect(attackerSelection.value(unnamed.attackers, 'feinting')).toBe(true)
        const uncalled = undoBattleSelection(unnamed, StageKind.Feint)
        expect(hasManualBattleSelection(uncalled, StageKind.Feint)).toBe(false)
    })

    it('starts the attack choices over when the attackers change', () => {
        const start = attackerSelection.set(
            attackerSelection.empty(),
            'attackers',
            ['F01', 'F02'],
            'manual'
        )
        const led = attackerSelection.set(
            attackerSelection.set(start, 'command', CommandKind.Detach, 'manual'),
            'leaders',
            ['F01'],
            'manual'
        )
        const renamed = attackerSelection.set(led, 'attackers', ['F03'], 'manual')
        expect(attackerSelection.value(renamed, 'command')).toBeUndefined()
        expect(attackerSelection.value(renamed, 'leaders')).toBeUndefined()
    })

    it('changes the command, the width or the leading units without touching the others', () => {
        const led = nameLeaders(nameAttackers(attackerSelection.empty(), ['F01', 'F02', 'F03']), [
            'F01',
            'F02'
        ])
        const narrow = setAttackWidth(led, AttackWidth.Narrow)
        const detached = setAttackCommand(narrow, CommandKind.Detach)
        expect(attackerSelection.value(detached, 'width')).toBe(AttackWidth.Narrow)
        expect(attackerSelection.value(detached, 'leaders')).toEqual(['F01', 'F02'])

        const fewer = nameAttackers(detached, ['F01', 'F02'])
        expect(attackerSelection.value(fewer, 'command')).toBe(CommandKind.Detach)
        expect(attackerSelection.value(fewer, 'width')).toBe(AttackWidth.Narrow)

        const leaderless = nameLeaders(fewer, [])
        expect(attackerSelection.value(leaderless, 'leaders')).toBeUndefined()
        expect(leaderless).not.toHaveProperty('leaders')
        expect(attackerSelection.value(leaderless, 'width')).toBe(AttackWidth.Narrow)
    })

    it('names the leading unit struck without touching the other attack choices', () => {
        const struck = setStruckLeader(attacking().attackers, 'A02')
        expect(attackerSelection.value(struck, 'struckLeader')).toBe('A02')
        expect(attackerSelection.value(struck, 'width')).toBe(AttackWidth.Narrow)
        expect(attackerSelection.value(struck, 'command')).toBe(CommandKind.Detach)
    })

    it('keeps where the units go and who stays with a commander when a loss is changed', () => {
        const sent = sendRetreating(retreatSelection.empty(), [{ unitId: 'A01', locale: 83 }])
        const kept = setKeptInCorps(sent, { langeron: 'A01' })
        const relost = setRetreatLosses(kept, { A02: 1 })
        expect(retreatSelection.value(relost, 'destinations')).toEqual([
            { unitId: 'A01', locale: 83 }
        ])
        expect(retreatSelection.value(relost, 'kept')).toEqual({ langeron: 'A01' })
        expect(retreatSelection.value(relost, 'losses')).toEqual({ A02: 1 })
    })

    it('is done sending a unit by itself once somewhere to go is tapped', () => {
        const alone = retreatSelection.set(retreatSelection.empty(), 'sentAlone', 'A01', 'manual')
        const sent = sendRetreating(alone, [{ unitId: 'A01', locale: 83 }])
        expect(retreatSelection.value(sent, 'sentAlone')).toBeUndefined()
        expect(retreatSelection.value(sent, 'destinations')).toEqual([
            { unitId: 'A01', locale: 83 }
        ])
    })
})

describe('set-up selection', () => {
    const lannes: SetupDestination = { kind: DestinationKind.Corps, commanderId: 'lannes' }
    const detached: SetupDestination = { kind: DestinationKind.Detached }
    const posted: ArmySetup = {
        corps: [],
        detached: [{ unitId: 'F01', position: { locale: 53 } }]
    }
    const onTheApproach: ArmySetup = {
        corps: [],
        detached: [{ unitId: 'F01', position: { locale: 53, approach: 7 } }]
    }

    it('takes back one change to the army at a time: the approach blocked, then the place given', () => {
        const placed = recordArrangement(noSetupSelection(), posted)
        const blocking = recordArrangement(placed, onTheApproach)
        expect(latestArrangement(blocking)).toEqual(onTheApproach)

        const inReserveAgain = undoSetupSelection(blocking)
        expect(latestArrangement(inReserveAgain)).toEqual(posted)

        const untouched = undoSetupSelection(inReserveAgain)
        expect(latestArrangement(untouched)).toBeUndefined()
        expect(hasManualSetupSelection(untouched)).toBe(false)
    })

    it('is a manual selection from the first change to the army, so Undo is offered for it', () => {
        expect(hasManualSetupSelection(noSetupSelection())).toBe(false)
        expect(hasManualSetupSelection(recordArrangement(noSetupSelection(), posted))).toBe(true)
    })

    it('tells one corps from another and a corps from the units set up on their own', () => {
        expect(
            sameDestination(lannes, { kind: DestinationKind.Corps, commanderId: 'lannes' })
        ).toBe(true)
        expect(sameDestination(lannes, { kind: DestinationKind.Corps, commanderId: 'murat' })).toBe(
            false
        )
        expect(sameDestination(lannes, detached)).toBe(false)
        expect(sameDestination(detached, { kind: DestinationKind.Detached })).toBe(true)
    })
})
