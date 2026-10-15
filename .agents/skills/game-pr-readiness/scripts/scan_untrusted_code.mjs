#!/usr/bin/env node
// Reports module imports and every reach for a capability beyond game code: Node built-ins, process and
// global objects, the network, storage, navigation, messaging, HTML injection, evaluated code, prototype
// changes, decoders, remote URLs, encoded blobs, and ID-shaped literals.
// Usage: node scan_untrusted_code.mjs <UI package root> < files.json
import { builtinModules, createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const require = createRequire(join(resolve(process.argv[2]), 'package.json'))
const ts = require('typescript')
const { parse } = require('svelte/compiler')

const builtins = new Set(builtinModules)
const globalObjects = new Set([
    'window',
    'self',
    'globalThis',
    'global',
    'document',
    'navigator',
    'location',
    'top',
    'parent',
    'frames'
])
const capabilityGlobals = {
    process: 'process',
    globalThis: 'global_object',
    global: 'global_object',
    self: 'global_object',
    Buffer: 'process',
    __dirname: 'process',
    __filename: 'process',
    require: 'module_loading',
    importScripts: 'module_loading',
    eval: 'evaluated_code',
    Function: 'evaluated_code',
    fetch: 'network',
    XMLHttpRequest: 'network',
    WebSocket: 'network',
    EventSource: 'network',
    WebTransport: 'network',
    RTCPeerConnection: 'network',
    Worker: 'worker',
    SharedWorker: 'worker',
    localStorage: 'storage',
    sessionStorage: 'storage',
    indexedDB: 'storage',
    caches: 'storage',
    cookieStore: 'storage',
    atob: 'decoding',
    btoa: 'decoding',
    unescape: 'decoding',
    TextDecoder: 'decoding',
    setImmediate: 'timer',
    queueMicrotask: 'timer'
}
const capabilityMembers = {
    'document.cookie': 'storage',
    'document.domain': 'navigation',
    'document.write': 'html_injection',
    'document.writeln': 'html_injection',
    'window.open': 'navigation',
    'window.location': 'navigation',
    'window.name': 'storage',
    'window.opener': 'messaging',
    'window.parent': 'messaging',
    'window.top': 'messaging',
    'location.href': 'navigation',
    'location.assign': 'navigation',
    'location.replace': 'navigation',
    'navigator.sendBeacon': 'network',
    'navigator.serviceWorker': 'worker',
    'navigator.clipboard': 'clipboard',
    'navigator.credentials': 'storage',
    'document.body': 'page_element',
    'document.head': 'page_element',
    'document.documentElement': 'page_element',
    'String.fromCharCode': 'decoding',
    'String.fromCodePoint': 'decoding',
    'Object.setPrototypeOf': 'prototype_change',
    'Reflect.setPrototypeOf': 'prototype_change'
}
const anyObjectMembers = {
    innerHTML: 'html_injection',
    outerHTML: 'html_injection',
    insertAdjacentHTML: 'html_injection',
    createContextualFragment: 'html_injection',
    srcdoc: 'html_injection',
    postMessage: 'messaging',
    sendBeacon: 'network',
    cookie: 'storage',
    localStorage: 'storage',
    sessionStorage: 'storage',
    indexedDB: 'storage',
    serviceWorker: 'worker',
    ['__proto__']: 'prototype_change',
    __defineGetter__: 'prototype_change',
    __defineSetter__: 'prototype_change'
}
const builtinConstructors = new Set([
    'Object',
    'Array',
    'Function',
    'String',
    'Number',
    'Boolean',
    'Symbol',
    'Promise',
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
    'RegExp',
    'Date',
    'Error',
    'JSON',
    'Math',
    'Reflect',
    'BigInt',
    'Element',
    'Node',
    'HTMLElement',
    'EventTarget',
    'Response',
    'Request',
    'XMLHttpRequest'
])
const globalDefiners = new Set([
    'Object.defineProperty',
    'Object.defineProperties',
    'Object.assign',
    'Reflect.defineProperty',
    'Reflect.set'
])
const injectedElements = new Set([
    'script',
    'iframe',
    'frame',
    'object',
    'embed',
    'link',
    'base',
    'meta',
    'portal'
])
const eventKinds = { message: 'messaging', messageerror: 'messaging', storage: 'storage' }
const windowObjects = new Set(['window', 'self', 'globalThis', 'global'])

const xmlNamespaces = new Set([
    'http://www.w3.org/2000/svg',
    'http://www.w3.org/1999/xlink',
    'http://www.w3.org/1999/xhtml',
    'http://www.w3.org/2000/xmlns/',
    'http://www.w3.org/XML/1998/namespace'
])
const urlPattern = /\b(?:https?|wss?|ftp):\/\/[^\s'"`<>)]*|^\/\/[\w.-]+\.[a-z]{2,}[^\s'"`<>)]*/gi
const localHost = /^(?:[a-z]+:)?\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?:[:/]|$)/i
const encodedBlob = /^[A-Za-z0-9+/=_-]{120,}$|^(?:0x)?[0-9a-fA-F]{64,}$/
const idShaped = /^[A-Za-z0-9_-]{20,40}$/
const email = /^[^\s@'"]+@[^\s@'"]+\.[a-z]{2,}$/i

function memberCapability(objectName, propertyName) {
    const text = `${objectName}.${propertyName}`
    if (Object.hasOwn(capabilityMembers, text)) return capabilityMembers[text]
    if (globalObjects.has(objectName) && Object.hasOwn(capabilityGlobals, propertyName))
        return capabilityGlobals[propertyName]
    if (windowObjects.has(objectName) && /^[_$]/.test(propertyName)) return 'global_object'
    return Object.hasOwn(anyObjectMembers, propertyName)
        ? anyObjectMembers[propertyName]
        : undefined
}

function classifyImport(specifier) {
    if (specifier.startsWith('node:') || builtins.has(specifier.split('/')[0]))
        return 'node_builtin'
    if (/^(?:\.|\/|\$lib|\$app|\$env|\$service-worker|virtual:)/.test(specifier)) return 'local'
    if (/^[a-z][a-z0-9+.-]*:/i.test(specifier)) return 'url'
    if (specifier.startsWith('@tabletop/')) return 'workspace'
    return 'external'
}

function packageOf(specifier) {
    const parts = specifier.split('/')
    return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

function checkString(value, record, node) {
    const remote = (value.match(urlPattern) ?? []).filter(
        (url) => !xmlNamespaces.has(url) && !localHost.test(url)
    )
    if (remote.length > 0) record('remote_url', node, remote.join(' '))
    if (value.startsWith('data:') && value.length > 2000)
        record('encoded_blob', node, `${value.slice(0, 60)}… (${value.length} chars)`)
    else if (encodedBlob.test(value))
        record('encoded_blob', node, `${value.slice(0, 60)}… (${value.length} chars)`)
    if (email.test(value)) record('identifier_literal', node, value)
    else if (
        idShaped.test(value) &&
        /[a-z]/.test(value) &&
        /[A-Z]/.test(value) &&
        /[0-9]/.test(value)
    ) {
        record('identifier_literal', node, value)
    }
}

function scanScript(source, path) {
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const findings = []
    const imports = []
    const lineOf = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
    const textOf = (node) => node.getText(file).replace(/\s+/g, ' ').slice(0, 200)
    const record = (kind, node, detail) =>
        findings.push({
            kind,
            line: lineOf(node),
            text: textOf(node),
            ...(detail ? { detail } : {})
        })
    const addImport = (node, specifier, form) =>
        imports.push({
            specifier,
            form,
            class: classifyImport(specifier),
            package: packageOf(specifier),
            line: lineOf(node)
        })
    const isTypeContext = (node) => {
        for (let current = node.parent; current; current = current.parent) {
            if (
                ts.isTypeNode(current) ||
                ts.isInterfaceDeclaration(current) ||
                ts.isTypeAliasDeclaration(current)
            )
                return true
            if (ts.isStatement(current) || ts.isExpression(current)) return false
        }
        return false
    }
    const isNameOnly = (node) => {
        const parent = node.parent
        if (!parent) return false
        if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true
        if (ts.isQualifiedName(parent)) return true
        if (
            (ts.isPropertyAssignment(parent) ||
                ts.isMethodDeclaration(parent) ||
                ts.isPropertyDeclaration(parent) ||
                ts.isPropertySignature(parent) ||
                ts.isMethodSignature(parent) ||
                ts.isGetAccessor(parent) ||
                ts.isSetAccessor(parent) ||
                ts.isEnumMember(parent) ||
                ts.isVariableDeclaration(parent) ||
                ts.isParameter(parent) ||
                ts.isFunctionDeclaration(parent) ||
                ts.isClassDeclaration(parent) ||
                ts.isBindingElement(parent) ||
                ts.isLabeledStatement(parent) ||
                ts.isModuleDeclaration(parent)) &&
            parent.name === node
        )
            return true
        if (
            ts.isImportSpecifier(parent) ||
            ts.isExportSpecifier(parent) ||
            ts.isImportClause(parent) ||
            ts.isNamespaceImport(parent)
        )
            return true
        return isTypeContext(node)
    }
    const unwrap = (node) => {
        while (
            node &&
            (ts.isParenthesizedExpression(node) ||
                ts.isAsExpression(node) ||
                ts.isNonNullExpression(node) ||
                ts.isTypeAssertionExpression(node) ||
                ts.isSatisfiesExpression(node))
        )
            node = node.expression
        return node
    }
    const nameOf = (node) => {
        const inner = unwrap(node)
        return inner && ts.isIdentifier(inner) ? inner.text : ''
    }
    const memberText = (node) =>
        ts.isPropertyAccessExpression(node) && nameOf(node.expression)
            ? `${nameOf(node.expression)}.${node.name.text}`
            : undefined
    const isGlobalMember = (node) => {
        const inner = unwrap(node)
        return (
            Boolean(inner) &&
            (ts.isPropertyAccessExpression(inner) || ts.isElementAccessExpression(inner)) &&
            globalObjects.has(nameOf(inner.expression))
        )
    }
    const declared = new Set()
    const collect = (node) => {
        if (
            (ts.isVariableDeclaration(node) ||
                ts.isParameter(node) ||
                ts.isFunctionDeclaration(node) ||
                ts.isClassDeclaration(node) ||
                ts.isBindingElement(node) ||
                ts.isImportSpecifier(node) ||
                ts.isImportClause(node) ||
                ts.isNamespaceImport(node)) &&
            node.name &&
            ts.isIdentifier(node.name)
        )
            declared.add(node.name.text)
        ts.forEachChild(node, collect)
    }
    collect(file)
    const visit = (node) => {
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            const typeOnly = ts.isImportDeclaration(node)
                ? node.importClause?.isTypeOnly
                : node.isTypeOnly
            if (!typeOnly) addImport(node, node.moduleSpecifier.text, 'static')
        } else if (
            ts.isImportEqualsDeclaration(node) &&
            ts.isExternalModuleReference(node.moduleReference)
        ) {
            const expression = node.moduleReference.expression
            if (ts.isStringLiteral(expression)) addImport(node, expression.text, 'require')
            else record('computed_import', node)
        } else if (ts.isCallExpression(node)) {
            const callee = node.expression
            const argument = node.arguments[0]
            if (
                callee.kind === ts.SyntaxKind.ImportKeyword ||
                (ts.isIdentifier(callee) && callee.text === 'require')
            ) {
                const form = callee.kind === ts.SyntaxKind.ImportKeyword ? 'dynamic' : 'require'
                if (argument && ts.isStringLiteralLike(argument))
                    addImport(node, argument.text, form)
                else record('computed_import', node)
            }
            const callName = ts.isIdentifier(callee) ? callee.text : memberText(callee)
            if (
                ['setTimeout', 'setInterval', 'window.setTimeout', 'window.setInterval'].includes(
                    callName ?? ''
                )
            ) {
                record(
                    argument && ts.isStringLiteralLike(argument) ? 'evaluated_code' : 'timer',
                    node
                )
            }
            if (
                globalDefiners.has(callName ?? '') &&
                argument &&
                ts.isIdentifier(argument) &&
                globalObjects.has(argument.text)
            ) {
                record('global_mutation', node)
            }
            if (
                callName === 'document.createElement' &&
                argument &&
                ts.isStringLiteralLike(argument) &&
                injectedElements.has(argument.text.toLowerCase())
            ) {
                record('injected_element', node, argument.text)
            }
            if (
                (callName === 'addEventListener' ||
                    (ts.isPropertyAccessExpression(callee) &&
                        callee.name.text === 'addEventListener')) &&
                argument &&
                ts.isStringLiteralLike(argument) &&
                Object.hasOwn(eventKinds, argument.text)
            ) {
                record(eventKinds[argument.text], node)
            }
        } else if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
            node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
        ) {
            if (isGlobalMember(node.left)) record('global_mutation', node)
        } else if (
            ts.isVariableDeclaration(node) &&
            node.initializer &&
            globalObjects.has(nameOf(node.initializer))
        ) {
            record('global_object', node, 'alias of a global object')
        } else if (ts.isPropertyAccessExpression(node)) {
            const capability = memberCapability(nameOf(node.expression), node.name.text)
            if (capability) record(capability, node)
            if (
                node.name.text === 'prototype' &&
                builtinConstructors.has(nameOf(node.expression))
            ) {
                record('prototype_change', node)
            }
        } else if (
            ts.isElementAccessExpression(node) &&
            globalObjects.has(nameOf(node.expression))
        ) {
            record('computed_global_access', node)
        } else if (
            ts.isIdentifier(node) &&
            Object.hasOwn(capabilityGlobals, node.text) &&
            !isNameOnly(node)
        ) {
            record(
                capabilityGlobals[node.text],
                node,
                declared.has(node.text) ? 'name also declared in this file' : undefined
            )
        } else if (
            ts.isStringLiteralLike(node) ||
            ts.isTemplateHead(node) ||
            ts.isTemplateMiddle(node) ||
            ts.isTemplateTail(node)
        ) {
            if (!(
                node.parent &&
                (ts.isImportDeclaration(node.parent) ||
                    ts.isExportDeclaration(node.parent) ||
                    ts.isExternalModuleReference(node.parent))
            )) {
                checkString(node.text, record, node)
            }
        }
        ts.forEachChild(node, visit)
    }
    visit(file)
    return { findings, imports }
}

function scanSvelte(source) {
    const findings = []
    const imports = []
    const lineOf = (offset) => source.slice(0, offset).split('\n').length
    const textOf = (node) => source.slice(node.start, node.end).replace(/\s+/g, ' ').slice(0, 200)
    const record = (kind, node, detail) =>
        findings.push({
            kind,
            line: lineOf(node.start),
            text: textOf(node),
            ...(detail ? { detail } : {})
        })
    const addImport = (node, specifier, form) =>
        imports.push({
            specifier,
            form,
            class: classifyImport(specifier),
            package: packageOf(specifier),
            line: lineOf(node.start)
        })
    const expressionWrappers = new Set([
        'TSAsExpression',
        'TSNonNullExpression',
        'TSSatisfiesExpression',
        'TSTypeAssertion'
    ])
    const unwrap = (node) => {
        while (node && expressionWrappers.has(node.type)) node = node.expression
        return node
    }
    const nameOf = (node) => (unwrap(node)?.type === 'Identifier' ? unwrap(node).name : '')
    const memberText = (node) =>
        node?.type === 'MemberExpression' &&
        !node.computed &&
        nameOf(node.object) &&
        node.property.type === 'Identifier'
            ? `${nameOf(node.object)}.${node.property.name}`
            : undefined
    const isGlobalMember = (node) =>
        unwrap(node)?.type === 'MemberExpression' && globalObjects.has(nameOf(unwrap(node).object))
    const isStringLiteral = (node) => node?.type === 'Literal' && typeof node.value === 'string'
    const walk = (node, parent, key) => {
        if (!node || typeof node !== 'object') return
        if (Array.isArray(node)) {
            for (const child of node) walk(child, parent, key)
            return
        }
        if (expressionWrappers.has(node.type)) return walk(node.expression, node, 'expression')
        if (typeof node.type === 'string' && node.type.startsWith('TS')) return
        switch (node.type) {
            case 'ImportDeclaration':
                if (node.importKind !== 'type') addImport(node, node.source.value, 'static')
                break
            case 'ExportNamedDeclaration':
            case 'ExportAllDeclaration':
                if (node.source && node.exportKind !== 'type')
                    addImport(node, node.source.value, 'static')
                break
            case 'ImportExpression':
                if (isStringLiteral(node.source)) addImport(node, node.source.value, 'dynamic')
                else record('computed_import', node)
                break
            case 'CallExpression': {
                const argument = node.arguments[0]
                const callName =
                    node.callee.type === 'Identifier' ? node.callee.name : memberText(node.callee)
                if (callName === 'require') {
                    if (isStringLiteral(argument)) addImport(node, argument.value, 'require')
                    else record('computed_import', node)
                }
                if (
                    [
                        'setTimeout',
                        'setInterval',
                        'window.setTimeout',
                        'window.setInterval'
                    ].includes(callName ?? '')
                ) {
                    record(isStringLiteral(argument) ? 'evaluated_code' : 'timer', node)
                }
                if (
                    globalDefiners.has(callName ?? '') &&
                    argument?.type === 'Identifier' &&
                    globalObjects.has(argument.name)
                ) {
                    record('global_mutation', node)
                }
                if (
                    callName === 'document.createElement' &&
                    isStringLiteral(argument) &&
                    injectedElements.has(argument.value.toLowerCase())
                ) {
                    record('injected_element', node, argument.value)
                }
                if (
                    (callName === 'addEventListener' ||
                        (node.callee.type === 'MemberExpression' &&
                            node.callee.property?.name === 'addEventListener')) &&
                    isStringLiteral(argument) &&
                    Object.hasOwn(eventKinds, argument.value)
                ) {
                    record(eventKinds[argument.value], node)
                }
                break
            }
            case 'AssignmentExpression':
                if (isGlobalMember(node.left)) record('global_mutation', node)
                break
            case 'VariableDeclarator':
                if (node.init && globalObjects.has(nameOf(node.init)))
                    record('global_object', node, 'alias of a global object')
                break
            case 'MemberExpression': {
                const capability = node.computed
                    ? undefined
                    : memberCapability(nameOf(node.object), node.property?.name ?? '')
                if (capability) record(capability, node)
                if (
                    !node.computed &&
                    node.property?.name === 'prototype' &&
                    builtinConstructors.has(nameOf(node.object))
                ) {
                    record('prototype_change', node)
                }
                if (node.computed && globalObjects.has(nameOf(node.object))) {
                    record('computed_global_access', node)
                }
                break
            }
            case 'Identifier': {
                const nameOnly =
                    (parent?.type === 'MemberExpression' &&
                        key === 'property' &&
                        !parent.computed) ||
                    (parent?.type === 'Property' &&
                        key === 'key' &&
                        !parent.computed &&
                        !parent.shorthand) ||
                    (parent?.type === 'MethodDefinition' && key === 'key') ||
                    (parent?.type === 'PropertyDefinition' && key === 'key') ||
                    ((parent?.type === 'VariableDeclarator' ||
                        parent?.type === 'FunctionDeclaration') &&
                        key === 'id') ||
                    parent?.type?.startsWith('Import') ||
                    parent?.type === 'ExportSpecifier'
                if (!nameOnly && Object.hasOwn(capabilityGlobals, node.name)) {
                    record(
                        capabilityGlobals[node.name],
                        node,
                        declared.has(node.name) ? 'name also declared in this file' : undefined
                    )
                }
                break
            }
            case 'Literal':
                if (
                    typeof node.value === 'string' &&
                    !(parent?.type?.startsWith('Import') || parent?.type?.startsWith('Export'))
                ) {
                    checkString(node.value, record, node)
                }
                break
            case 'TemplateElement':
                checkString(node.value.cooked ?? node.value.raw, record, node)
                break
            case 'Text':
                if (parent?.type === 'Attribute') checkString(node.data, record, node)
                break
            case 'HtmlTag':
                record('html_injection', node)
                break
            case 'RegularElement':
                if (injectedElements.has(node.name.toLowerCase()))
                    record('injected_element', node, node.name)
                break
            case 'SvelteHead':
            case 'SvelteBody':
            case 'SvelteDocument':
                record('page_element', node, node.name)
                break
        }
        for (const [childKey, child] of Object.entries(node)) {
            if (
                childKey !== 'parent' &&
                childKey !== 'metadata' &&
                childKey !== 'typeAnnotation' &&
                childKey !== 'returnType'
            ) {
                walk(child, node, childKey)
            }
        }
    }
    const ast = parse(source, { modern: true })
    const declared = new Set()
    const collectPattern = (pattern) => {
        if (!pattern || typeof pattern !== 'object') return
        if (pattern.type === 'Identifier') declared.add(pattern.name)
        else if (pattern.type === 'ObjectPattern')
            pattern.properties.forEach((property) =>
                collectPattern(property.value ?? property.argument)
            )
        else if (pattern.type === 'ArrayPattern') pattern.elements.forEach(collectPattern)
        else if (pattern.type === 'RestElement') collectPattern(pattern.argument)
        else if (pattern.type === 'AssignmentPattern') collectPattern(pattern.left)
    }
    const collect = (node) => {
        if (!node || typeof node !== 'object') return
        if (Array.isArray(node)) return node.forEach(collect)
        if (node.type === 'VariableDeclarator') collectPattern(node.id)
        if (
            ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(
                node.type
            )
        ) {
            collectPattern(node.id)
            node.params.forEach(collectPattern)
        }
        if (node.type?.startsWith('Import') && node.local) declared.add(node.local.name)
        if (node.type === 'EachBlock') collectPattern(node.context)
        if (node.type === 'SnippetBlock') node.parameters.forEach(collectPattern)
        for (const [childKey, child] of Object.entries(node))
            if (childKey !== 'parent' && childKey !== 'metadata') collect(child)
    }
    collect(ast)
    walk(ast, undefined, undefined)
    return { findings, imports }
}

const results = []
for (const path of JSON.parse(readFileSync(0, 'utf8'))) {
    const source = readFileSync(path, 'utf8')
    try {
        results.push({
            path,
            ...(path.endsWith('.svelte') ? scanSvelte(source) : scanScript(source, path))
        })
    } catch (error) {
        results.push({ path, error: String(error.message ?? error) })
    }
}
process.stdout.write(JSON.stringify(results))
