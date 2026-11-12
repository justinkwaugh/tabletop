import {
    doublesOn,
    type Announcements,
    type Bonus,
    type ContractDefinition,
    type DoubleTarget
} from '@tabletop/koenigrufen'
import type { Names } from './actionDescription.js'
import {
    announcedValue,
    bonusGoal,
    bonusHeading,
    bonusKey,
    bonusName,
    bonusSummary,
    doubleGroups,
    doubleKey,
    doubleTargetName,
    type DoubleWord,
    shortTargetName,
    silentValue
} from './announcementText.js'

export type AnnouncementRow = {
    key: string
    name: string
    // The two value columns: announced and silent for a bonus, now and doubled for a double.
    values: [string, string]
    goal: string
    heading: string
    details: string
}

export type AnnouncementSection = {
    kind: 'bonus' | 'double'
    title: string
    note: string
    columns: [string, string]
    rows: AnnouncementRow[]
}

const DoubleNotes: Readonly<Record<DoubleWord, string>> = {
    Kontra: 'Double what the other side said',
    Re: 'Double back a Kontra on your side',
    Sub: 'Double back a Re on the other side'
}

// The announcement table: the bonuses I may announce for my side, then each double on offer,
// grouped under the word that says it.
export function announcementSections(
    bonuses: readonly Bonus[],
    targets: readonly DoubleTarget[],
    announcements: Announcements,
    definition: ContractDefinition,
    names: Names,
    myId?: string
): AnnouncementSection[] {
    const bonusSection: AnnouncementSection[] =
        bonuses.length === 0
            ? []
            : [
                  {
                      kind: 'bonus' as const,
                      title: 'Bonuses',
                      note: 'Announce for your side',
                      columns: ['Announced', 'Silent'],
                      rows: bonuses.map((bonus) => bonusRow(bonus, definition))
                  }
              ]
    const doubleSections = doubleGroups(announcements, targets).map((group) => ({
        kind: 'double' as const,
        title: group.word,
        note: DoubleNotes[group.word],
        columns: ['Now', 'Doubled'] satisfies [string, string],
        rows: group.targets.map((target) =>
            doubleRow(group.word, target, announcements, definition, names, myId)
        )
    }))
    return [...bonusSection, ...doubleSections]
}

function bonusRow(bonus: Bonus, definition: ContractDefinition): AnnouncementRow {
    const announced = String(announcedValue(bonus, definition))
    return {
        key: bonusKey(bonus),
        name: bonusName(bonus),
        values: [announced, String(silentValue(bonus, definition) ?? '')],
        goal: bonusGoal(bonus),
        heading: bonusHeading(bonus, definition),
        details: bonusSummary(bonus, definition)
    }
}

function doubleRow(
    word: DoubleWord,
    target: DoubleTarget,
    announcements: Announcements,
    definition: ContractDefinition,
    names: Names,
    myId?: string
): AnnouncementRow {
    const factor = 2 ** doublesOn(announcements, target)
    const value = (base: number) => base * factor
    const now = valueText(target, definition, value)
    const doubled = valueText(target, definition, (base) => value(base) * 2)
    const what = doubleTargetName(target, names, myId)
    return {
        key: doubleKey(target),
        name: shortTargetName(target, names, myId),
        values: [now, doubled],
        goal: `Doubles ${what}.`,
        heading: `${word} on ${what}`,
        details: `Doubles ${what}: worth ${now} now, ${doubled} after ${word}.`
    }
}

function valueText(
    target: DoubleTarget,
    definition: ContractDefinition,
    scale: (base: number) => number
): string {
    if (target.kind === 'bonus') {
        return String(scale(announcedValue(target.bonus, definition)))
    }
    return definition.loss === definition.win
        ? String(scale(definition.win))
        : `${scale(definition.win)}/−${scale(definition.loss)}`
}

// What is ticked, in table order: "Trull", "Kontra on the game".
export function chosenItems(
    sections: readonly AnnouncementSection[],
    keys: readonly string[]
): string[] {
    return sections.flatMap((section) =>
        section.rows
            .filter((row) => keys.includes(row.key))
            .map((row) => (section.kind === 'bonus' ? row.name : row.heading))
    )
}
