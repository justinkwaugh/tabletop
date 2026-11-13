> **Template.** Fill every `{{placeholder}}`, check each statement against your own deployment (`docs/privacy/data-inventory.md` describes what the software does), and delete these notes. Not legal advice.

_Effective {{effectiveDate}}_

{{siteName}} ({{siteUrl}}) is run by {{operator}}, based in {{country}}. In this policy, "we" means {{operator}}. Questions and requests about your data go to **{{contact}}**.

> Name an EU or UK representative here if you have appointed one (GDPR Art. 27). Leave the sentence out if you haven't.

## What we collect and why

| Data                                                                         | Why                                             | Lawful basis (GDPR)  |
| ---------------------------------------------------------------------------- | ----------------------------------------------- | -------------------- |
| Username, email address, password (stored only as a hash)                    | Your account and signing in                     | Contract             |
| Linked Google or Discord account ID                                          | Signing in with that account                    | Contract             |
| Your browser's time zone and the reminder hours you choose                   | Sending turn reminders at times that suit you   | Contract             |
| Games you play: moves, results, scores, votes, and when they happened        | Running the games                               | Contract             |
| Chat messages you send in games                                              | Game chat                                       | Contract             |
| League and tournament entries and results                                    | Running competitions                            | Contract             |
| Notification settings: Discord link, browser push subscription               | Telling you when it's your turn                 | Contract             |
| Bug reports you send, including screenshots and browser details              | Fixing problems you report, and replying to you | Legitimate interests |
| Reports you send about chat, usernames or game names, with what was reported | Reviewing them and acting on them               | Legitimate interests |
| Moderation records, such as bans, renames and removed messages               | Enforcing the terms of service                  | Legitimate interests |
| Server logs, including IP addresses                                          | Security, abuse prevention and fixing faults    | Legitimate interests |
| Counts of active players, stored as one-way hashes                           | Understanding how the site is used              | Legitimate interests |

> Add any optional features you run, such as time-difference sharing, with its basis (legitimate interests) and how to turn it off.

We don't sell your data, show advertising, or use analytics or tracking services.

## Who can see what

- **Anyone signed in** can find your username by searching, and can see listed public games and their players in the lobby, league and tournament standings, and the moves, results and chat of any game whose link they have.
- **Anyone with the link** to a public or unlisted game can see its name and its players' usernames without signing in.
- **Bug reports** go wherever your deployment sends them. The software posts the description, screenshots, username and Discord handle to a forum, and the browser details and a full copy of the game, including every player's name and account ID and hidden information, to a separate staff-only channel. Say who can read each.
- **Reports** go to {{operator}} by email. The person reported is never told who reported them.
- **{{operator}}**, as administrator, can see account details such as your email address when needed to run the site.

## Who processes it for us

| Service        | What for | Location |
| -------------- | -------- | -------- |
| {{processors}} |          |          |

> List each provider your deployment uses: hosting and database, the hosting CDN (it sees every visitor's IP address), cache, email, real-time messaging, push notification services, and sign-in providers. The Google sign-in script loads on the sign-in, re-authentication and profile pages for everyone, whether or not they use it. The BG Stats export, if a player uses it, sends every player's name, account ID, score and rank from their browser.

## How long we keep it

| Data                          | Kept                                                                                                                                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account                       | Until you delete your account. A sign-up not finished is deleted after 3 days                                                                                                                                                      |
| After you delete your account | Your username, email, password, linked accounts and settings are removed; a record of the account ID and its creation and deletion times is kept; moves and chat messages stay in their games under "Deleted player" with a number |
| Games and chat                | {{gameRetention}}                                                                                                                                                                                                                  |
| Sign-in sessions              | Each lasts 180 days; say how long expired records are kept                                                                                                                                                                         |
| Email codes and links         | Valid 15 minutes; say how long unused ones are kept                                                                                                                                                                                |
| Game invitations              | Valid 7 days; say how long they are kept                                                                                                                                                                                           |
| Server logs                   | {{logRetention}}                                                                                                                                                                                                                   |
| Backups                       | {{backupRetention}}                                                                                                                                                                                                                |

## Cookies and browser storage

We set one cookie, which keeps you signed in. We also keep copies of your own account and game list in your browser's storage so the site starts quickly, and games you play on a single device stay in that browser. None of this is used for tracking. Google's sign-in button may read or set Google's own cookies on the pages where it appears.

## Emails

We only send emails about your account and about games and competitions you take part in. We don't send marketing.

## Your rights

You can ask us to:

- give you a copy of your data, including in a portable format;
- correct it;
- delete your account (you can also do this yourself from your profile page);
- restrict how we use it;
- stop using it for anything we do on the basis of legitimate interests.

Write to **{{contact}}**. We'll reply within a month. If you're in the EU or UK, you can also complain to your data protection authority.

## Children

You must be {{minimumAge}} or older to use {{siteName}}. If we learn that an account belongs to someone younger, we delete it.

## Do Not Track

{{siteName}} doesn't track you across sites, so it doesn't respond differently to browser Do Not Track signals.

## Changes

We'll post any change here with a new effective date.
