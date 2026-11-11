#!/usr/bin/env node
// Maps the TypeBox object schemas and data-heavy constant tables in a logic package's sources.
// Usage: node scan_state_shape.mjs <UI package root> < files.json
import { readFileSync } from 'node:fs'
import { workspaceRequire } from './workspace_compilers.mjs'

const require = workspaceRequire(process.argv[2])
const ts = require('typescript')

const TABLE_LITERALS = 24
const TABLE_LITERAL_SHARE = 0.6
const FIELD_TYPE_CHARACTERS = 120
const SCHEMA_CALLS = new Set(['Type.Object', 'Type.Composite', 'Type.Intersect'])

const flatten = (text) => text.replace(/\s+/g, ' ')
const shorten = (text) =>
    text.length > FIELD_TYPE_CHARACTERS ? `${text.slice(0, FIELD_TYPE_CHARACTERS)}…` : text

function unwrap(node) {
    for (;;) {
        if (
            ts.isAsExpression(node) ||
            ts.isSatisfiesExpression(node) ||
            ts.isParenthesizedExpression(node)
        ) {
            node = node.expression
        } else if (
            ts.isCallExpression(node) &&
            node.expression.getText() === 'Object.freeze' &&
            node.arguments.length === 1
        ) {
            node = node.arguments[0]
        } else if (
            ts.isNewExpression(node) &&
            node.expression.getText() === 'Map' &&
            node.arguments?.length === 1
        ) {
            node = node.arguments[0]
        } else {
            return node
        }
    }
}

// An enum member (`TileType.City`) is a value; identifiers and calls are wiring, such as a
// table of handlers or Action classes, and keep such tables out of the list.
function countLeaves(node) {
    let literals = 0
    let references = 0
    const visit = (child) => {
        if (
            ts.isStringLiteral(child) ||
            ts.isNumericLiteral(child) ||
            ts.isNoSubstitutionTemplateLiteral(child) ||
            child.kind === ts.SyntaxKind.TrueKeyword ||
            child.kind === ts.SyntaxKind.FalseKeyword ||
            (ts.isPropertyAccessExpression(child) &&
                ts.isIdentifier(child.expression) &&
                !ts.isCallExpression(child.parent))
        ) {
            literals += 1
            return
        }
        if (ts.isPropertyAssignment(child)) {
            visit(child.initializer)
            return
        }
        if (
            ts.isIdentifier(child) ||
            ts.isPropertyAccessExpression(child) ||
            ts.isCallExpression(child) ||
            ts.isNewExpression(child) ||
            ts.isFunctionLike(child)
        ) {
            references += 1
            return
        }
        ts.forEachChild(child, visit)
    }
    visit(node)
    return { literals, references }
}

function schemaCall(node) {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null
    const callee = node.expression.getText()
    return SCHEMA_CALLS.has(callee) ? callee : null
}

function scan(source, path) {
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const lineOf = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
    const schemas = []
    const tables = []
    const visit = (node, owner) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) owner = node.name.text
        if (ts.isPropertyAssignment(node) && owner) owner = `${owner}.${node.name.getText(file)}`
        const callee = schemaCall(node)
        if (callee === 'Type.Object') {
            const [fields] = node.arguments
            schemas.push({
                name: owner ?? null,
                line: lineOf(node),
                fields:
                    fields && ts.isObjectLiteralExpression(fields)
                        ? fields.properties.map((property) => ({
                              name: property.name
                                  ? property.name.getText(file)
                                  : flatten(property.getText(file)),
                              type: ts.isPropertyAssignment(property)
                                  ? shorten(flatten(property.initializer.getText(file)))
                                  : null
                          }))
                        : shorten(flatten(fields?.getText(file) ?? ''))
            })
        } else if (callee) {
            schemas.push({
                name: owner ?? null,
                line: lineOf(node),
                composes: node.arguments
                    .flatMap((argument) =>
                        ts.isArrayLiteralExpression(argument) ? argument.elements : [argument]
                    )
                    .map((part) => shorten(flatten(part.getText(file))))
            })
        }
        ts.forEachChild(node, (child) => visit(child, owner))
    }
    visit(file, undefined)
    const consider = (name, node, value) => {
        value = unwrap(value)
        if (!ts.isArrayLiteralExpression(value) && !ts.isObjectLiteralExpression(value)) return
        const { literals, references } = countLeaves(value)
        if (literals < TABLE_LITERALS || literals < TABLE_LITERAL_SHARE * (literals + references))
            return
        tables.push({ name, line: lineOf(node), literals, references })
    }
    const isStatic = (member) =>
        member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)
    for (const statement of file.statements) {
        if (
            ts.isVariableStatement(statement) &&
            statement.declarationList.flags & ts.NodeFlags.Const
        ) {
            for (const declaration of statement.declarationList.declarations) {
                if (ts.isIdentifier(declaration.name) && declaration.initializer)
                    consider(declaration.name.text, declaration, declaration.initializer)
            }
        } else if (ts.isExportAssignment(statement)) {
            consider('default', statement, statement.expression)
        } else if (ts.isClassDeclaration(statement)) {
            for (const member of statement.members) {
                if (ts.isPropertyDeclaration(member) && isStatic(member) && member.initializer)
                    consider(
                        `${statement.name?.text ?? 'class'}.${member.name.getText(file)}`,
                        member,
                        member.initializer
                    )
            }
        }
    }
    return { schemas, tables }
}

const results = []
for (const path of JSON.parse(readFileSync(0, 'utf8'))) {
    try {
        const { schemas, tables } = scan(readFileSync(path, 'utf8'), path)
        if (schemas.length > 0 || tables.length > 0) results.push({ path, schemas, tables })
    } catch (error) {
        results.push({ path, error: String(error.message ?? error) })
    }
}
process.stdout.write(JSON.stringify(results))
