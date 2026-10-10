import type { CommandKind } from '@tabletop/napoleons-triumph'
import { stagedSelection } from './stagedSelection.js'

export type CommandSelectionValues = {
    group: string
    units: string[]
    command: CommandKind
    guardAttack: true
}

export const commandSelection = stagedSelection<CommandSelectionValues>()([
    'group',
    'units',
    'command',
    'guardAttack'
])
