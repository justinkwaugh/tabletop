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
    leadSelection,
    emptyBattleSelections,
    hasManualBattleSelection,
    nameAttackers,
    nameLeaders,
    retreatSelection,
    setAttackCommand,
    setAttackWidth,
    setCommandersGoing,
    liftCommander,
    setKeptInCorps,
    takeRetreatLosses,
    sendRetreating,
    setRetreatLosses,
    setStruckLeader,
    undoBattleSelection,
    type BattleSelections
} from './battleSelection.js'
import {
    addWayStep,
    aimOf,
    chooseCorpsUnit,
    chooseDetachedUnit,
    chosenCommandOf,
    chosenUnitsOf,
    destinationOf,
    hasManualCommandSelection,
    noCommandSelection,
    pickedUpOf,
    rideOf,
    setCommand,
    setDestination,
    setPickedUp,
    setRide,
    setAim,
    withoutAim,
    setGuardUnit,
    setThreat,
    guardUnitOf,
    threatOf,
    undoCommandSelection,
    unitsPickedUpWith,
    type GroupUnits,
    wayStepsOf,
    type CommandSelection
} from './commandSelection.js'
import { ATTACH, RideChoice } from './moveCommands.js'
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
        const threatening = setThreat(setCommand(corpsPickedUp(), CommandKind.Detach), 246)
        const other = setPickedUp({ groupKey: 'other' })
        expect(pickedUpOf(threatening)).toEqual({ groupKey: 'corps' })
        expect(pickedUpOf(other)).toEqual({ groupKey: 'other' })
        expect(chosenCommandOf(other)).toBeUndefined()
        expect(threatOf(other)).toBeUndefined()
    })

    it('undoes the latest manual stage and what followed it, one press at a time', () => {
        const threatening = setThreat(setCommand(corpsPickedUp(), CommandKind.Corps), 246)
        const commanded = undoCommandSelection(threatening)
        expect(threatOf(commanded)).toBeUndefined()
        expect(chosenCommandOf(commanded)).toBe(CommandKind.Corps)

        const picked = undoCommandSelection(commanded)
        expect(chosenCommandOf(picked)).toBeUndefined()
        expect(pickedUpOf(picked)).toEqual({ groupKey: 'corps' })

        const nothing = undoCommandSelection(picked)
        expect(nothing).toEqual(noCommandSelection())
    })

    it('returns to the units a pick-up starts with when leaving some out is undone', () => {
        const thinned = chooseDetachedUnit(corpsPickedUp(), 'F01', ['F02'])
        expect(chosenUnitsOf(thinned)).toEqual(['F01'])
        const restored = undoCommandSelection(thinned)
        expect(chosenUnitsOf(restored)).toBeUndefined()
        expect(pickedUpOf(restored)).toEqual({ groupKey: 'corps' })
    })

    it('commands detached units one at a time', () => {
        const one = chooseDetachedUnit(corpsPickedUp(), 'F01', [])
        expect(chosenUnitsOf(chooseDetachedUnit(one, 'F02', ['F01']))).toEqual(['F02'])
        expect(chooseDetachedUnit(one, 'F01', ['F01'])).toEqual(noCommandSelection())
    })

    it('chooses Attach as a command, in place of a move, which Undo takes back', () => {
        const unit = setCommand(chooseDetachedUnit(corpsPickedUp(), 'F01', []), CommandKind.Unit)
        const attaching = setCommand(unit, ATTACH)
        expect(chosenCommandOf(attaching)).toBe(ATTACH)
        expect(chosenCommandOf(setCommand(attaching, CommandKind.Unit))).toBe(CommandKind.Unit)
        expect(chosenCommandOf(undoCommandSelection(attaching))).toBeUndefined()
        expect(chosenUnitsOf(undoCommandSelection(attaching))).toEqual(['F01'])
    })

    it('leaves Undo to the last action when nothing has been chosen', () => {
        expect(hasManualCommandSelection(noCommandSelection())).toBe(false)
        expect(undoCommandSelection(noCommandSelection())).toEqual(noCommandSelection())
    })

    it('aims at a locale as a choice of its own, which picking up pieces or Undo puts down', () => {
        const aimed = setAim(noCommandSelection(), 94)
        expect(aimOf(aimed)).toBe(94)
        expect(hasManualCommandSelection(aimed)).toBe(true)
        expect(aimOf(setPickedUp({ groupKey: 'corps' }))).toBeUndefined()
        expect(pickedUpOf(aimed)).toBeUndefined()
        expect(undoCommandSelection(aimed)).toEqual(noCommandSelection())

        const threatening = setThreat(aimed, 246)
        const steppedBack = undoCommandSelection(threatening)
        expect(threatOf(steppedBack)).toBeUndefined()
        expect(aimOf(steppedBack)).toBe(94)
    })

    it('keeps the pieces in hand when aiming, and goes back to them when the aim is put down', () => {
        const inHand = setCommand(corpsPickedUp(), CommandKind.Corps)
        const aimed = setAim(inHand, 94)
        expect(aimOf(aimed)).toBe(94)
        expect(pickedUpOf(aimed)).toEqual(pickedUpOf(inHand))
        expect(chosenCommandOf(aimed)).toBe(CommandKind.Corps)
        expect(undoCommandSelection(aimed)).toEqual(inHand)
        expect(withoutAim(aimed)).toEqual(inHand)
        expect(aimOf(setPickedUp({ groupKey: 'other' }))).toBeUndefined()
    })

    it('takes back the Guard unit chosen for a threat before the threat itself', () => {
        const threatening = setThreat(corpsPickedUp(), 246)
        const shown = setGuardUnit(threatening, 'F-guard')
        expect(guardUnitOf(shown)).toBe('F-guard')
        const unshown = undoCommandSelection(shown)
        expect(guardUnitOf(unshown)).toBeUndefined()
        expect(threatOf(unshown)).toBe(246)
        expect(guardUnitOf(setThreat(shown, 247))).toBeUndefined()
    })

    it('puts down a threat being declared when the order changes, since the threats on offer change with it', () => {
        const threatening = setThreat(setCommand(corpsPickedUp(), CommandKind.Corps), 246)
        const recommanded = setCommand(threatening, CommandKind.Detach)
        expect(chosenCommandOf(recommanded)).toBe(CommandKind.Detach)
        expect(threatOf(recommanded)).toBeUndefined()
        expect(threatOf(chooseCorpsUnit(threatening, 'F01', ['F01', 'F02']))).toBeUndefined()
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

    it('sends a unit that has moved on its own, to be attached, though no unit of the corps can move', () => {
        expect(chosenUnitsOf(chooseCorpsUnit(corpsPickedUp(), 'F01', []))).toEqual(['F01'])
    })

    it('keeps the command when the units change', () => {
        const commanded = setCommand(
            chooseCorpsUnit(corpsPickedUp(), 'F01', MOVABLE),
            CommandKind.Corps
        )
        const more = chooseCorpsUnit(commanded, 'F02', MOVABLE)
        expect(chosenUnitsOf(more)).toEqual(['F01', 'F02'])
        expect(chosenCommandOf(more)).toBe(CommandKind.Corps)

        const whole = chooseCorpsUnit(more, 'F03', MOVABLE)
        expect(chosenUnitsOf(whole)).toBeUndefined()
        expect(chosenCommandOf(whole)).toBe(CommandKind.Corps)

        const another = chooseDetachedUnit(setCommand(corpsPickedUp(), CommandKind.Unit), 'F02', [
            'F01'
        ])
        expect(chosenCommandOf(another)).toBe(CommandKind.Unit)
    })
})

describe('what a pick-up starts with', () => {
    const MOVABLE = ['F02', 'F03']

    function units(movableIds: string[], more: Partial<GroupUnits> = {}): GroupUnits {
        return { movableIds, choosableIds: movableIds, riderIds: [], isCorps: false, ...more }
    }

    it('is every unit of a corps that can still move', () => {
        expect(unitsPickedUpWith({ groupKey: 'corps' }, units(MOVABLE, { isCorps: true }))).toEqual(
            MOVABLE
        )
    })

    it('is the detached unit that was tapped, when it can still move', () => {
        expect(
            unitsPickedUpWith({ groupKey: 'loose', tappedUnitId: 'F03' }, units(MOVABLE))
        ).toEqual(['F03'])
    })

    it('is the first detached unit that can move when the tapped one cannot, or none was tapped', () => {
        expect(
            unitsPickedUpWith({ groupKey: 'loose', tappedUnitId: 'F01' }, units(MOVABLE))
        ).toEqual(['F02'])
        expect(unitsPickedUpWith({ groupKey: 'loose' }, units(MOVABLE))).toEqual(['F02'])
        expect(unitsPickedUpWith({ groupKey: 'loose' }, units([]))).toEqual([])
    })

    it('is the detached unit that was tapped when it cannot move but may be attached', () => {
        const tapped = { groupKey: 'loose', tappedUnitId: 'F01' }
        expect(unitsPickedUpWith(tapped, units([], { choosableIds: ['F01'] }))).toEqual(['F01'])
        expect(
            unitsPickedUpWith(tapped, units(MOVABLE, { choosableIds: ['F01', ...MOVABLE] }))
        ).toEqual(['F01'])
    })

    it('is the first detached unit that may be attached when none can move', () => {
        expect(
            unitsPickedUpWith({ groupKey: 'loose' }, units([], { choosableIds: ['F01'] }))
        ).toEqual(['F01'])
    })

    it('is the cavalry riding on in the group, unless another unit that can move was tapped', () => {
        const riding = units(MOVABLE, { riderIds: ['F01'] })
        expect(unitsPickedUpWith(undefined, riding)).toEqual(['F01'])
        expect(unitsPickedUpWith({ groupKey: 'loose' }, riding)).toEqual(['F01'])
        expect(unitsPickedUpWith({ groupKey: 'loose', tappedUnitId: 'F01' }, riding)).toEqual([
            'F01'
        ])
        expect(unitsPickedUpWith({ groupKey: 'loose', tappedUnitId: 'F03' }, riding)).toEqual([
            'F03'
        ])
        expect(
            unitsPickedUpWith(
                { groupKey: 'corps' },
                units([], { riderIds: ['F01', 'F02'], isCorps: true })
            )
        ).toEqual(['F01', 'F02'])
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
            chooseDetachedUnit(commanded, 'F02', ['F01']),
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
        expect(destinationOf(chooseDetachedUnit(bound(), 'F02', ['F01']))).toBeUndefined()
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

    it('goes back from a retreat being arranged to the defence still picked, passing over where units were sent', () => {
        const retreating = { ...defended(), defence: chooseRetreat(defended().defence) }
        const sent = sendRetreating(retreating, [{ unitId: 'A01', locale: 83 }])
        expect(retreatSelection.hasManual(sent.retreat)).toBe(false)

        const afterFirst = undoBattleSelection(sent, StageKind.Retreat)
        expect(defenceSelection.value(afterFirst.defence, 'retreating')).toBeUndefined()
        expect(defenceSelection.value(afterFirst.defence, 'defenders')).toEqual(['A01'])

        const afterSecond = undoBattleSelection(afterFirst, StageKind.Defence)
        expect(hasManualBattleSelection(afterSecond, StageKind.Defence)).toBe(false)
    })

    it('takes back the naming of a leading unit and nothing of the defence it was named from', () => {
        const leading = {
            ...defended(),
            lead: leadSelection.set(leadSelection.empty(), 'leaders', ['A01'], 'manual')
        }
        expect(hasManualBattleSelection(leading, StageKind.DefenceLeaders)).toBe(true)
        const unnamed = undoBattleSelection(leading, StageKind.DefenceLeaders)
        expect(leadSelection.value(unnamed.lead, 'leaders')).toBeUndefined()
        expect(defenceSelection.value(unnamed.defence, 'defenders')).toEqual(['A01'])
        expect(hasManualBattleSelection(unnamed, StageKind.DefenceLeaders)).toBe(false)
        expect(undoBattleSelection(unnamed, StageKind.DefenceLeaders)).toEqual(unnamed)
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
            retreat: takeRetreatLosses(start).retreat,
            retreatArrangement: { losses: { A01: 1 }, kept: { langeron: 'A01' } },
            advance: setCommandersGoing(start.advance, ['lannes'])
        }
        const undone = undoBattleSelection(everyStep, StageKind.Declaration)
        expect(undone.defence).toEqual(everyStep.defence)
        expect(undone.retreat).toEqual(everyStep.retreat)
        expect(undone.retreatArrangement).toEqual(everyStep.retreatArrangement)
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
        const sent = sendRetreating(emptyBattleSelections(), [{ unitId: 'A01', locale: 83 }])
        const relost = setRetreatLosses(setKeptInCorps(sent, { langeron: 'A01' }), { A02: 1 })
        expect(relost.retreatArrangement).toEqual({
            destinations: [{ unitId: 'A01', locale: 83 }],
            kept: { langeron: 'A01' },
            losses: { A02: 1 }
        })
    })

    it('is done sending a unit by itself once somewhere to go is tapped', () => {
        const start = emptyBattleSelections()
        const alone = {
            ...start,
            retreat: retreatSelection.set(start.retreat, 'sentAlone', 'A01', 'manual')
        }
        const sent = sendRetreating(alone, [{ unitId: 'A01', locale: 83 }])
        expect(retreatSelection.value(sent.retreat, 'sentAlone')).toBeUndefined()
        expect(sent.retreatArrangement.destinations).toEqual([{ unitId: 'A01', locale: 83 }])
    })

    it('gives Undo nothing to take back in moving losses, units or a commander about', () => {
        const lost = setRetreatLosses(emptyBattleSelections(), { A02: 1 })
        const arranged = setKeptInCorps(sendRetreating(lost, [{ unitId: 'A01', locale: 83 }]), {
            langeron: 'A01'
        })
        expect(hasManualBattleSelection(arranged, StageKind.Retreat)).toBe(false)
        expect(undoBattleSelection(arranged, StageKind.Retreat)).toEqual(arranged)
    })

    it('goes back to how the losses fall, dropping where the units were sent', () => {
        const taken = takeRetreatLosses(setRetreatLosses(emptyBattleSelections(), { A02: 1 }))
        const arranged = setKeptInCorps(sendRetreating(taken, [{ unitId: 'A01', locale: 83 }]), {
            langeron: 'A01'
        })
        expect(hasManualBattleSelection(arranged, StageKind.Retreat)).toBe(true)
        const back = undoBattleSelection(arranged, StageKind.Retreat)
        expect(retreatSelection.value(back.retreat, 'lossesTaken')).toBeUndefined()
        expect(back.retreatArrangement).toEqual({ losses: { A02: 1 } })
        expect(hasManualBattleSelection(back, StageKind.Retreat)).toBe(false)
    })

    it('puts down what is held and leaves the arrangement as it stands', () => {
        const sent = sendRetreating(emptyBattleSelections(), [{ unitId: 'A01', locale: 83 }])
        const lifted = liftCommander(sent, 'langeron')
        const down = undoBattleSelection(lifted, StageKind.Retreat)
        expect(retreatSelection.value(down.retreat, 'movingCommander')).toBeUndefined()
        expect(down.retreatArrangement).toEqual(sent.retreatArrangement)
    })

    it('holds one thing picked up at a time, a unit or a commander’s flag', () => {
        const start = emptyBattleSelections()
        const alone = {
            ...start,
            retreat: retreatSelection.set(start.retreat, 'sentAlone', 'A01', 'manual')
        }
        const lifted = liftCommander(alone, 'langeron')
        expect(retreatSelection.value(lifted.retreat, 'sentAlone')).toBeUndefined()
        expect(retreatSelection.value(lifted.retreat, 'movingCommander')).toBe('langeron')

        const kept = setKeptInCorps(lifted, { langeron: 'A02' })
        expect(retreatSelection.value(kept.retreat, 'movingCommander')).toBeUndefined()
        expect(kept.retreatArrangement.kept).toEqual({ langeron: 'A02' })
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
