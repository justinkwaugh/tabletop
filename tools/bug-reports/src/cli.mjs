#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import {
    STATUS_LIST,
    STATUS_TAGS,
    appliedTagIds,
    dataReportId,
    findTag,
    isStatusTag,
    keyedTags,
    matchesStatus,
    mergeReport,
    PRIVATE_FIELDS,
    publicViewing,
    messageContentIntent,
    newestFirst,
    parseLimit,
    postIdFromArgument,
    postLabel,
    postStatus,
    postUrl,
    reportFromMessage,
    reporterFromField,
    splitMessage,
    summarizeMessage,
    summarizePost,
    uniqueFilename,
    withStatus,
    withTags
} from './lib.mjs'
import {
    checkForumInputs,
    checkStageInputs,
    forumRecord,
    notifiesReporter,
    reporterMessage
} from './milestones.mjs'

const API = 'https://discord.com/api/v10'
const FORUM_NAME = 'bug-reports'
const DATA_CHANNEL_NAME = 'bug-report-data'
const GUILD_FORUM = 15
const GUILD_TEXT = 0
const TOKEN_FILE = '.secrets/discord-bot-token'
const RESEND_KEY_FILE = '.secrets/resend-api-key'
const EMAIL_FROM = 'BoardTogether <noreply@boardtogether.games>'
// Discord message flag that keeps the game link from unfurling into a preview.
const SUPPRESS_EMBEDS = 1 << 2
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

const USAGE = `Usage: node tools/bug-reports/src/cli.mjs <command> [options]

Read:
  check                              Token, bot, forum, tags, the Message Content intent and email
  list [--status unresolved|all|<status>] [--limit 25]
                                     Posts by status tag, newest first, closed or not; unresolved
                                     (open, investigating, reproduced or no status) by default
  show <post>                        The report, its details and every reply
  download <post> [--out <dir>]      Every file in the post and its staff-only data (the scenario,
                                     screenshots); prints paths

Write (seen in the Discord forum; milestones also reach the reporter):
  reply <post> (--message <text> | --message-file <path|->)
                                     Post a message; split when over 2000 characters
  status <post> <${STATUS_TAGS.join('|')}>
         [--note <text>] [--finding <text>] [--version <text>] [--approved] [--no-notify]
                                     Replace the post's status tag; a closed post stays closed
  close <post> --as <status> [--note <text>] [--finding <text>] [--version <text>] [--approved]
        [--no-notify] [--lock]
                                     Set the status tag, then close the post
  notify <post> [--note <text>] [--version <text>] [--approved]
                                     Message the reporter again for the post's current status
  tag <post> [--add <tag,...>] [--remove <tag,...>]
                                     Add or remove other tags (UI, logic); a closed post stays closed
  reopen <post>                      Reopen a closed post and set it back to open
  migrate                            Move the game link, IDs and scenario of every report from
                                     before the split into #${DATA_CHANNEL_NAME}, then strip them
                                     from the public post
Every write accepts --dry-run: it prints what would happen, writes the email preview, and
changes nothing.

Milestones: every status but open is a milestone. Setting one posts the status in the forum,
updates the post, then messages the reporter: by Discord direct message when their account is
linked, else by email, in the status's fixed wording plus --note. reproduced needs --finding,
what was reproduced, posted in the forum under the status (the reporter gets --note, not this);
fixed needs --version (it goes in the forum line; the reporter reads "our latest update"); wont
fix and not a bug need --note; not a bug also needs --finding, why the game works this way, for
the forum, and --approved, given only after the user has read its --dry-run; suggestion thanks
the reporter for the idea. A status the post already has is not sent twice; notify sends it
again. --no-notify sets the tag alone.

<post> is the post id from list, or a discord.com/channels/... link to the post or a message in it.
Every read command accepts --json.

Token: DISCORD_BOT_TOKEN, else ${TOKEN_FILE} in this checkout or the main worktree.
Email: RESEND_API_KEY, else ${RESEND_KEY_FILE}; the address comes from tools/investigate find-user.
Forum: DISCORD_BUG_REPORT_CHANNEL_ID, else the forum named "${FORUM_NAME}" in the bot's servers.
Data: DISCORD_BUG_REPORT_DATA_CHANNEL_ID, else the text channel named "${DATA_CHANNEL_NAME}". It is
staff-only: it holds each report's game link, IDs and scenario, which reveal other players' hidden
information.
Downloads and email previews go to tmp/bug-reports/<post> under the main worktree.`

function fail(message) {
    console.error(message)
    process.exit(1)
}

// A git worktree has none of the main checkout's gitignored files, so the main worktree is the fallback for them.
function mainWorktreeRoot() {
    try {
        const commonDir = execFileSync(
            'git',
            ['rev-parse', '--path-format=absolute', '--git-common-dir'],
            { cwd: repoRoot, encoding: 'utf8' }
        ).trim()
        return path.dirname(commonDir)
    } catch {
        return repoRoot
    }
}

function postFolder(threadId) {
    return path.join(mainWorktreeRoot(), 'tmp/bug-reports', threadId)
}

function loadSecret(envName, file) {
    if (process.env[envName]) return process.env[envName]
    for (const root of new Set([repoRoot, mainWorktreeRoot()])) {
        const secretFile = path.join(root, file)
        if (existsSync(secretFile)) return readFileSync(secretFile, 'utf8').trim()
    }
    return undefined
}

function discordClient(token) {
    async function request(method, apiPath, body) {
        for (let attempt = 0; ; attempt++) {
            const response = await fetch(`${API}${apiPath}`, {
                method,
                headers: {
                    Authorization: `Bot ${token}`,
                    ...(body ? { 'Content-Type': 'application/json' } : {})
                },
                body: body ? JSON.stringify(body) : undefined
            })
            if (response.status === 429 && attempt < 3) {
                const { retry_after: retryAfter = 1 } = await response.json()
                await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 + 100))
                continue
            }
            const text = await response.text()
            if (!response.ok) {
                throw new Error(
                    `Discord ${method} ${apiPath} failed with ${response.status}: ${text}`
                )
            }
            return text ? JSON.parse(text) : undefined
        }
    }
    // Discord takes files as multipart parts named files[n], with the JSON body in payload_json.
    async function postFiles(apiPath, body, files) {
        const form = new FormData()
        form.append('payload_json', JSON.stringify(body))
        files.forEach((file, index) => {
            form.append(
                `files[${index}]`,
                new Blob([file.content], { type: file.contentType }),
                file.filename
            )
        })
        const response = await fetch(`${API}${apiPath}`, {
            method: 'POST',
            headers: { Authorization: `Bot ${token}` },
            body: form
        })
        const text = await response.text()
        if (!response.ok) {
            throw new Error(`Discord POST ${apiPath} failed with ${response.status}: ${text}`)
        }
        return JSON.parse(text)
    }
    return {
        get: (apiPath) => request('GET', apiPath),
        post: (apiPath, body) => request('POST', apiPath, body),
        patch: (apiPath, body) => request('PATCH', apiPath, body),
        postFiles
    }
}

async function findForumChannel(discord) {
    const configuredId = process.env.DISCORD_BUG_REPORT_CHANNEL_ID
    if (configuredId) {
        const channel = await discord.get(`/channels/${configuredId}`)
        if (channel.type !== GUILD_FORUM) {
            fail(`DISCORD_BUG_REPORT_CHANNEL_ID ${configuredId} is not a forum channel`)
        }
        return channel
    }
    const guilds = await discord.get('/users/@me/guilds')
    for (const guild of guilds) {
        const channels = await discord.get(`/guilds/${guild.id}/channels`)
        const forum = channels.find(
            (channel) => channel.type === GUILD_FORUM && channel.name === FORUM_NAME
        )
        if (forum) return forum
    }
    fail(`No forum named "${FORUM_NAME}" in the bot's servers; set DISCORD_BUG_REPORT_CHANNEL_ID`)
}

async function findDataChannel(discord) {
    const configuredId = process.env.DISCORD_BUG_REPORT_DATA_CHANNEL_ID
    if (configuredId) return discord.get(`/channels/${configuredId}`)
    const guilds = await discord.get('/users/@me/guilds')
    for (const guild of guilds) {
        const channels = await discord.get(`/guilds/${guild.id}/channels`)
        const channel = channels.find(
            (candidate) => candidate.type === GUILD_TEXT && candidate.name === DATA_CHANNEL_NAME
        )
        if (channel) return channel
    }
    return undefined
}

async function requireDataChannel(discord) {
    const channel = await findDataChannel(discord)
    if (!channel) {
        fail(
            `No text channel named "${DATA_CHANNEL_NAME}" in the bot's servers; set DISCORD_BUG_REPORT_DATA_CHANNEL_ID`
        )
    }
    return channel
}

// Newest first, so a report filed recently is found within the first page.
async function findDataMessage(discord, channelId, matches) {
    let before
    for (;;) {
        const query = new URLSearchParams({ limit: '100', ...(before ? { before } : {}) })
        const page = await discord.get(`/channels/${channelId}/messages?${query}`)
        const found = page.find(matches)
        if (found) return found
        if (page.length < 100) return undefined
        before = page.at(-1).id
    }
}

// A report from before the split has no report ID and keeps everything in the public post.
async function readData(discord, report) {
    if (!report?.reportId) return undefined
    const channel = await findDataChannel(discord)
    if (!channel) {
        console.warn(
            `No #${DATA_CHANNEL_NAME} channel: showing the public post without its game link, IDs or scenario`
        )
        return undefined
    }
    const data = await findDataMessage(
        discord,
        channel.id,
        (message) => message.author?.bot && dataReportId(message) === report.reportId
    )
    if (!data) {
        console.warn(
            `No data message for report ${report.reportId} in #${channel.name}: no game link, IDs or scenario`
        )
    }
    return data
}

async function findForum(discord) {
    const channel = await findForumChannel(discord)
    return {
        id: channel.id,
        name: channel.name,
        guildId: channel.guild_id,
        tags: keyedTags(channel.available_tags)
    }
}

async function getPost(discord, forum, argument) {
    if (!argument) fail('This command needs a post id or link')
    const id = postIdFromArgument(argument)
    if (!id) fail(`"${argument}" is not a post id or link`)
    const thread = await discord.get(`/channels/${id}`)
    if (thread.parent_id !== forum.id) fail(`${thread.id} is not a post in #${forum.name}`)
    return thread
}

// Discord closes a post by itself after a week without activity, so an unanswered report can
// be closed; the status tag, not the closed state, says whether it is resolved.
async function allPosts(discord, forum) {
    const active = await discord.get(`/guilds/${forum.guildId}/threads/active`)
    const threads = active.threads.filter((thread) => thread.parent_id === forum.id)
    let before
    for (;;) {
        const query = new URLSearchParams({ limit: '100', ...(before ? { before } : {}) })
        const page = await discord.get(`/channels/${forum.id}/threads/archived/public?${query}`)
        threads.push(...page.threads)
        if (!page.has_more || page.threads.length === 0) break
        before = page.threads.at(-1).thread_metadata.archive_timestamp
    }
    return threads
}

async function listPosts(discord, forum, options) {
    const filter = options.status ?? 'unresolved'
    if (!['unresolved', 'all'].includes(filter) && !isStatusTag(findTag(forum.tags, filter))) {
        fail(`--status takes unresolved, all or one of: ${STATUS_LIST}`)
    }
    const limit = parseLimit(options.limit, 25)
    return (await allPosts(discord, forum))
        .sort(newestFirst)
        .map((thread) => summarizePost(thread, forum.tags))
        .filter((post) => matchesStatus(post.status, filter))
        .slice(0, limit)
}

async function readMessages(discord, threadId) {
    const messages = []
    let after = '0'
    for (;;) {
        const page = await discord.get(`/channels/${threadId}/messages?limit=100&after=${after}`)
        if (page.length === 0) break
        page.sort(newestFirst).reverse()
        messages.push(...page)
        after = page.at(-1).id
        if (page.length < 100) break
    }
    return messages
}

async function readReport(discord, thread) {
    const [first] = await readMessages(discord, thread.id)
    if (!first?.author?.bot) return undefined
    const report = reportFromMessage(first)
    const data = await readData(discord, report)
    return report && mergeReport(report, data && reportFromMessage(data))
}

async function showPost(discord, forum, argument) {
    const thread = await getPost(discord, forum, argument)
    const messages = await readMessages(discord, thread.id)
    const botReport = messages[0]?.author?.bot ? messages[0] : undefined
    const report = botReport ? reportFromMessage(botReport) : undefined
    const data = await readData(discord, report)
    return {
        ...summarizePost(thread, forum.tags),
        report: report && mergeReport(report, data && reportFromMessage(data)),
        files: [
            ...(botReport ? summarizeMessage(botReport).files : []),
            ...(data ? summarizeMessage(data).files : [])
        ],
        replies: (botReport ? messages.slice(1) : messages).map(summarizeMessage)
    }
}

function printFiles(files) {
    for (const file of files) console.log(`File: ${file.filename} (${file.size} bytes)`)
}

function printPost(post) {
    console.log(`${post.title}\n${postLabel(post)} · opened ${post.openedAt}`)
    console.log(`post ${post.id} · ${post.url}`)
    if (post.report) {
        console.log(
            `\n${[post.report.game, post.report.gameUrl].filter(Boolean).join(' · ')}\n\n${post.report.description}\n`
        )
        for (const [name, value] of Object.entries(post.report.fields)) {
            console.log(`${name}: ${value.replace(/\n/g, '\n    ')}`)
        }
    }
    printFiles(post.files)
    console.log(`\n${post.replies.length} replies`)
    for (const reply of post.replies) {
        console.log(`\n--- ${reply.author}${reply.bot ? ' (bot)' : ''} · ${reply.sentAt}`)
        if (reply.hidden) console.log('(text hidden: run check for the Message Content intent)')
        if (reply.content) console.log(reply.content)
        printFiles(reply.files)
    }
}

async function downloadFiles(discord, forum, argument, options) {
    const thread = await getPost(discord, forum, argument)
    const out = path.resolve(options.out ?? postFolder(thread.id))
    mkdirSync(out, { recursive: true })
    const used = new Set()
    const saved = []
    const messages = await readMessages(discord, thread.id)
    const report = messages[0]?.author?.bot ? reportFromMessage(messages[0]) : undefined
    const data = await readData(discord, report)
    for (const message of data ? [...messages, data] : messages) {
        for (const file of summarizeMessage(message).files) {
            const response = await fetch(file.url)
            if (!response.ok) fail(`Downloading ${file.filename} failed with ${response.status}`)
            const target = path.join(out, uniqueFilename(file.filename, used))
            writeFileSync(target, Buffer.from(await response.arrayBuffer()))
            saved.push(target)
        }
    }
    return saved
}

// One-off for posts filed before the split; delete once it has run. The copy goes first so a
// failed strip loses nothing, and a rerun reuses the copy it finds by the thread link.
async function migrate(discord, forum, dryRun) {
    const dataChannel = dryRun ? undefined : await requireDataChannel(discord)
    const results = { moved: 0, skipped: 0, unreadable: [] }
    for (const thread of (await allPosts(discord, forum)).sort(newestFirst)) {
        const [first] = await readMessages(discord, thread.id)
        const report = first?.author?.bot ? reportFromMessage(first) : undefined
        if (first?.author?.bot && !report && (first.attachments ?? []).some(isScenario)) {
            results.unreadable.push(thread.id)
            continue
        }
        if (!report || report.reportId) {
            results.skipped++
            continue
        }
        const threadLink = `https://discord.com/channels/${forum.guildId}/${thread.id}`
        if (dryRun) {
            console.log(`Would move ${thread.id} · ${thread.name}`)
            results.moved++
            continue
        }
        const existing = await findDataMessage(
            discord,
            dataChannel.id,
            (message) => message.author?.bot && message.content?.includes(threadLink)
        )
        if (existing && !dataReportId(existing)) {
            fail(
                `The data message ${existing.id} for ${thread.id} has no report ID; fix it by hand`
            )
        }
        const reportId = existing ? dataReportId(existing) : randomBytes(8).toString('base64url')
        if (!existing) await postLegacyData(discord, dataChannel.id, first, reportId, threadLink)
        await stripLegacyPost(discord, thread, first, reportId)
        console.log(`Moved ${thread.id} · ${thread.name}`)
        results.moved++
    }
    console.log(
        `${dryRun ? 'Would move' : 'Moved'} ${results.moved}; ${results.skipped} already split or not bot reports`
    )
    for (const id of results.unreadable) {
        console.log(`Left ${id}: a bot post with a scenario but no report embed; strip it by hand`)
    }
}

function isScenario(attachment) {
    return attachment.filename.endsWith('.json')
}

async function postLegacyData(discord, channelId, message, reportId, threadLink) {
    const embed = message.embeds[0]
    const fields = embed.fields ?? []
    const files = []
    for (const attachment of (message.attachments ?? []).filter(isScenario)) {
        const response = await fetch(attachment.url)
        if (!response.ok) fail(`Downloading ${attachment.filename} failed with ${response.status}`)
        files.push({
            filename: attachment.filename,
            contentType: 'application/json',
            content: Buffer.from(await response.arrayBuffer())
        })
    }
    const body = {
        content: `Data for bug report ${reportId} · ${threadLink}`,
        embeds: [
            {
                title: embed.title,
                url: embed.url,
                color: embed.color,
                fields: fields.filter(
                    (field) => PRIVATE_FIELDS.includes(field.name) || field.name === 'Viewing'
                ),
                timestamp: embed.timestamp
            }
        ],
        ...(embed.url
            ? {
                  components: [
                      {
                          type: 1,
                          components: [{ type: 2, style: 5, label: 'Open game', url: embed.url }]
                      }
                  ]
              }
            : {}),
        attachments: files.map((file, id) => ({ id, filename: file.filename })),
        allowed_mentions: { parse: [] }
    }
    return files.length > 0
        ? discord.postFiles(`/channels/${channelId}/messages`, body, files)
        : discord.post(`/channels/${channelId}/messages`, body)
}

// Discord refuses edits in a closed post, so it is reopened for the edit and closed again.
async function stripLegacyPost(discord, thread, message, reportId) {
    const embed = message.embeds[0]
    const fields = embed.fields ?? []
    const { archived = false, locked = false } = thread.thread_metadata ?? {}
    // Discord edits a thread's other settings only while it is open, so both change in one request.
    if (archived || locked) {
        await discord.patch(`/channels/${thread.id}`, { archived: false, locked: false })
    }
    try {
        await discord.patch(`/channels/${thread.id}/messages/${message.id}`, {
            embeds: [
                {
                    title: fields.find((field) => field.name === 'Game')?.value ?? embed.title,
                    description: embed.description,
                    color: embed.color,
                    fields: fields
                        .filter((field) => !PRIVATE_FIELDS.includes(field.name))
                        .map((field) =>
                            field.name === 'Viewing'
                                ? { ...field, value: publicViewing(field.value) }
                                : field
                        ),
                    footer: { text: `BoardTogether · report ${reportId}` },
                    timestamp: embed.timestamp
                }
            ],
            components: [],
            attachments: (message.attachments ?? [])
                .filter((attachment) => !isScenario(attachment))
                .map((attachment) => ({ id: attachment.id }))
        })
    } finally {
        if (archived || locked) await discord.patch(`/channels/${thread.id}`, { archived, locked })
    }
}

function messageText(options) {
    if (options.message !== undefined && options['message-file'] !== undefined) {
        fail('Use either --message or --message-file')
    }
    if (options.message !== undefined) return options.message
    if (options['message-file'] === undefined) return undefined
    const file = options['message-file']
    return readFileSync(file === '-' ? 0 : file, 'utf8')
}

async function reply(discord, thread, text) {
    const parts = splitMessage(text)
    if (parts.length === 0) fail('The message is empty')
    for (const content of parts) {
        // Mentioned users are pinged; @everyone and roles never are.
        await discord.post(`/channels/${thread.id}/messages`, {
            content,
            allowed_mentions: { parse: ['users'] }
        })
    }
    return parts.length
}

// Discord edits nothing on a closed post, so a closed one is reopened for the change; if the
// change then fails, a post that was closed is closed again rather than left open. A reply
// reopens a post too, so the caller may say it was closed before that.
async function updatePost(
    discord,
    forum,
    thread,
    change,
    wasClosed = thread.thread_metadata?.archived ?? false
) {
    const { appliedTags, closed, lock } = change
    if (thread.thread_metadata?.archived) {
        await discord.patch(`/channels/${thread.id}`, { archived: false })
    }
    let updated
    try {
        updated = await discord.patch(`/channels/${thread.id}`, {
            applied_tags: appliedTags,
            archived: closed,
            ...(lock ? { locked: true } : {})
        })
    } catch (error) {
        if (wasClosed) await discord.patch(`/channels/${thread.id}`, { archived: true })
        throw error
    }
    const post = summarizePost(updated, forum.tags)
    console.log(`${post.title}\n${postLabel(post)} · ${post.url}`)
}

function describeChange(forum, thread, { appliedTags, closed }) {
    const post = summarizePost({ ...thread, applied_tags: appliedTags }, forum.tags)
    console.log(`Would set ${postLabel({ ...post, closed, locked: false })} on ${post.url}`)
}

async function sendDirectMessage(discord, discordUserId, message) {
    const channel = await discord.post('/users/@me/channels', { recipient_id: discordUserId })
    await discord.post(`/channels/${channel.id}/messages`, {
        content: message.text,
        flags: SUPPRESS_EMBEDS,
        allowed_mentions: { parse: [] }
    })
}

// The site keeps the address on the user record, which tools/investigate reads; the main
// worktree's copy is run because it has the deploy config and key.
function findEmail(name) {
    const cli = path.join(mainWorktreeRoot(), 'tools/investigate/src/cli.mjs')
    let output
    try {
        output = execFileSync('node', [cli, 'find-user', name, '--json'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        })
    } catch (error) {
        throw new Error(`find-user failed: ${error.stderr?.trim() || error.message}`)
    }
    // The Reporter field holds the user id for an account without a username.
    const user = JSON.parse(output).find(
        (candidate) => candidate.username === name || candidate.id === name
    )
    if (!user?.email) throw new Error(`no email address on the user ${name}`)
    return user.email
}

const EMAIL_SETUP =
    'pnpm install --frozen-lockfile --filter @tabletop/bug-reports... && pnpm --filter @tabletop/email... build'

// The template needs the workspace installed and libs/email built, which only email needs, so it
// loads here rather than with the tool.
async function loadEmailTemplate() {
    const [{ render }, { BugReportUpdate }] = await Promise.all([
        import('@react-email/components'),
        import('@tabletop/email')
    ])
    return { render, BugReportUpdate }
}

async function renderEmail(message) {
    try {
        const { render, BugReportUpdate } = await loadEmailTemplate()
        return await render(BugReportUpdate(message))
    } catch (error) {
        throw new Error(`rendering the email failed (${error.message}); run ${EMAIL_SETUP}`)
    }
}

async function sendEmail(name, message) {
    const key = loadSecret('RESEND_API_KEY', RESEND_KEY_FILE)
    if (!key) throw new Error(`no Resend key: set RESEND_API_KEY or create ${RESEND_KEY_FILE}`)
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: EMAIL_FROM,
            to: [findEmail(name)],
            subject: message.subject,
            html: await renderEmail(message),
            text: message.text
        })
    })
    if (!response.ok) {
        throw new Error(`Resend failed with ${response.status}: ${await response.text()}`)
    }
}

async function prepareNotice(discord, thread, stage, options) {
    // A dry run sends nothing, so it is how a message that needs approval is shown first.
    checkStageInputs(stage, {
        note: options.note,
        version: options.version,
        approved: options.approved || options['dry-run']
    })
    const report = await readReport(discord, thread)
    if (!report)
        fail('The post has no bot report, so there is no reporter to tell; use --no-notify')
    const reporter = reporterFromField(report.fields.Reporter)
    if (!reporter) fail('The report has no Reporter field, so there is no reporter to tell')
    return {
        stage,
        reporter,
        message: reporterMessage(stage, report, options.note, postUrl(thread))
    }
}

async function previewNotice(thread, { stage, reporter, message }) {
    const channel = reporter.discordUserId ? 'Discord direct message, else email' : 'email'
    console.log(`\nWould tell ${reporter.name} by ${channel}\nSubject: ${message.subject}\n`)
    console.log(message.text)
    const preview = path.join(postFolder(thread.id), `${stage.replace(/ /g, '-')}-email.html`)
    mkdirSync(path.dirname(preview), { recursive: true })
    writeFileSync(preview, await renderEmail(message))
    console.log(`\nEmail preview: ${preview}`)
}

async function deliverNotice(discord, { reporter, message }) {
    const failures = []
    if (reporter.discordUserId) {
        try {
            await sendDirectMessage(discord, reporter.discordUserId, message)
            return 'Discord direct message'
        } catch (error) {
            failures.push(`Discord direct message: ${error.message}`)
        }
    }
    try {
        await sendEmail(reporter.name, message)
        return 'email'
    } catch (error) {
        failures.push(`email: ${error.message}`)
    }
    throw new Error(failures.join('\n'))
}

async function tellReporter(discord, thread, notice) {
    try {
        console.log(`Told ${notice.reporter.name} by ${await deliverNotice(discord, notice)}`)
    } catch (error) {
        fail(
            `The post is updated, but ${notice.reporter.name} was not told:\n${error.message}\nRetry with: notify ${thread.id}`
        )
    }
}

// The forum changes before the reporter hears, so a failure leaves at most an untold reporter,
// which notify fixes, and never a reporter told twice.
async function changeStatus(discord, forum, thread, status, options, { closed, lock } = {}) {
    const stage = findTag(forum.tags, status).key
    const change = {
        appliedTags: withStatus(appliedTagIds(thread), forum.tags, status),
        closed: closed ?? thread.thread_metadata?.archived ?? false,
        lock
    }
    const notify = notifiesReporter(stage) && !options['no-notify']
    if (notify && postStatus(appliedTagIds(thread), forum.tags) === stage) {
        fail(`The post is already ${stage}; to message the reporter again, use notify ${thread.id}`)
    }
    if (notify) checkForumInputs(stage, { finding: options.finding })
    else if (options.finding) fail('--no-notify sets the tag alone; post the finding with reply')
    const notice = notify ? await prepareNotice(discord, thread, stage, options) : undefined
    const record = forumRecord(stage, options)
    if (options['dry-run']) {
        if (notice) console.log(`Would post:\n${splitMessage(record).join('\n---\n')}`)
        describeChange(forum, thread, change)
        if (notice) await previewNotice(thread, notice)
        return
    }
    if (!notice) return updatePost(discord, forum, thread, change)
    await reply(discord, thread, record)
    // Replying reopens a closed post, so the post is read again for its current state.
    const current = await getPost(discord, forum, thread.id)
    await updatePost(discord, forum, current, change, thread.thread_metadata?.archived ?? false)
    await tellReporter(discord, thread, notice)
}

async function notifyAgain(discord, forum, thread, options) {
    if (options.finding) fail('notify messages the reporter alone; post a finding with reply')
    const stage = postStatus(appliedTagIds(thread), forum.tags)
    if (!notifiesReporter(stage)) fail(`The post's status (${stage ?? 'none'}) has no message`)
    const notice = await prepareNotice(discord, thread, stage, options)
    if (options['dry-run']) return previewNotice(thread, notice)
    await tellReporter(discord, thread, notice)
}

async function check(discord) {
    const bot = await discord.get('/users/@me')
    console.log(`bot      ok   ${bot.username} (${bot.id})`)
    const application = await discord.get('/applications/@me')
    console.log(
        messageContentIntent(application.flags)
            ? 'replies  ok   Message Content intent is on'
            : "replies  WARN Message Content intent is off: players' replies read as empty. Turn it on under Bot in the Discord developer portal."
    )
    const forum = await findForum(discord)
    console.log(`forum    ok   #${forum.name} (${forum.id})`)
    const dataChannel = await findDataChannel(discord)
    console.log(
        dataChannel
            ? `data     ok   #${dataChannel.name} (${dataChannel.id}); keep it staff-only`
            : `data     WARN no #${DATA_CHANNEL_NAME} channel: reports cannot be filed, and their game links and scenarios cannot be read`
    )
    const missing = STATUS_TAGS.filter((status) => !forum.tags.some((tag) => tag.key === status))
    console.log(
        missing.length === 0
            ? `tags     ok   ${forum.tags.map((tag) => tag.name).join(', ')}`
            : `tags     WARN the forum has no ${missing.join(', ')} tag; add it under Edit Channel, Tags`
    )
    console.log(
        loadSecret('RESEND_API_KEY', RESEND_KEY_FILE)
            ? 'email    ok   Resend key found'
            : `email    WARN no Resend key: reporters without Discord cannot be told. Create ${RESEND_KEY_FILE}`
    )
    const template = await loadEmailTemplate().then(
        () => null,
        (error) => error
    )
    console.log(
        template
            ? `template WARN the email template does not load (${template.message}): reporters without Discord cannot be told. Run ${EMAIL_SETUP}`
            : 'template ok   email template loads'
    )
}

function print(value, json) {
    console.log(json ? JSON.stringify(value) : JSON.stringify(value, null, 2))
}

function csv(value) {
    return value
        ? value
              .split(',')
              .map((name) => name.trim())
              .filter(Boolean)
        : []
}

async function main() {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            status: { type: 'string' },
            limit: { type: 'string' },
            out: { type: 'string' },
            message: { type: 'string' },
            'message-file': { type: 'string' },
            as: { type: 'string' },
            note: { type: 'string' },
            finding: { type: 'string' },
            version: { type: 'string' },
            add: { type: 'string' },
            remove: { type: 'string' },
            lock: { type: 'boolean' },
            approved: { type: 'boolean' },
            'no-notify': { type: 'boolean' },
            'dry-run': { type: 'boolean' },
            json: { type: 'boolean' },
            help: { type: 'boolean', short: 'h' }
        }
    })
    const [command, argument, ...rest] = positionals
    if (values.help || !command) {
        console.log(USAGE)
        return
    }
    const token = loadSecret('DISCORD_BOT_TOKEN', TOKEN_FILE)
    if (!token) {
        fail(
            `No bot token: set DISCORD_BOT_TOKEN or create ${TOKEN_FILE} (tools/bug-reports/README.md)`
        )
    }
    const discord = discordClient(token)
    if (command === 'check') return check(discord)
    const forum = await findForum(discord)
    const dryRun = values['dry-run']
    switch (command) {
        case 'list': {
            const posts = await listPosts(discord, forum, values)
            if (values.json) return print(posts, true)
            if (posts.length === 0) return console.log('No posts')
            for (const post of posts) {
                console.log(`${post.id}  ${post.openedAt.slice(0, 10)}  ${postLabel(post)}`)
                console.log(`    ${post.title}`)
            }
            return
        }
        case 'show': {
            const post = await showPost(discord, forum, argument)
            return values.json ? print(post, true) : printPost(post)
        }
        case 'download': {
            const saved = await downloadFiles(discord, forum, argument, values)
            if (values.json) return print(saved, true)
            return console.log(saved.length > 0 ? saved.join('\n') : 'No files')
        }
        case 'reply': {
            const thread = await getPost(discord, forum, argument)
            const text = messageText(values)
            if (text === undefined) fail('reply needs --message or --message-file')
            if (dryRun) return console.log(`Would post:\n${splitMessage(text).join('\n---\n')}`)
            const parts = await reply(discord, thread, text)
            return console.log(
                `Replied in ${parts} message${parts > 1 ? 's' : ''} · ${postUrl(thread)}`
            )
        }
        case 'status': {
            const thread = await getPost(discord, forum, argument)
            const status = rest.join(' ')
            if (!status) fail(`status needs one of: ${STATUS_LIST}`)
            return changeStatus(discord, forum, thread, status, values)
        }
        case 'close': {
            if (!values.as) fail(`close needs --as, one of: ${STATUS_LIST}`)
            const thread = await getPost(discord, forum, argument)
            return changeStatus(discord, forum, thread, values.as, values, {
                closed: true,
                lock: values.lock
            })
        }
        case 'notify': {
            const thread = await getPost(discord, forum, argument)
            return notifyAgain(discord, forum, thread, values)
        }
        case 'tag': {
            const thread = await getPost(discord, forum, argument)
            const change = {
                appliedTags: withTags(appliedTagIds(thread), forum.tags, {
                    add: csv(values.add),
                    remove: csv(values.remove)
                }),
                closed: thread.thread_metadata?.archived ?? false
            }
            if (dryRun) return describeChange(forum, thread, change)
            return updatePost(discord, forum, thread, change)
        }
        case 'reopen': {
            const thread = await getPost(discord, forum, argument)
            const change = {
                appliedTags: withStatus(appliedTagIds(thread), forum.tags, 'open'),
                closed: false
            }
            if (dryRun) return describeChange(forum, thread, change)
            // Only Manage Threads may touch locked, so it is sent only to unlock.
            if (thread.thread_metadata?.locked) {
                await discord.patch(`/channels/${thread.id}`, { locked: false })
            }
            return updatePost(discord, forum, thread, change)
        }
        case 'migrate':
            return migrate(discord, forum, dryRun)
        default:
            fail(`Unknown command "${command}"\n\n${USAGE}`)
    }
}

main().catch((error) => {
    console.error(error.message ?? error)
    process.exit(1)
})
