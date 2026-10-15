// What the reporter reads at each milestone. The copy is friendly: a note from the site they
// play on, not a ticket system.

export const DISCORD_INVITE = 'https://discord.gg/5ggK5VGGvA'

const EXCERPT_LENGTH = 160

const BUG_REPORT = {
    eyebrow: 'Your bug report',
    footer: 'You reported this bug on BoardTogether.'
}

const STAGES = {
    investigating: {
        ...BUG_REPORT,
        label: 'Investigating',
        subject: "Thanks for the bug report! We're on it",
        heading: "We're on it!",
        lead: "Thanks for letting us know about this one. We're digging into it now, and we'll tell you what we find."
    },
    reproduced: {
        ...BUG_REPORT,
        label: 'Reproduced',
        subject: 'We found the bug you reported',
        heading: 'Found it!',
        lead: "Good news: we can make the bug you hit happen on our end too, so we know what's going on and a fix is on the way.",
        closing: 'Thanks for bearing with us!'
    },
    fixed: {
        ...BUG_REPORT,
        label: 'Fixed',
        subject: 'Fixed! The bug you reported is gone',
        heading: 'All fixed!',
        // The version goes into the forum's record; players hear "the latest update".
        needs: 'version',
        lead: "The bug you found is squashed in our latest update. Reload the game and you're all set.",
        closing: 'Thanks for helping make BoardTogether better!'
    },
    'wont fix': {
        ...BUG_REPORT,
        label: "Won't fix",
        subject: 'About the bug you reported',
        heading: 'We took a look',
        needs: 'note',
        lead: "We dug into what you reported, and here's what we found.",
        closing: 'Thanks for taking the time to tell us!'
    },
    // The player expected something else, so the message disagrees with them: it calls the
    // report a report rather than a bug, and goes out only once the user has read it.
    'not a bug': {
        eyebrow: 'Your report',
        footer: 'You sent us this report on BoardTogether.',
        label: 'Not a bug',
        subject: 'About the issue you reported',
        heading: "Here's what's going on",
        needs: 'note',
        review: true,
        lead: 'Thanks for telling us about this. We can see why it seemed off, so we took a close look.',
        closing:
            "If something still doesn't seem right, send us another report from the game and we'll happily take another look."
    }
}

export function notifiesReporter(status) {
    return status in STAGES
}

export function checkStageInputs(status, { note, version, approved }) {
    const stage = STAGES[status]
    if (stage?.needs === 'version' && !version) throw new Error(`${status} needs --version`)
    if (stage?.needs === 'note' && !note) throw new Error(`${status} needs --note explaining why`)
    if (stage?.review && !approved) {
        throw new Error(
            `${status} disagrees with the reporter, so the user reads it first: run with --dry-run, show the user the message, then rerun with --approved`
        )
    }
}

function excerpt(text) {
    const line = (text ?? '').trim().split('\n', 1)[0]
    return line.length > EXCERPT_LENGTH ? `${line.slice(0, EXCERPT_LENGTH - 1)}…` : line
}

// Most reporters are not in the Discord server, and Discord shows a post only to members, so
// the invite travels with the post link.
export function reporterMessage(status, report, note, postUrl) {
    const stage = STAGES[status]
    const message = {
        subject: stage.subject,
        eyebrow: stage.eyebrow,
        heading: stage.heading,
        game: `${report.fields.Game} · ${report.game}`,
        lead: stage.lead,
        note,
        closing: stage.closing,
        quote: excerpt(report.description),
        gameUrl: report.gameUrl,
        postUrl,
        inviteUrl: DISCORD_INVITE,
        footer: stage.footer
    }
    const text = [
        message.heading,
        [message.lead, note, message.closing].filter(Boolean).join(' '),
        `You wrote: "${message.quote}"`,
        `Your game (${message.game}): ${message.gameUrl}`,
        `Your report on our Discord: ${postUrl} (not on the BoardTogether server yet? Join here: ${DISCORD_INVITE})`
    ].join('\n\n')
    return { ...message, text }
}

// The post is public, so its record names the status alone; the note is for the reporter.
export function forumStatusLine(status, version) {
    return `**${STAGES[status].label}${version ? ` in ${version}` : ''}.**`
}
