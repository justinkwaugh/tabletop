#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
    buildLogFilter,
    formatLogEntry,
    parseCount,
    parseJsonOr,
    parseTime,
    parseWhere,
    permissionHint,
    protoTimestampToIso,
    redact,
    summarizeTask
} from './lib.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const deployConfigPath = path.join(repoRoot, 'tools/deploy/deploy.config.json')
const defaultCredentialFile = '.secrets/gcloud-investigate-key.json'

const USAGE = `Usage: node tools/investigate/src/cli.mjs <command> [options]

Commands (all read-only):
  check                                 Verify credentials and each permission
  logs [--service backend|tasks|all] [--since 1h] [--until <time>] [--severity ERROR]
       [--grep <text>] [--request <reqId>] [--filter '<raw logging filter>'] [--any-resource]
       [--limit 100] [--json]           Cloud Logging entries, oldest first
  services                              Cloud Run services, serving revisions and traffic split
  revisions <service> [--limit 10]      Revision history of one Cloud Run service
  tasks [--queue <name>] [--limit 50]   Cloud Tasks queues, or the pending tasks in one queue
  collections [<doc path>]              Root collections, or the subcollections of a document
  doc <collection/id[/sub/id]>          One Firestore document
  list <collection> [--group] [--where f,op,v]... [--order field[:desc]] [--limit 20]
       [--select a,b] [--count]         A collection query; --group spans every subcollection of that name
  find-user <username|email|userId>     Resolve a user and summarize their push subscriptions
  game <gameId> [--actions 10]          Game record, state summary and the latest actions

Config: tools/deploy/deploy.config.json backend.project / backend.region / backend.service /
backend.tasksService and investigateCredentialFile (default ${defaultCredentialFile}).
Env overrides: GCLOUD_PROJECT, TABLETOP_BACKEND_REGION, TABLETOP_INVESTIGATE_CREDENTIAL_FILE.`

function loadConfig() {
    const config = existsSync(deployConfigPath)
        ? JSON.parse(readFileSync(deployConfigPath, 'utf8'))
        : {}
    const backend = config.backend ?? {}
    const credentialFile = path.resolve(
        repoRoot,
        process.env.TABLETOP_INVESTIGATE_CREDENTIAL_FILE ??
            config.investigateCredentialFile ??
            defaultCredentialFile
    )
    const deployCredentialFile = config.gcloudCredentialFile
        ? path.resolve(repoRoot, config.gcloudCredentialFile)
        : undefined
    const project = process.env.GCLOUD_PROJECT ?? backend.project
    if (!project)
        fail('No project: set backend.project in tools/deploy/deploy.config.json or GCLOUD_PROJECT')
    if (!existsSync(credentialFile))
        fail(
            `Credential file not found at ${credentialFile}. See tools/investigate/README.md to create the read-only service account key.`
        )
    return {
        project,
        region: process.env.TABLETOP_BACKEND_REGION ?? backend.region ?? 'us-central1',
        services: { backend: backend.service ?? 'backend', tasks: backend.tasksService ?? 'tasks' },
        credentialFile,
        usesDeployKey: deployCredentialFile === credentialFile,
        serviceAccount: JSON.parse(readFileSync(credentialFile, 'utf8')).client_email
    }
}

function fail(message) {
    console.error(message)
    process.exit(1)
}

async function googleAuth(credentialFile) {
    const { GoogleAuth } = await import('google-auth-library')
    // Cloud Run rejects the cloud-platform.read-only scope; read-only is enforced by the viewer roles instead.
    return new GoogleAuth({
        keyFilename: credentialFile,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    })
}

async function firestoreClient(config) {
    const { Firestore } = await import('@google-cloud/firestore')
    return new Firestore({ projectId: config.project, keyFilename: config.credentialFile })
}

async function tasksClient(config) {
    const { CloudTasksClient } = await import('@google-cloud/tasks')
    return new CloudTasksClient({ projectId: config.project, keyFilename: config.credentialFile })
}

function resolveServices(config, name) {
    if (name === undefined || name === 'all') return Object.values(config.services)
    return [config.services[name] ?? name]
}

async function readLogs(config, options) {
    const auth = await googleAuth(config.credentialFile)
    const filter = buildLogFilter({
        services: resolveServices(config, options.service),
        since: parseTime(options.since ?? '1h'),
        until: options.until ? parseTime(options.until) : undefined,
        severity: options.severity,
        grep: options.grep,
        requestId: options.request,
        raw: options.filter,
        anyResource: options['any-resource']
    })
    const limit = parseCount(options.limit, 100)
    const entries = []
    let pageToken
    while (entries.length < limit) {
        const response = await auth.request({
            url: 'https://logging.googleapis.com/v2/entries:list',
            method: 'POST',
            data: {
                resourceNames: [`projects/${config.project}`],
                filter,
                orderBy: 'timestamp desc',
                pageSize: Math.min(limit - entries.length, 1000),
                pageToken
            }
        })
        entries.push(...(response.data.entries ?? []))
        pageToken = response.data.nextPageToken
        if (!pageToken) break
    }
    return { filter, entries: entries.slice(0, limit).reverse() }
}

async function listServices(config) {
    const auth = await googleAuth(config.credentialFile)
    const response = await auth.request({
        url: `https://run.googleapis.com/v2/projects/${config.project}/locations/${config.region}/services`
    })
    return (response.data.services ?? []).map((service) => ({
        name: service.name.split('/').pop(),
        updateTime: service.updateTime,
        latestReadyRevision: service.latestReadyRevision?.split('/').pop(),
        traffic: (service.trafficStatuses ?? service.traffic ?? []).map((t) => ({
            revision: t.revision?.split('/').pop() ?? t.type,
            percent: t.percent
        })),
        uri: service.uri
    }))
}

async function listRevisions(config, service, options) {
    const auth = await googleAuth(config.credentialFile)
    const [serviceName] = resolveServices(config, service)
    const response = await auth.request({
        url: `https://run.googleapis.com/v2/projects/${config.project}/locations/${config.region}/services/${serviceName}/revisions`,
        params: { pageSize: parseCount(options.limit, 10) }
    })
    return (response.data.revisions ?? [])
        .map((revision) => ({
            name: revision.name.split('/').pop(),
            createTime: revision.createTime,
            image: revision.containers?.[0]?.image,
            ready: revision.conditions?.find((c) => c.type === 'Ready')?.state,
            env: (revision.containers?.[0]?.env ?? []).map((e) => e.name)
        }))
        .sort((a, b) => (a.createTime < b.createTime ? 1 : -1))
}

async function listTasks(config, options) {
    const client = await tasksClient(config)
    const parent = client.locationPath(config.project, config.region)
    if (!options.queue) {
        const [queues] = await client.listQueues({ parent })
        return queues.map((queue) => ({
            name: queue.name.split('/').pop(),
            state: queue.state,
            maxDispatchesPerSecond: queue.rateLimits?.maxDispatchesPerSecond,
            maxAttempts: queue.retryConfig?.maxAttempts,
            purgeTime: protoTimestampToIso(queue.purgeTime)
        }))
    }
    const queuePath = client.queuePath(config.project, config.region, options.queue)
    const limit = parseCount(options.limit, 50)
    let tasks
    try {
        ;[tasks] = await client.listTasks(
            { parent: queuePath, responseView: 'FULL', pageSize: limit },
            { autoPaginate: false }
        )
    } catch (error) {
        if (error.code !== 7) throw error
        ;[tasks] = await client.listTasks(
            { parent: queuePath, responseView: 'BASIC', pageSize: limit },
            { autoPaginate: false }
        )
    }
    const now = new Date()
    return tasks.slice(0, limit).map((task) => summarizeTask(task, now))
}

async function listCollections(config, docPath) {
    const firestore = await firestoreClient(config)
    const parent = docPath ? firestore.doc(docPath) : firestore
    const collections = await parent.listCollections()
    return collections.map((collection) => collection.id)
}

async function getDoc(config, docPath) {
    const firestore = await firestoreClient(config)
    const snapshot = await firestore.doc(docPath).get()
    if (!snapshot.exists) return { path: docPath, exists: false }
    return { path: docPath, exists: true, data: redact(snapshot.data()) }
}

async function listDocs(config, collection, options) {
    const firestore = await firestoreClient(config)
    let query = options.group
        ? firestore.collectionGroup(collection)
        : firestore.collection(collection)
    for (const where of options.where ?? []) query = query.where(...parseWhere(where))
    if (options.order) {
        const [field, direction] = options.order.split(':')
        query = query.orderBy(field, direction === 'desc' ? 'desc' : 'asc')
    }
    if (options.count) return { count: (await query.count().get()).data().count }
    if (options.select) query = query.select(...options.select.split(','))
    const snapshot = await query.limit(parseCount(options.limit, 20)).get()
    return snapshot.docs.map((doc) => ({ path: doc.ref.path, data: redact(doc.data()) }))
}

const STATE_SUMMARY_FIELDS = [
    'id',
    'actionCount',
    'actionChecksum',
    'activePlayerIds',
    'machineState',
    'winningPlayerIds'
]

async function inspectGame(config, gameId, options) {
    const firestore = await firestoreClient(config)
    const gameRef = firestore.collection('games').doc(gameId)
    const game = await gameRef.get()
    if (!game.exists) return { id: gameId, exists: false }
    const states = await gameRef.collection('states').limit(5).get()
    const actionCount = parseCount(options.actions, 10)
    const actions = game.data().actionChunkSize
        ? await latestChunkedActions(gameRef, actionCount)
        : await latestUnchunkedActions(gameRef, actionCount)
    return {
        id: gameId,
        exists: true,
        game: redact(game.data()),
        states: states.docs.map((doc) => summarizeState(doc)),
        latestActions: actions.map((action) => redact(summarizeAction(action))),
        logsHint: `logs --since 24h --grep ${gameId}`
    }
}

async function latestChunkedActions(gameRef, count) {
    const chunks = await gameRef
        .collection('actionChunks')
        .orderBy('endIndex', 'desc')
        .limit(2)
        .get()
    return chunks.docs
        .flatMap((doc) => parseJsonOr(doc.data().actionsData ?? '[]', []))
        .sort((a, b) => (b.index ?? 0) - (a.index ?? 0))
        .slice(0, count)
}

async function latestUnchunkedActions(gameRef, count) {
    const actions = await gameRef.collection('actions').orderBy('index', 'desc').limit(count).get()
    return actions.docs.map((doc) => doc.data())
}

function summarizeAction(action) {
    const { id, index, type, playerId, source, createdAt, simultaneousGroupId } = action
    return { id, index, type, playerId, source, createdAt, simultaneousGroupId }
}

function summarizeState(doc) {
    const state = parseJsonOr(doc.data().data ?? '', {})
    const summary = { docId: doc.id }
    for (const field of STATE_SUMMARY_FIELDS) summary[field] = state[field]
    return summary
}

async function findUser(config, needle) {
    const firestore = await firestoreClient(config)
    const users = firestore.collection('users')
    let snapshot
    if (needle.includes('@')) snapshot = await users.where('email', '==', needle).limit(5).get()
    else {
        snapshot = await users.where('cleanUsername', '==', needle.toLowerCase()).limit(5).get()
        if (snapshot.empty) {
            const byId = await users.doc(needle).get()
            if (byId.exists) snapshot = { docs: [byId] }
        }
    }
    const results = []
    for (const doc of snapshot.docs ?? []) {
        const data = doc.data()
        const topic = await firestore.collection('pushTopics').doc(`user-${doc.id}`).get()
        const clients = topic.exists ? (topic.data().clients ?? []) : []
        const subscriptions = []
        for (const client of clients) {
            const sub = await firestore.collection('notificationSubscriptions').doc(client.id).get()
            subscriptions.push(
                sub.exists
                    ? { id: client.id, ...redact(sub.data()) }
                    : { id: client.id, missing: true }
            )
        }
        results.push({
            id: doc.id,
            username: data.username,
            email: data.email,
            status: data.status,
            roles: data.roles,
            createdAt: redact(data.createdAt),
            pushTopic: topic.exists
                ? { clients: clients.length, updatedAt: redact(topic.data().updatedAt) }
                : null,
            subscriptions
        })
    }
    return results
}

async function check(config) {
    console.log(`project: ${config.project}`)
    console.log(`region: ${config.region}`)
    console.log(`service account: ${config.serviceAccount}`)
    console.log(`services: ${Object.values(config.services).join(', ')}`)
    if (config.usesDeployKey)
        console.log(
            'WARNING: credential file is the deploy key, which can write; use a viewer-only key'
        )
    const probes = [
        [
            'logs',
            async () =>
                `${(await readLogs(config, { since: '24h', limit: '1' })).entries.length} entry in last 24h`
        ],
        ['services', async () => `${(await listServices(config)).length} services`],
        ['tasks', async () => `${(await listTasks(config, {})).length} queues`],
        [
            'firestore',
            async () => `${(await listDocs(config, 'users', { limit: '1' })).length} user read`
        ]
    ]
    let ok = true
    for (const [capability, probe] of probes) {
        try {
            console.log(`${capability.padEnd(10)} ok   ${await probe()}`)
        } catch (error) {
            ok = false
            console.log(`${capability.padEnd(10)} FAIL ${permissionHint(capability, error)}`)
        }
    }
    if (!ok) process.exit(1)
}

function print(value, json) {
    console.log(json ? JSON.stringify(value) : JSON.stringify(value, null, 2))
}

async function main() {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            service: { type: 'string' },
            since: { type: 'string' },
            until: { type: 'string' },
            severity: { type: 'string' },
            grep: { type: 'string' },
            request: { type: 'string' },
            filter: { type: 'string' },
            limit: { type: 'string' },
            queue: { type: 'string' },
            where: { type: 'string', multiple: true },
            order: { type: 'string' },
            select: { type: 'string' },
            actions: { type: 'string' },
            json: { type: 'boolean' },
            group: { type: 'boolean' },
            count: { type: 'boolean' },
            'any-resource': { type: 'boolean' },
            help: { type: 'boolean', short: 'h' }
        }
    })
    const [command, argument] = positionals
    if (values.help || !command) {
        console.log(USAGE)
        return
    }
    const config = loadConfig()
    switch (command) {
        case 'check':
            return check(config)
        case 'logs': {
            const { filter, entries } = await readLogs(config, values)
            if (values.json) return entries.forEach((entry) => console.log(JSON.stringify(entry)))
            console.log(`# filter: ${filter}`)
            console.log(`# ${entries.length} entries, oldest first`)
            return entries.forEach((entry) => console.log(formatLogEntry(entry)))
        }
        case 'services':
            return print(await listServices(config), values.json)
        case 'revisions':
            if (!argument) fail('revisions needs a service name')
            return print(await listRevisions(config, argument, values), values.json)
        case 'tasks':
            return print(await listTasks(config, values), values.json)
        case 'collections':
            return print(await listCollections(config, argument), values.json)
        case 'doc':
            if (!argument) fail('doc needs a document path such as users/<id>')
            return print(await getDoc(config, argument), values.json)
        case 'list':
            if (!argument) fail('list needs a collection path such as games')
            return print(await listDocs(config, argument, values), values.json)
        case 'game':
            if (!argument) fail('game needs a game id')
            return print(await inspectGame(config, argument, values), values.json)
        case 'find-user':
            if (!argument) fail('find-user needs a username, email or user id')
            return print(await findUser(config, argument), values.json)
        default:
            fail(`Unknown command "${command}"\n\n${USAGE}`)
    }
}

main().catch((error) => {
    console.error(error.message ?? error)
    process.exit(1)
})
