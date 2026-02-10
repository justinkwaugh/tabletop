import type { PlopTypes } from '@turbo/gen'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const templatesRoot = path.resolve(process.cwd(), 'turbo', 'generators', 'templates')
const templatePath = (...segments: string[]): string => path.join(templatesRoot, ...segments)

const parseEnumMembers = (source: string, enumName: string): string[] => {
    const enumMatch = source.match(new RegExp(`export\\s+enum\\s+${enumName}\\s*\\{([\\s\\S]*?)\\}`, 'm'))
    if (!enumMatch) return []

    const members: string[] = []
    const seen = new Set<string>()
    const memberRegex = /^\s*([A-Za-z0-9_]+)\s*=/gm
    let match: RegExpExecArray | null

    while ((match = memberRegex.exec(enumMatch[1])) !== null) {
        const member = match[1]
        if (!seen.has(member)) {
            seen.add(member)
            members.push(member)
        }
    }

    return members
}

const normalizeToken = (value: string): string => value.replace(/[^A-Za-z0-9]/g, '').toLowerCase()

const hasNormalizedName = (names: string[], value: string): boolean => {
    const target = normalizeToken(value)
    return names.some((name) => normalizeToken(name) === target)
}

const toCamelCase = (value: string): string => {
    if (!value) return value
    if (/[^A-Za-z0-9]/.test(value)) {
        const parts = value
            .split(/[^A-Za-z0-9]+/)
            .filter(Boolean)
            .map((part) => part.toLowerCase())
        if (parts.length === 0) return ''
        return `${parts[0]}${parts.slice(1).map((part) => part[0].toUpperCase() + part.slice(1)).join('')}`
    }

    return `${value[0].toLowerCase()}${value.slice(1)}`
}

const getGameChoices = async (): Promise<string[]> => {
    const gamesRoot = path.resolve(process.cwd(), 'games')
    const entries = await readdir(gamesRoot, { withFileTypes: true })

    return entries
        .filter((entry) => entry.isDirectory() && !entry.name.endsWith('-ui'))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b))
}

const getUiPackageNames = async (): Promise<string[]> => {
    const gamesRoot = path.resolve(process.cwd(), 'games')
    const entries = await readdir(gamesRoot, { withFileTypes: true })
    return entries
        .filter((entry) => entry.isDirectory() && entry.name.endsWith('-ui'))
        .map((entry) => entry.name)
}

const getMissingUiGameChoices = async (): Promise<string[]> => {
    const gamesRoot = path.resolve(process.cwd(), 'games')
    const entries = await readdir(gamesRoot, { withFileTypes: true })
    const dirNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    const uiNames = new Set(dirNames.filter((name) => name.endsWith('-ui')))
    const baseNames = dirNames.filter((name) => !name.endsWith('-ui'))

    return baseNames.filter((name) => !uiNames.has(`${name}-ui`)).sort((a, b) => a.localeCompare(b))
}

const hasUiForGameName = (uiNames: string[], input: string): boolean => {
    const normalizedInput = normalizeToken(input)
    const normalizedWithUi = normalizeToken(`${input}ui`)
    return uiNames.some((name) => {
        const normalizedName = normalizeToken(name)
        return normalizedName === normalizedInput || normalizedName === normalizedWithUi
    })
}

const getActionChoices = async (answers?: Record<string, unknown>): Promise<string[]> => {
    const game = typeof answers?.game === 'string' ? answers.game : ''
    if (!game) return []

    const actionsPath = path.resolve(process.cwd(), 'games', game, 'src', 'definition', 'actions.ts')
    const source = await readFile(actionsPath, 'utf8')
    return parseEnumMembers(source, 'ActionType')
}

const getStateActionNames = async (answers?: Record<string, unknown>): Promise<string[]> => {
    const game = typeof answers?.game === 'string' ? answers.game : ''
    const state = typeof answers?.state === 'string' ? answers.state : ''
    if (!game || !state) return []

    const stateFile = path.resolve(
        process.cwd(),
        'games',
        game,
        'src',
        'stateHandlers',
        `${toCamelCase(state)}.ts`
    )
    let source = ''
    try {
        source = await readFile(stateFile, 'utf8')
    } catch {
        return []
    }

    const actions = new Set<string>()
    for (const match of source.matchAll(/ActionType\.([A-Za-z0-9_]+)/g)) {
        actions.add(match[1])
    }
    for (const match of source.matchAll(/Hydrated([A-Za-z0-9_]+)/g)) {
        const name = match[1]
        if (name === 'Action' || name.endsWith('GameState')) continue
        actions.add(name)
    }

    return Array.from(actions)
}

const getAvailableActionChoices = async (
    answers?: Record<string, unknown>
): Promise<Array<string | { name: string; value: string; disabled?: string }>> => {
    const [allActions, existingActions] = await Promise.all([
        getActionChoices(answers),
        getStateActionNames(answers)
    ])
    const existing = new Set(existingActions.map((action) => normalizeToken(action)))
    const available = allActions.filter((action) => !existing.has(normalizeToken(action)))

    if (available.length === 0) {
        return [
            {
                name: '<No available actions>',
                value: '__none__',
                disabled: 'All actions already added'
            }
        ]
    }

    return available
}

const getStateChoices = async (answers?: Record<string, unknown>): Promise<string[]> => {
    const game = typeof answers?.game === 'string' ? answers.game : ''
    if (!game) return []

    const statesPath = path.resolve(process.cwd(), 'games', game, 'src', 'definition', 'states.ts')
    const source = await readFile(statesPath, 'utf8')
    return parseEnumMembers(source, 'MachineState')
}

const getStateHandlerFileChoices = async (answers?: Record<string, unknown>): Promise<string[]> => {
    const game = typeof answers?.game === 'string' ? answers.game : ''
    if (!game) return []

    const handlersPath = path.resolve(process.cwd(), 'games', game, 'src', 'stateHandlers')
    try {
        const entries = await readdir(handlersPath, { withFileTypes: true })
        return entries
            .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
            .map((entry) => entry.name.replace(/\.ts$/, ''))
    } catch {
        return []
    }
}

const updateStateHandlerWithActions = (
    plop: PlopTypes.NodePlopAPI,
    file: string,
    data: Record<string, unknown>
): string => {
    const renderString = (plop as { renderString?: (template: string, data: unknown) => string }).renderString
    const render = (template: string, extra: Record<string, unknown>) =>
        typeof renderString === 'function' ? renderString(template, extra) : template
    const stateName = render('{{properCase state}}', data)
    const actionList = Array.isArray(data.actions)
        ? data.actions
        : typeof data.action === 'string'
          ? [data.action]
          : []
    const actions = actionList.filter((action) => typeof action === 'string' && action !== '__none__')
    const newline = file.includes('\r\n') ? '\r\n' : '\n'

    const actionAnchor = 'Leave this comment if you want the template to generate code for valid actions'

    const updateMethodBlock = (
        content: string,
        methodName: string,
        updater: (block: string) => string
    ): string => {
        const methodRegex = new RegExp(`${methodName}\\([^)]*\\)[^{]*\\{`, 'm')
        const methodMatch = methodRegex.exec(content)
        if (!methodMatch) return content

        const braceStart = content.indexOf('{', methodMatch.index)
        if (braceStart === -1) return content

        let depth = 0
        let braceEnd = -1
        for (let i = braceStart; i < content.length; i += 1) {
            const char = content[i]
            if (char === '{') depth += 1
            if (char === '}') {
                depth -= 1
                if (depth === 0) {
                    braceEnd = i
                    break
                }
            }
        }

        if (braceEnd === -1) return content

        const block = content.slice(braceStart + 1, braceEnd)
        const updatedBlock = updater(block)
        return `${content.slice(0, braceStart + 1)}${updatedBlock}${content.slice(braceEnd)}`
    }

    const ensureImport = (content: string, actionName: string, actionFile: string): string => {
        const importLine = `import { Hydrated${actionName}, is${actionName} } from '../actions/${actionFile}.js'`
        if (content.includes(importLine)) return content

        const actionImportRegex =
            /import { [^}]*Hydrated[A-Za-z0-9_]+[^}]* } from '\.\/actions\/[^']+\.js'\s*\r?\n/g
        let lastMatch: RegExpExecArray | null = null
        let match: RegExpExecArray | null = null

        while ((match = actionImportRegex.exec(content)) !== null) {
            lastMatch = match
        }

        if (lastMatch) {
            const insertPos = lastMatch.index + lastMatch[0].length
            return `${content.slice(0, insertPos)}${importLine}${newline}${content.slice(insertPos)}`
        }

        const actionTypeImportRegex = /import { ActionType } from '\.\.\/definition\/actions\.js'\s*\r?\n/
        const actionTypeMatch = actionTypeImportRegex.exec(content)
        if (actionTypeMatch) {
            const insertPos = actionTypeMatch.index + actionTypeMatch[0].length
            return `${content.slice(0, insertPos)}${importLine}${newline}${content.slice(insertPos)}`
        }

        return `${importLine}${newline}${content}`
    }

    const ensureUnionType = (content: string, stateTypeName: string, hydratedName: string): string => {
        const fullTypeName = `${stateTypeName}Action`
        const typeRegex = new RegExp(
            `type\\s+${fullTypeName}\\s*=\\s*([^\\n;]+(?:\\n\\s*\\|\\s*[^\\n;]+)*)`,
            'm'
        )
        const match = typeRegex.exec(content)
        if (!match) return content

        const existing = new Set<string>()
        for (const typeMatch of match[1].matchAll(/Hydrated[A-Za-z0-9_]+/g)) {
            existing.add(typeMatch[0])
        }

        if (existing.has('HydratedAction')) {
            existing.delete('HydratedAction')
        }

        existing.add(hydratedName)

        const types = Array.from(existing)
        const replacement = `type ${fullTypeName} = ${types.join(' | ')}`
        return content.replace(typeRegex, replacement)
    }

    const addIsValidCheck = (content: string, actionName: string): string =>
        updateMethodBlock(content, 'isValidAction', (block) => {
            if (!block.includes(actionAnchor)) return block
            const actionCheck = `ActionType.${actionName}`
            if (block.includes(actionCheck)) return block

            const returnRegex = /return[\s\S]*?;\s*/g
            let match: RegExpExecArray | null = null
            let lastRelevant: RegExpExecArray | null = null

            while ((match = returnRegex.exec(block)) !== null) {
                if (match[0].includes('ActionType.') || match[0].includes('action.type')) {
                    lastRelevant = match
                }
            }

            if (!lastRelevant) {
                const falseRegex = /return\s+false\s*;\s*/m
                if (!falseRegex.test(block)) return block
                return block.replace(falseRegex, `return action.type === ${actionCheck};${newline}`)
            }

            const original = lastRelevant[0]
            const updated = original.replace(/;\s*$/, ` || action.type === ${actionCheck};`)
            return `${block.slice(0, lastRelevant.index)}${updated}${block.slice(
                lastRelevant.index + original.length
            )}`
        })

    const addValidActionCheck = (content: string, actionName: string): string =>
        updateMethodBlock(content, 'validActionsForPlayer', (block) => {
            if (!block.includes(actionAnchor)) return block
            const canCheck = `Hydrated${actionName}.can${actionName}`
            if (block.includes(canCheck)) return block

            const indentMatch = block.match(/^\s*const validActions/m)
            const indent = indentMatch ? indentMatch[0].match(/^\s*/)?.[0] ?? '' : ''
            const innerIndent = `${indent}    `
            const insertBlock = [
                `${indent}if (Hydrated${actionName}.can${actionName}(gameState, playerId)) {`,
                `${innerIndent}validActions.push(ActionType.${actionName})`,
                `${indent}}`
            ].join(newline)

            const anchorIndex = block.indexOf(actionAnchor)
            const lineStart = block.lastIndexOf(newline, anchorIndex)
            const insertPos = lineStart === -1 ? 0 : lineStart + newline.length
            return `${block.slice(0, insertPos)}${insertBlock}${newline}${block.slice(insertPos)}`
        })

    const addSwitchCase = (content: string, actionName: string): string =>
        updateMethodBlock(content, 'onAction', (block) => {
            if (!block.includes(actionAnchor)) return block
            const caseLabel = `case is${actionName}(action):`
            if (block.includes(caseLabel)) return block

            const anchorIndex = block.indexOf(actionAnchor)
            const lineStart = block.lastIndexOf(newline, anchorIndex)
            const insertPos = lineStart === -1 ? 0 : lineStart + newline.length
            const indentMatch = block.slice(insertPos, anchorIndex).match(/^[ \t]*/)
            const indent = indentMatch ? indentMatch[0] : ''

            const caseBlock = [
                `${indent}case is${actionName}(action): {`,
                `${indent}    return MachineState.${stateName}`,
                `${indent}}`
            ].join(newline)

            return `${block.slice(0, insertPos)}${caseBlock}${newline}${block.slice(insertPos)}`
        })

    let nextFile = file
    for (const action of actions) {
        if (typeof action !== 'string') continue
        const actionName = render('{{properCase action}}', { ...data, action })
        const actionFile = render('{{camelCase action}}', { ...data, action })
        nextFile = ensureImport(nextFile, actionName, actionFile)
        nextFile = ensureUnionType(nextFile, stateName, `Hydrated${actionName}`)
        nextFile = addIsValidCheck(nextFile, actionName)
        nextFile = addValidActionCheck(nextFile, actionName)
        nextFile = addSwitchCase(nextFile, actionName)
    }

    return nextFile
}
export default function generator(plop: PlopTypes.NodePlopAPI): void {
    plop.setGenerator('create-game', {
        description: 'Add a new game',
        // gather information from the user
        prompts: [
            {
                type: 'input',
                name: 'game',
                message: "Game name (e.g., 'Go Fish'):"
            }
        ],
        // perform actions based on the prompts
        actions: [
            {
                type: 'addMany',
                destination: 'games/{{kebabCase game}}',
                base: templatePath('game', 'logic'),
                globOptions: { dot: true },
                templateFiles: templatePath('game', 'logic', '**', '*.hbs')
            }
        ]
    })

    plop.setGenerator('create-game-ui', {
        description: 'Add a new game UI',
        prompts: [
            {
                type: 'list',
                name: 'game',
                message: 'Choose a game to create a UI for:',
                choices: async () => {
                    const choices = await getMissingUiGameChoices()
                    return [...choices, { name: '<New Game>', value: '__new__' }]
                }
            },
            {
                type: 'input',
                name: 'newGame',
                message: "Game name (e.g., 'Go Fish'):",
                when: (answers: Record<string, unknown>) => answers.game === '__new__',
                validate: async (input: string) => {
                    if (!input) {
                        return 'Game name is required.'
                    }

                    const uiNames = await getUiPackageNames()
                    if (hasUiForGameName(uiNames, input)) {
                        return 'A UI for this game already exists.'
                    }

                    return true
                }
            }
        ],
        actions: (data) => {
            const answers = data as Record<string, unknown>
            if (answers.game === '__new__') {
                answers.game = answers.newGame
            }

            return [
                {
                    type: 'addMany',
                    destination: 'games/{{kebabCase game}}-ui',
                    base: templatePath('game', 'ui'),
                    globOptions: { dot: true },
                    templateFiles: templatePath('game', 'ui', '**', '*')
                }
            ]
        }
    })

    plop.setGenerator('add-action', {
        description: 'Add an action to a game',
        // gather information from the user
        prompts: [
            {
                type: 'list',
                name: 'game',
                message: 'Choose a game:',
                choices: getGameChoices
            },
            {
                type: 'input',
                name: 'action',
                message: "Action name (e.g., 'Draw Card'):",
                validate: async (input: string, answers?: Record<string, unknown>) => {
                    if (!input) {
                        return 'Action name is required.'
                    }

                    const existing = await getActionChoices(answers)
                    if (hasNormalizedName(existing, input)) {
                        return 'Action already exists for this game.'
                    }

                    return true
                }
            }
        ],
        // perform actions based on the prompts
        actions: [
            {
                type: 'add',
                path: 'games/{{kebabCase game}}/src/actions/{{camelCase action}}.ts',
                templateFile: templatePath('game', 'addAction', 'action.ts.hbs')
            },
            {
                type: 'append',
                path: 'games/{{kebabCase game}}/src/definition/actions.ts',
                pattern: /export enum ActionType \{[ \t]*\n/,
                template: "    {{properCase action}} = '{{camelCase action}}',"
            },
            {
                type: 'append',
                path: 'games/{{kebabCase game}}/src/definition/apiActions.ts',
                pattern: /import { ActionType } from '\.\/actions\.js'[ \t]*\n/,
                template: "import { {{properCase action}} } from '../actions/{{camelCase action}}.js'"
            },
            {
                type: 'append',
                path: 'games/{{kebabCase game}}/src/definition/apiActions.ts',
                pattern: /export const .*ApiActions = \{[ \t]*\n/,
                template: '    [ActionType.{{properCase action}}]: {{properCase action}},'
            },
            {
                type: 'modify',
                path: 'games/{{kebabCase game}}/src/index.ts',
                transform: (file, data) => {
                    const renderString = (plop as { renderString?: (template: string, data: unknown) => string })
                        .renderString
                    const exportTemplate = "export * from './actions/{{camelCase action}}.js'"
                    const exportLine =
                        typeof renderString === 'function' ? renderString(exportTemplate, data) : exportTemplate

                    if (file.includes(exportLine)) {
                        return file
                    }

                    const newline = file.includes('\r\n') ? '\r\n' : '\n'
                    const actionExportRegex = /export \* from '\.\/actions\/[^']+\.js'[ \t]*\r?\n/g
                    let lastMatch: RegExpExecArray | null = null
                    let match: RegExpExecArray | null = null

                    while ((match = actionExportRegex.exec(file)) !== null) {
                        lastMatch = match
                    }

                    if (lastMatch) {
                        const insertPos = lastMatch.index + lastMatch[0].length
                        return `${file.slice(0, insertPos)}${exportLine}${newline}${file.slice(insertPos)}`
                    }

                    const base = file.endsWith('\n') ? file : `${file}${newline}`
                    return `${base}${exportLine}${newline}`
                }
            }
        ]
    })

    plop.setGenerator('add-state', {
        description: 'Add a state to a game',
        prompts: [
            {
                type: 'list',
                name: 'game',
                message: 'Choose a game:',
                choices: getGameChoices
            },
            {
                type: 'input',
                name: 'state',
                message: "State name (e.g., 'StartOfTurn'):",
                validate: async (input: string, answers?: Record<string, unknown>) => {
                    if (!input) {
                        return 'State name is required.'
                    }

                    const existingStates = await getStateChoices(answers)
                    if (hasNormalizedName(existingStates, input)) {
                        return 'State already exists for this game.'
                    }

                    const existingHandlers = await getStateHandlerFileChoices(answers)
                    const stateFile = toCamelCase(input)
                    if (existingHandlers.some((name) => normalizeToken(name) === normalizeToken(stateFile))) {
                        return 'State handler already exists for this game.'
                    }

                    return true
                }
            },
            {
                type: 'list',
                name: 'action',
                message: 'Choose an action for this state:',
                choices: async (answers?: Record<string, unknown>) => {
                    const choices = await getActionChoices(answers)
                    return [{ name: '<No Action>', value: '__none__' }, ...choices, { name: '<New Action>', value: '__new__' }]
                }
            },
            {
                type: 'input',
                name: 'newAction',
                message: "New action name (e.g., 'Draw Card'):",
                when: (answers: Record<string, unknown>) => answers.action === '__new__',
                validate: async (input: string, answers?: Record<string, unknown>) => {
                    if (!input) {
                        return 'Action name is required.'
                    }

                    const existing = await getActionChoices(answers)
                    if (hasNormalizedName(existing, input)) {
                        return 'Action already exists for this game.'
                    }

                    return true
                }
            }
        ],
        actions: (data) => {
            const answers = data as Record<string, unknown>
            const selectedAction = answers.action
            const resolvedAction = selectedAction === '__new__' ? (answers.newAction as string | undefined) : selectedAction
            const hasAction = typeof resolvedAction === 'string' && resolvedAction !== '__none__'

            if (hasAction) {
                answers.action = resolvedAction
            }

            const actions = []

            if (selectedAction === '__new__' && hasAction) {
                actions.push(
                    {
                        type: 'add',
                        path: 'games/{{kebabCase game}}/src/actions/{{camelCase action}}.ts',
                        templateFile: templatePath('game', 'addAction', 'action.ts.hbs')
                    },
                    {
                        type: 'append',
                        path: 'games/{{kebabCase game}}/src/definition/actions.ts',
                        pattern: /export enum ActionType \{[ \t]*\n/,
                        template: "    {{properCase action}} = '{{camelCase action}}',"
                    },
                    {
                        type: 'append',
                        path: 'games/{{kebabCase game}}/src/definition/apiActions.ts',
                        pattern: /import { ActionType } from '\.\/actions\.js'[ \t]*\n/,
                        template: "import { {{properCase action}} } from '../actions/{{camelCase action}}.js'"
                    },
                    {
                        type: 'append',
                        path: 'games/{{kebabCase game}}/src/definition/apiActions.ts',
                        pattern: /export const .*ApiActions = \{[ \t]*\n/,
                        template: '    [ActionType.{{properCase action}}]: {{properCase action}},'
                    },
                    {
                        type: 'modify',
                        path: 'games/{{kebabCase game}}/src/index.ts',
                        transform: (file, actionData) => {
                            const renderString = (plop as { renderString?: (template: string, data: unknown) => string })
                                .renderString
                            const exportTemplate = "export * from './actions/{{camelCase action}}.js'"
                            const exportLine =
                                typeof renderString === 'function' ? renderString(exportTemplate, actionData) : exportTemplate

                            if (file.includes(exportLine)) {
                                return file
                            }

                            const newline = file.includes('\r\n') ? '\r\n' : '\n'
                            const actionExportRegex = /export \* from '\.\/actions\/[^']+\.js'[ \t]*\r?\n/g
                            let lastMatch: RegExpExecArray | null = null
                            let match: RegExpExecArray | null = null

                            while ((match = actionExportRegex.exec(file)) !== null) {
                                lastMatch = match
                            }

                            if (lastMatch) {
                                const insertPos = lastMatch.index + lastMatch[0].length
                                return `${file.slice(0, insertPos)}${exportLine}${newline}${file.slice(insertPos)}`
                            }

                            const base = file.endsWith('\n') ? file : `${file}${newline}`
                            return `${base}${exportLine}${newline}`
                        }
                    }
                )
            }

            actions.push(
                {
                    type: 'add',
                    path: 'games/{{kebabCase game}}/src/stateHandlers/{{camelCase state}}.ts',
                    templateFile: templatePath('game', 'addState', 'stateHandler.ts.hbs')
                },
                {
                    type: 'append',
                    path: 'games/{{kebabCase game}}/src/definition/states.ts',
                    pattern: /export enum MachineState \{[ \t]*\n/,
                    template: "    {{properCase state}} = '{{properCase state}}',"
                },
                {
                    type: 'modify',
                    path: 'games/{{kebabCase game}}/src/definition/stateHandlers.ts',
                    transform: (file, actionData) => {
                        const renderString = (plop as { renderString?: (template: string, data: unknown) => string })
                            .renderString
                        const render = (template: string) =>
                            typeof renderString === 'function' ? renderString(template, actionData) : template
                        const stateName = render('{{properCase state}}')
                        const stateFile = render('{{camelCase state}}')
                        const importLine = `import { ${stateName}StateHandler } from '../stateHandlers/${stateFile}.js'`

                        let nextFile = file
                        if (!nextFile.includes(importLine)) {
                            const newline = nextFile.includes('\r\n') ? '\r\n' : '\n'
                            const handlerImportRegex =
                                /import { [^}]+StateHandler } from '\.\/stateHandlers\/[^']+\.js'\s*\r?\n/g
                            let lastMatch: RegExpExecArray | null = null
                            let match: RegExpExecArray | null = null

                            while ((match = handlerImportRegex.exec(nextFile)) !== null) {
                                lastMatch = match
                            }

                            if (lastMatch) {
                                const insertPos = lastMatch.index + lastMatch[0].length
                                nextFile = `${nextFile.slice(0, insertPos)}${importLine}${newline}${nextFile.slice(insertPos)}`
                            } else {
                                const gameStateImportRegex =
                                    /import type { [^}]+GameState } from '\.\.\/model\/gameState\.js'\s*\r?\n/
                                const gameStateMatch = gameStateImportRegex.exec(nextFile)
                                if (gameStateMatch) {
                                    const insertPos = gameStateMatch.index + gameStateMatch[0].length
                                    nextFile = `${nextFile.slice(0, insertPos)}${importLine}${newline}${nextFile.slice(insertPos)}`
                                } else {
                                    nextFile = `${importLine}${newline}${nextFile}`
                                }
                            }
                        }

                        const mappingLine = `    [MachineState.${stateName}]: new ${stateName}StateHandler(),`
                        if (!nextFile.includes(mappingLine)) {
                            const newline = nextFile.includes('\r\n') ? '\r\n' : '\n'
                            const entryRegex =
                                /\[MachineState\.[A-Za-z0-9_]+\]: new [A-Za-z0-9_]+StateHandler\(\),?\s*\r?\n/g
                            let lastEntry: RegExpExecArray | null = null
                            let entryMatch: RegExpExecArray | null = null

                            while ((entryMatch = entryRegex.exec(nextFile)) !== null) {
                                lastEntry = entryMatch
                            }

                            if (lastEntry) {
                                const insertPos = lastEntry.index + lastEntry[0].length
                                nextFile = `${nextFile.slice(0, insertPos)}${mappingLine}${newline}${nextFile.slice(insertPos)}`
                            } else {
                                const objectOpenRegex = /> = \{[ \t]*\r?\n/
                                const objectMatch = objectOpenRegex.exec(nextFile)
                                if (objectMatch) {
                                    const insertPos = objectMatch.index + objectMatch[0].length
                                    nextFile = `${nextFile.slice(0, insertPos)}${mappingLine}${newline}${nextFile.slice(insertPos)}`
                                } else {
                                    nextFile = `${nextFile}${newline}${mappingLine}${newline}`
                                }
                            }
                        }

                        return nextFile
                    }
                }
            )

            if (hasAction) {
                actions.push({
                    type: 'modify',
                    path: 'games/{{kebabCase game}}/src/stateHandlers/{{camelCase state}}.ts',
                    transform: (file, actionData) =>
                        updateStateHandlerWithActions(plop, file, actionData as Record<string, unknown>)
                })
            }

            return actions
        }
    })

    plop.setGenerator('add-state-action', {
        description: 'Add action(s) to a state handler',
        prompts: [
            {
                type: 'list',
                name: 'game',
                message: 'Choose a game:',
                choices: getGameChoices
            },
            {
                type: 'list',
                name: 'state',
                message: 'Choose a state:',
                choices: getStateChoices
            },
            {
                type: 'checkbox',
                name: 'actions',
                message: 'Choose action(s) to add:',
                choices: getAvailableActionChoices,
                validate: async (input: unknown, answers?: Record<string, unknown>) => {
                    const choices = await getAvailableActionChoices(answers)
                    if (
                        choices.length === 1 &&
                        typeof choices[0] !== 'string' &&
                        choices[0].value === '__none__'
                    ) {
                        return 'No available actions to add for this state.'
                    }

                    if (Array.isArray(input) && input.length > 0) {
                        return true
                    }
                    return 'Select at least one action.'
                }
            }
        ],
        actions: [
            {
                type: 'modify',
                path: 'games/{{kebabCase game}}/src/stateHandlers/{{camelCase state}}.ts',
                transform: (file, data) => updateStateHandlerWithActions(plop, file, data as Record<string, unknown>)
            }
        ]
    })
}
