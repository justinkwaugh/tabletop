// Discord caps a message at 2000 characters.
export const MESSAGE_LIMIT = 2000

// A post carries one status tag at a time; any other tag (UI, logic) labels the area and is kept.
export const STATUS_TAGS = ['open', 'investigating', 'reproduced', 'fixed', 'wont fix', 'not a bug']
export const STATUS_LIST = STATUS_TAGS.join(', ')

// A post a player opened by hand may have no status tag yet, and still needs an answer.
const UNRESOLVED = new Set(['open', 'investigating', 'reproduced', undefined])

// Discord message types that carry a player's text: a plain message and a Reply.
const TEXT_MESSAGE_TYPES = new Set([0, 19])

// Names typed on the command line ("Won't-Fix") and the forum's ("wont fix") meet as one key.
export function tagKey(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[-_\s]+/g, ' ')
}

export function keyedTags(availableTags) {
    return availableTags.map((tag) => ({ id: tag.id, name: tag.name, key: tagKey(tag.name) }))
}

export function findTag(tags, name) {
    const key = tagKey(name)
    const tag = tags.find((candidate) => candidate.key === key)
    if (!tag) {
        const names = tags.map((candidate) => candidate.name).join(', ')
        throw new Error(`The forum has no tag "${name}". Tags: ${names}`)
    }
    return tag
}

export function isStatusTag(tag) {
    return STATUS_TAGS.includes(tag.key)
}

export function appliedTagIds(thread) {
    return thread.applied_tags ?? []
}

export function postStatus(appliedIds, tags) {
    return tags.find((tag) => appliedIds.includes(tag.id) && isStatusTag(tag))?.key
}

// `unresolved` and `all` are filters over the status tags rather than tags themselves.
export function matchesStatus(status, filter) {
    if (filter === 'all') return true
    if (filter === 'unresolved') return UNRESOLVED.has(status)
    return status === tagKey(filter)
}

export function withStatus(appliedIds, tags, status) {
    const statusTag = findTag(tags, status)
    if (!isStatusTag(statusTag)) {
        throw new Error(`"${statusTag.name}" is not a status tag (${STATUS_LIST})`)
    }
    const statusIds = new Set(tags.filter(isStatusTag).map((tag) => tag.id))
    return [...appliedIds.filter((id) => !statusIds.has(id)), statusTag.id]
}

export function withTags(appliedIds, tags, { add = [], remove = [] }) {
    const removeIds = new Set(remove.map((name) => findTag(tags, name).id))
    const addIds = add.map((name) => findTag(tags, name).id)
    const ids = appliedIds.filter((id) => !removeIds.has(id))
    for (const id of addIds) if (!ids.includes(id)) ids.push(id)
    return ids
}

export function summarizePost(thread, tags) {
    const appliedIds = appliedTagIds(thread)
    return {
        id: thread.id,
        title: thread.name,
        status: postStatus(appliedIds, tags),
        tags: appliedIds.map((id) => tags.find((tag) => tag.id === id)?.name ?? id),
        openedAt: thread.thread_metadata?.create_timestamp,
        closed: thread.thread_metadata?.archived ?? false,
        locked: thread.thread_metadata?.locked ?? false,
        messages: thread.message_count ?? 0,
        url: postUrl(thread)
    }
}

export function postLabel(post) {
    const closed = post.closed ? ` · closed${post.locked ? ', locked' : ''}` : ''
    return `[${post.tags.join(', ')}]${closed}`
}

export function postUrl(thread) {
    return `https://discord.com/channels/${thread.guild_id}/${thread.id}`
}

// A link is /channels/<server>/<post>, or /channels/<server>/<post>/<message> for a message link.
export function postIdFromArgument(argument) {
    const link = argument.match(/\/channels\/\d+\/(\d+)/)
    if (link) return link[1]
    return /^\d{15,}$/.test(argument.trim()) ? argument.trim() : undefined
}

export function newestFirst(a, b) {
    return BigInt(a.id) < BigInt(b.id) ? 1 : -1
}

export function reportFromMessage(message) {
    const embed = message.embeds?.[0]
    if (!embed) return undefined
    return {
        game: embed.title,
        gameUrl: embed.url,
        description: embed.description,
        fields: Object.fromEntries((embed.fields ?? []).map((field) => [field.name, field.value])),
        reportedAt: embed.timestamp
    }
}

// The backend's reporterLabel (bugReportPost.ts) writes `name` or `name (<@discordUserId>)`,
// where name is the username, or the user id for an account without one.
export function reporterFromField(value) {
    const match = value?.match(/^(.*?)(?: \(<@(\d+)>\))?$/)
    if (!match?.[1]) return undefined
    return { name: match[1], ...(match[2] ? { discordUserId: match[2] } : {}) }
}

export function summarizeMessage(message) {
    const files = (message.attachments ?? []).map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.content_type,
        size: attachment.size,
        url: attachment.url
    }))
    // Without the Message Content intent Discord blanks other users' text, embeds and files.
    const hidden =
        !message.author?.bot &&
        !message.content &&
        (message.embeds ?? []).length === 0 &&
        files.length === 0 &&
        TEXT_MESSAGE_TYPES.has(message.type)
    return {
        id: message.id,
        author: message.author?.global_name ?? message.author?.username,
        authorId: message.author?.id,
        bot: Boolean(message.author?.bot),
        sentAt: message.timestamp,
        content: message.content,
        files,
        ...(hidden ? { hidden: true } : {})
    }
}

export function splitMessage(text, limit = MESSAGE_LIMIT) {
    const parts = []
    let rest = text.trim()
    while (rest.length > limit) {
        const window = rest.slice(0, limit + 1)
        // A cut in the first half would leave a stub part, so the next finer boundary wins.
        const cut = [
            window.lastIndexOf('\n\n'),
            window.lastIndexOf('\n'),
            window.lastIndexOf(' ')
        ].find((index) => index > limit / 2)
        const end = cut ?? limit
        parts.push(rest.slice(0, end).trimEnd())
        rest = rest.slice(end).trimStart()
    }
    if (rest) parts.push(rest)
    return parts
}

// Pasted screenshots all arrive as image.png, so later files get a numbered name.
export function uniqueFilename(name, used) {
    const safe = name.replace(/[^\w.-]+/g, '_')
    const dot = safe.lastIndexOf('.')
    const base = dot > 0 ? safe.slice(0, dot) : safe
    const ext = dot > 0 ? safe.slice(dot) : ''
    let candidate = safe
    for (let n = 2; used.has(candidate); n++) candidate = `${base}-${n}${ext}`
    used.add(candidate)
    return candidate
}

export function parseLimit(text, fallback) {
    if (text === undefined) return fallback
    const value = Number(text)
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`--limit must be a positive whole number, not "${text}"`)
    }
    return value
}

export function messageContentIntent(applicationFlags) {
    const GATEWAY_MESSAGE_CONTENT = 1 << 18
    const GATEWAY_MESSAGE_CONTENT_LIMITED = 1 << 19
    return (applicationFlags & (GATEWAY_MESSAGE_CONTENT | GATEWAY_MESSAGE_CONTENT_LIMITED)) !== 0
}
