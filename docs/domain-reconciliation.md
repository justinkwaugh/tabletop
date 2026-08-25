# Domain Reconciliation Record

This record tracks places where the implementation and the agreed domain model diverge, along with unresolved decisions and concerns that investigation disproved. It is separate from each `CONTEXT.md` because context documents define domain language rather than implementation work.

## Classifications

- **Defect**: implementation behavior violates an agreed domain invariant.
- **Latent defect**: the violation exists but current supported data or configuration does not exercise it.
- **Model contradiction**: implementation structure or terminology represents the domain inaccurately without necessarily causing incorrect behavior.
- **Planned change**: agreed behavior or capability is not implemented yet.
- **Open decision or risk**: evidence identifies a concern, but the intended policy has not been agreed.
- **Aligned**: investigation showed that the implementation already follows the agreed model.

Unless stated otherwise, every open item below is documented but not implemented.

## Game Runtime

### Supplied Action index zero bypasses stale-index handling

- **Classification**: Defect
- **Observed**: Truthiness checks treat Action index `0` as absent. A stale Action based at index zero can therefore bypass the usual offset calculation and non-simultaneous rejection. Hosted missing-Action handling repeats the same check for `initialIndex`.
- **Evidence**: `libs/common/src/game/engine/gameEngine.ts:107`; `libs/backend-services/src/games/gameService.ts:793`
- **Invariant**: Every supplied Action index is checked, including zero. Acceptance from a stale base is limited to members of a Simultaneous Action Group.

### Action Reversal and Undo policy are correctly separated

- **Classification**: Aligned
- **Observed**: `GameEngine.undoAction` mechanically applies an undo patch. Candidate selection and authorization are performed by the Game Client and Game Lifecycle layers.
- **Evidence**: `libs/common/src/game/engine/gameEngine.ts:175`; `libs/frontend-components/src/lib/model/gameSession.svelte.ts:182`; `libs/backend-services/src/games/gameService.ts:914`
- **Invariant**: Game Runtime owns Action Reversal; Game Client selects an Undo Candidate; Game Lifecycle authorizes Hosted Undo.

## Game Client

### History is represented as a peer mode

- **Classification**: Model contradiction
- **Observed**: The mode enum declares Play, Explore, and History as peers, while actual behavior separately tracks History and permits it to overlay Exploration.
- **Evidence**: `libs/frontend-components/src/lib/model/gameSession.svelte.ts:54`; `libs/frontend-components/src/lib/components/ExplorationPanel.svelte:128`
- **Invariant**: Primary and Exploration are Game Context choices; Live and History are orthogonal views.

### History View can reach mutation APIs

- **Classification**: Defect
- **Observed**: `isPlayable` remains true in History View, and `applyAction` can mutate the current modifiable context. Undo has a separate History guard, but ordinary Action application does not.
- **Evidence**: `libs/frontend-components/src/lib/model/gameSession.svelte.ts:120`; `libs/frontend-components/src/lib/model/gameSession.svelte.ts:663`; `libs/frontend-components/src/lib/model/gameSession.svelte.ts:807`
- **Invariant**: No Game Context is modifiable during History View.

### Acting Player defaults to the first active Player

- **Classification**: Defect
- **Observed**: Hotseat and Exploration choose `activePlayers.at(0)`, and the Hotseat panel offers no chooser.
- **Evidence**: `libs/frontend-components/src/lib/model/gameSession.svelte.ts:266`; `libs/frontend-components/src/lib/components/HotseatPanel.svelte:4`
- **Invariant**: When multiple Players are active in Hotseat or Exploration, the person chooses the Acting Player. Admin mode may choose any Player.

### Exploration Actions use Primary Game identity and configuration

- **Classification**: Defect
- **Observed**: Partial Player Actions always receive the Primary Game ID, and Action validation always receives the Primary Game even when Exploration is active.
- **Evidence**: `libs/frontend-components/src/lib/model/gameSession.svelte.ts:327`; `libs/frontend-components/src/lib/model/gameSession.svelte.ts:643`; `libs/frontend-components/src/lib/model/gameExplorations.svelte.ts:144`
- **Invariant**: Action creation and validation use the Active, Modifiable Game Context.

### Forward History Step omits the following System cascade

- **Classification**: Defect
- **Observed**: Forward navigation stops after applying a User Action instead of including the System Actions it triggers. Backward navigation groups the cascade differently.
- **Evidence**: `libs/frontend-components/src/lib/model/gameHistory.svelte.ts:283`; `libs/frontend-components/src/lib/model/gameHistory.svelte.ts:338`; `libs/frontend-components/src/lib/model/gameSession.svelte.ts:957`
- **Invariant**: A History Step can move backward or forward across one User Action and its generated System Action cascade.

### Exploration repairs a missing cascade by reversing and reapplying

- **Classification**: Model contradiction; replacement design deferred
- **Observed**: A new Exploration clones history, then unconditionally reverses and reapplies the final Action to regenerate omitted follow-up Actions.
- **Evidence**: `libs/frontend-components/src/lib/model/gameExplorations.svelte.ts:186`
- **Invariant**: A Game Context cloned at a selected history position is coherent and contains every Processed Action for that position.

### History uses a stable metadata snapshot

- **Classification**: Aligned
- **Observed**: History deep-freezes its Game, Game State, and Actions; live metadata updates become visible after leaving History View.
- **Evidence**: `libs/frontend-components/src/lib/model/gameContext.svelte.ts:52`; `libs/frontend-components/src/lib/model/gameHistory.svelte.ts:589`; `libs/frontend-components/src/lib/model/gameSession.svelte.ts:1067`
- **Invariant**: History View is a stable snapshot; leaving it returns to the updated live Game Context.

### Some title UIs read removed `game.state`

- **Classification**: Defect
- **Observed**: The session removes `game.state`, while older title components still read active Players from that property, making the value absent in a session.
- **Evidence**: `libs/frontend-components/src/lib/model/gameSession.svelte.ts:407`; `games/bus-ui/src/lib/components/PlayerState.svelte:14`; `games/bridges-of-shangri-la-ui/src/lib/components/PlayerState.svelte:10`; `games/estates-ui/src/lib/components/PlayerInfo.svelte:13`
- **Invariant**: Title UI reads Displayed Game State through `gameSession.gameState`; Game metadata is not Game State.

## Game Lifecycle

### Persistence owns readiness derivation

- **Classification**: Model contradiction; planned change
- **Observed**: The Firestore adapter changes WaitingForPlayers and WaitingToStart based on Player status. Creation does not run the same derivation.
- **Evidence**: `libs/backend-services/src/persistence/firestore/gameStore.ts:228`; `libs/backend-services/src/persistence/firestore/gameStore.ts:54`; `libs/backend-services/src/games/gameService.ts:695`
- **Invariant**: Game Lifecycle derives Ready when every configured Player is Joined, independently of persistence. This invariant belongs in `GameService`.

### Already-ready creation remains Recruiting

- **Classification**: Latent defect; planned with readiness ownership change
- **Observed**: A newly created Game whose configured Players are already Joined remains WaitingForPlayers. The current Game Title catalog has minimum Player counts of at least two and duplicate Users are forbidden, so the known one-owner case is not presently reachable through supported titles.
- **Evidence**: `libs/backend-services/src/games/gameService.ts:125`; `libs/backend-services/src/games/gameService.ts:1134`; `games/*/src/definition/info.ts`
- **Invariant**: Creation immediately produces Ready when every configured Player is Joined.

### Configuration edits omit Game Title validation

- **Classification**: Defect
- **Observed**: Initialization validates nonempty configuration through the title configurator, but generic Game updates accept configuration without that validation.
- **Evidence**: `libs/common/src/game/definition/gameInitializer.ts:25`; `apps/backend/src/app/routes/api/game/update.ts:5`; `libs/backend-services/src/games/gameService.ts:416`
- **Invariant**: Game Configuration is validated by its Game Title, editable during Recruiting and Ready, and frozen after start.

### Fork accepts a position beyond Action History

- **Classification**: Defect
- **Observed**: The route permits any index at least `-1`; an index beyond the final Action silently creates a full-history Fork through `slice`.
- **Evidence**: `apps/backend/src/app/routes/titleSpecific/fork.ts:5`; `libs/backend-services/src/games/gameService.ts:249`
- **Invariant**: A Fork derives from an explicitly selected valid position in Canonical Action History. Position `-1` denotes the pre-Action starting state.

### Archived and Deleted schema conflicts with permanent deletion

- **Classification**: Model contradiction; planned schema cleanup
- **Observed**: The model declares Archived and Deleted statuses and deletion fields, while implemented deletion permanently removes the Game, Game State, and Actions. No archive behavior was found.
- **Evidence**: `libs/common/src/game/model/game.ts:8`; `libs/common/src/game/model/game.ts:54`; `libs/backend-services/src/games/gameService.ts:155`; `libs/backend-services/src/persistence/firestore/gameStore.ts:91`
- **Invariant**: Delete permanently removes a Game Instance and its data. Archive and soft deletion are not current domain concepts.

### Runtime version association is unresolved

- **Classification**: Open cross-context decision; owned by Game Distribution
- **Observed**: A Game Instance stores a Game Title type ID but no runtime version. Title-specific routes inject the current Game Definition, and the service does not verify that its ID matches the instance.
- **Evidence**: `libs/common/src/game/model/game.ts:55`; `apps/backend/src/app/routes/titleSpecific/action.ts:6`; `libs/backend-services/src/games/gameService.ts:756`
- **Invariant**: A Game Instance is permanently associated with one Game Title. Whether it pins a runtime version remains undecided.

### Invite-Only viewing and Fork entitlement remain policy questions

- **Classification**: Open cross-context decision
- **Observed**: Get and synchronization routes require an Active User but not participation; Fork requires an authenticated User and a known Game ID.
- **Evidence**: `apps/backend/src/app/routes/api/game/get.ts:9`; `apps/backend/src/app/routes/api/game/checkSync.ts:14`; `apps/backend/src/app/routes/titleSpecific/fork.ts:12`
- **Invariant**: Invite-Only restricts discovery and participation, not confidentiality. The exact direct-link viewing and Fork entitlement policy remains to be documented.

## Identity and Access

### Persistence recomputes status and can reactivate Accounts

- **Classification**: Defect and model contradiction; planned service-owned transitions
- **Observed**: Every User store update writes Active when username, email, and email verification are present, otherwise Incomplete. An ordinary update can therefore reactivate an Inactive or Deleted User Account.
- **Evidence**: `libs/backend-services/src/persistence/firestore/userStore.ts:343`; `libs/backend-services/src/users/userService.ts:124`
- **Invariant**: User Account status is one mutually exclusive lifecycle: Incomplete may become Active when completion requirements are met; only an administrator may move Active to Inactive or reactivate Inactive; authorized deletion is terminal. Persistence never invents transitions.

### Username discovery ignores Account status

- **Classification**: Defect
- **Observed**: Username search reads reservation records and returns fuzzy matches without loading or filtering User Account status. Startup loads lowercase reservation IDs, while creation and rename push display-cased names and removal uses display spelling. Results can therefore change after restart or retain stale casing entries.
- **Evidence**: `libs/backend-services/src/users/userService.ts:107`; `libs/backend-services/src/users/userService.ts:208`; `libs/backend-services/src/users/userService.ts:381`; `libs/backend-services/src/persistence/firestore/userStore.ts:117`; `apps/backend/src/app/routes/api/user/usernameSearch.ts:12`
- **Invariant**: Only Active User Accounts are discoverable, searchable, and selectable for invitations.

### Username validation is defined accidentally by persistence

- **Classification**: Model contradiction; planned validation cleanup
- **Observed**: Username is both the password-login name and public handle, and it is copied into hosted Games as the Player display name. Display spelling is retained while uniqueness and authentication use a trimmed lowercase form. The application defines no meaningful syntax policy; effective exclusions arise incidentally from using the normalized value as a Firestore document ID.
- **Evidence**: `libs/backend-services/src/persistence/firestore/userStore.ts:42`; `libs/backend-services/src/persistence/firestore/userStore.ts:103`; `libs/backend-services/src/persistence/firestore/userStore.ts:500`; `libs/backend-services/src/games/gameService.ts:585`
- **Invariant**: Username is the Account's login name and public handle. It is nonempty after trimming, case-insensitively unique, preserves chosen casing for display, and excludes control characters. No arbitrary minimum or maximum length is currently a domain rule. Incomplete and Active Accounts may rename through an ordinary Authenticated Session; Inactive and Deleted Accounts may not. A released Username is immediately reusable, while historical Games retain their copied Player name and stable Account association.

### Public and private Account data are not explicitly separated

- **Classification**: Model contradiction; planned projection boundary
- **Observed**: One shared User model mixes public identity, private email and authentication summary, lifecycle status, roles, legacy deletion fields, and cross-context preferences.
- **Evidence**: `libs/common/src/site/user.ts:33`; `libs/backend-services/src/persistence/firestore/userStore.ts:504`
- **Invariant**: A Public User Profile contains only stable Account ID and Username and exists only for an Active Account. Email, Authentication Methods, roles, preferences, and lifecycle details remain private. Historical attribution does not make a non-Active Account discoverable.

### Login and existing sessions do not enforce status policy

- **Classification**: Defect; planned authorization change
- **Observed**: Password, provider, and token logins establish sessions without a complete status gate. General user verification accepts every status; only selected routes require an Active User.
- **Evidence**: `apps/backend/src/app/routes/api/auth/login.ts:18`; `apps/backend/src/app/routes/api/auth/google/login.ts:41`; `apps/backend/src/app/routes/api/auth/token/login.ts:20`; `apps/backend/src/app/plugins/authorization.ts:21`; `apps/frontend/src/lib/model/authorizationService.svelte.ts:122`
- **Invariant**: Incomplete permits only onboarding, verification, recovery, and logout; Active permits normal use; Inactive permits identity proof for recovery or support but cannot establish or continue a normal session; Deleted permits no authentication. Existing sessions cease granting access immediately for Inactive and Deleted Accounts.

### Recent Authentication is not consistently enforced

- **Classification**: Defect; planned capability
- **Observed**: Sessions store an `authTimestamp`, but it is not read. External identity linking and unlinking require only an ordinary session; other sensitive operations apply inconsistent proofs.
- **Evidence**: `apps/backend/src/app/lib/session.ts:3`; `libs/backend-services/src/users/userService.ts:132`; `apps/backend/src/app/routes/api/auth/google/link.ts:13`; `apps/backend/src/app/routes/api/user/unlinkExternalAccount.ts:12`
- **Invariant**: Recent Authentication is required for email or password changes, linking or unlinking an External Identity, deleting an Account, and administrative status or role changes. Preferences and username changes require only an Authenticated Session.

### Email change immediately replaces the verified address

- **Classification**: Defect; planned pending-address flow
- **Observed**: Email change immediately releases the old uniqueness reservation, reserves and installs the new address, clears verification, and causes persistence to recompute an Active Account as Incomplete. Verification is sent only after the transaction commits. Provider links remain unchanged, and existing sessions are not explicitly invalidated. Adding a first email requires no proof; changing an existing email uses inconsistent password-or-token proof rather than the agreed Recent Authentication policy.
- **Evidence**: `apps/backend/src/app/routes/api/user/update.ts:5`; `libs/backend-services/src/users/userService.ts:139`; `libs/backend-services/src/users/userService.ts:189`; `libs/backend-services/src/persistence/firestore/userStore.ts:295`; `libs/backend-services/src/persistence/firestore/userStore.ts:343`
- **Invariant**: Adding the first Email Address or changing a Verified Email Address requires Recent Authentication. A change reserves the proposed address as a Pending Email Address while the existing verified address remains active and reserved and the Account remains Active. Successful verification atomically promotes the pending address and releases the old one; the old address is notified when the change is requested and completed. The current recently authenticated session remains while other sessions are invalidated on completion. An Incomplete Account without a Verified Email Address may retain its submitted unverified address as part of onboarding.

### Authentication challenges lack their intended guarantees

- **Classification**: Security defects and planned redesign
- **Observed**: One Authentication token type is shared by password reset and sensitive profile proof. Token login converts either purpose into a full seven-day session without consuming the token; the password-reset UI intentionally performs token login before setting the password. Issuing another token does not invalidate earlier tokens because the store cannot query by Account or purpose. Protected mutations and token deletion are separate operations, so consumption is not atomic; password reset explicitly ignores deletion failure. The service returns only the token string, leaving the UI unable to display the actual expiry.
- **Evidence**: `libs/backend-services/src/tokens/tokenService.ts:7`; `libs/backend-services/src/tokens/tokenService.ts:19`; `libs/backend-services/src/tokens/tokenData.ts:9`; `libs/backend-services/src/persistence/stores/tokenStore.ts:3`; `libs/backend-services/src/users/userService.ts:340`; `apps/backend/src/app/routes/api/auth/token/login.ts:20`; `apps/backend/src/app/routes/api/user/setPassword.ts:46`; `apps/frontend/src/routes/(app)/(public)/email/passwordReset/[token]/+page.ts:5`
- **Invariant**: Email Verification, Set Password, and Sensitive Change use distinct, purpose-bound, single-use challenges with 15-minute lifetimes. A Set Password Challenge authorizes only the Set Password operation rather than granting an ordinary Authenticated Session. Issuing a replacement invalidates earlier unused challenges for the same Account and purpose; consumption is atomic with the protected operation; and the service supplies the authoritative expiration to each interface.

### External unlink can remove the final Authentication Method

- **Classification**: Defect
- **Observed**: Any Authenticated Session may remove a supplied External Identity; the service neither requires Recent Authentication nor ensures another External Identity or Password Credential remains. It also fails to verify that the requested External Identity belongs to the current Account before deleting the global uniqueness reservation, allowing one Account to release another Account's provider identity.
- **Evidence**: `apps/backend/src/app/routes/api/user/unlinkExternalAccount.ts:4`; `libs/backend-services/src/users/userService.ts:230`; `libs/backend-services/src/persistence/firestore/userStore.ts:443`
- **Invariant**: Unlinking requires Recent Authentication, and a User Account must retain at least one Authentication Method: a Password Credential or linked External Identity.

### Set Password can create a first Password Credential

- **Classification**: Intended credential behavior with status and session defects
- **Observed**: The public reset request returns the same success response for a missing email, but issues a challenge for any matching Account regardless of status or whether it already has a Password Credential. Completing the flow writes a password even for a provider-only Account. Deleted Accounts can receive a challenge, and the generic token-login step establishes an ordinary session without applying Account-status policy.
- **Evidence**: `apps/backend/src/app/routes/api/user/email/sendPasswordReset.ts:4`; `libs/backend-services/src/users/userService.ts:241`; `libs/backend-services/src/users/userService.ts:340`; `apps/backend/src/app/routes/api/auth/token/login.ts:20`; `apps/backend/src/app/routes/api/user/setPassword.ts:18`
- **Invariant**: Set Password establishes a new Password Credential and replaces any existing one. An Incomplete or Active Account with an email may use a Set Password Challenge, including an Account that previously used only Google or Discord. Inactive and Deleted Accounts are forbidden. The public request response does not reveal Account existence or eligibility. Completion creates no ordinary Authenticated Session, changes neither status nor Email Verification, and invalidates existing sessions. Avoid the domain term Password Recovery because no password is recovered.

### Logged-out provider sign-in can link an Account by matching email

- **Classification**: Intended linking behavior with a status-enforcement defect
- **Observed**: When a Google or Discord identity is unknown, logged-out sign-in searches for an existing Account with the provider-supplied email. If the provider and Account both mark that email verified, the External Identity is attached and a session is immediately established. The lookup and session creation have no Account-status restriction. If either verification flag is absent, the code instead attempts to create an Account with the already-reserved email and fails uniqueness enforcement.
- **Evidence**: `libs/backend-services/src/users/userService.ts:250`; `libs/backend-services/src/persistence/firestore/userStore.ts:54`; `apps/backend/src/app/routes/api/auth/google/login.ts:41`; `apps/backend/src/app/routes/api/auth/discord/login.ts:73`
- **Invariant**: A provider explicitly trusted to validate email ownership may authorize linking its External Identity to an Account whose identical email is already verified. Google and Discord are currently trusted for this purpose; every additional provider requires an explicit trust decision. Active Accounts may link and receive a normal session. Incomplete Accounts may link but receive only restricted onboarding access; the trusted assertion may satisfy email verification. Inactive Accounts may use provider authentication only for recovery or support identity proof and do not receive a new link or normal session. Deleted Accounts neither link nor authenticate. Already-linked identities obey the same status restrictions.

### Email verification validity text disagrees with the service

- **Classification**: Defect
- **Observed**: The service gives the verification challenge a 15-minute lifetime, while onboarding tells the User it lasts 30 minutes.
- **Evidence**: `libs/backend-services/src/users/userService.ts:320`; `apps/frontend/src/routes/(app)/(onboarding)/onboarding/+page.svelte:104`
- **Invariant**: User-facing validity information matches the actual challenge lifetime.

### A live verification credential is logged

- **Classification**: Security defect
- **Observed**: The service prints the generated Email Verification token after dispatch.
- **Evidence**: `libs/backend-services/src/users/userService.ts:327`
- **Invariant**: Authentication and verification credentials are secret and are never logged.

### Game-topic transport lacks an entitlement check

- **Classification**: Open cross-context authorization risk
- **Observed**: Any Active User can obtain a generic server-sent-events token, and the Game stream accepts an arbitrary Game ID without consulting Game Lifecycle for entitlement. The Ably token has an identity but no visible topic capability restriction.
- **Evidence**: `apps/backend/src/app/routes/api/sse/token.ts:4`; `apps/backend/src/app/routes/api/sse/game.ts:16`; `libs/backend-services/src/ably/ablyService.ts:16`
- **Open question**: Identity proves the User Account; Game Lifecycle and Notification Delivery still need an agreed topic-entitlement policy.

### Account and role administration are absent

- **Classification**: Planned change
- **Observed**: The enum and deletion fields exist, but no administrative disable, reactivation, deletion, status-management, or role-management service was found.
- **Evidence**: `libs/common/src/site/user.ts:12`; `libs/common/src/site/user.ts:33`
- **Invariant**: Authorized administrative operations own Active-to-Inactive, Inactive-to-Active, and nondeleted-to-Deleted transitions; Deleted is terminal. Only an Active Administrator using Recent Authentication may grant or revoke roles. Changes take effect immediately, at least one Active Administrator must remain, and ordinary role management cannot change the acting Administrator's own Admin grant. Role changes are auditable.

### Production has no initial Administrator bootstrap

- **Classification**: Deferred capability
- **Observed**: In local mode, the first User created in an empty store receives Admin in addition to User. Production signup and external-provider creation grant only User, and no role-management or bootstrap operation exists in the repository.
- **Evidence**: `libs/backend-services/src/persistence/firestore/userStore.ts:181`; `apps/backend/src/app/routes/api/user/create.ts:32`; `libs/backend-services/src/users/userService.ts:277`
- **Invariant**: Production never grants Admin merely because an Account is the first to sign up. No production bootstrap mechanism is currently defined or implemented; it requires a separate explicit design. The local first-User behavior remains a development convenience.

### Account deletion and anonymization are absent

- **Classification**: Planned change
- **Observed**: No service writes Deleted status, performs Account deletion or anonymization, revokes credentials, or releases identifiers. A record manually marked Deleted would retain username, email, password hash, External Identities, roles, preferences, uniqueness reservations, sessions, and challenges.
- **Evidence**: `libs/common/src/site/user.ts:12`; `libs/backend-services/src/persistence/firestore/userStore.ts:593`; `apps/backend/src/app/routes/api/user/update.ts:5`
- **Invariant**: Terminal deletion retains an anonymized tombstone with its immutable Account ID for historical attribution. It removes username, email, Password Credential, External Identities, roles, preferences, sessions, challenges, discoverability, and authentication capability. Released identifiers may be reused after deletion is finalized; Account IDs are never reused. Downstream contexts present a neutral deleted-user identity.

### Current roles mix baseline access and context entitlements

- **Classification**: Model contradiction; planned change
- **Observed**: Roles are a flat array checked by exact membership. Most ordinary routes require `User`, so an Active Account or an Admin without `User` lacks ordinary access. `BetaTester` is consumed only by frontend Game Title visibility checks, while `Developer` has no runtime consumers.
- **Evidence**: `libs/common/src/site/user.ts:5`; `apps/backend/src/app/plugins/authorization.ts:57`; `apps/backend/src/app/routes/titleSpecific/create.ts`; `apps/frontend/src/lib/services/libraryService.svelte.ts:18`; `libs/backend-services/src/persistence/firestore/userStore.ts:181`
- **Invariant**: Account status and Role Assignments are independent. Active grants ordinary use, making a separate User role unnecessary. Admin adds administrative authority. Developer and BetaTester are Game Distribution entitlements rather than general administrative authority. Identity and Access owns assignment; consuming contexts define what each grant permits.

### Identity model contains phantom provider and contact vocabulary

- **Classification**: Model contradiction; planned cleanup
- **Observed**: The provider enum includes Apple, but only Google and Discord have authentication routes; Apple has an unused UI scaffold. The User model also exposes `sms`, which has no consumers or defined behavior.
- **Evidence**: `libs/common/src/site/user.ts:19`; `apps/frontend/src/lib/components/AppleSignIn.svelte:1`; `libs/common/src/site/user.ts:42`
- **Invariant**: Google and Discord are the currently supported external providers. Apple is deferred until designed and implemented. `sms` is not an Identity and Access concept and should be removed from the intended model. Developer remains a Game Distribution entitlement rather than an authentication provider or general administrative role.

### Preferences combine concepts owned by other contexts

- **Classification**: Model contradiction; planned boundary change
- **Observed**: One Account preferences object contains browser-notification prompting, Game Client color preference, and Game Client accessibility palette. It is replaced as a whole. The client redundantly submits `userId`, which Fastify strips before the authenticated route uses the session identity.
- **Evidence**: `libs/common/src/site/user.ts:25`; `apps/backend/src/app/routes/api/user/updatePreferences.ts:5`; `apps/frontend/src/lib/services/notificationService.svelte.ts:163`; `libs/frontend-components/src/lib/model/gameColors.svelte.ts:185`; `libs/frontend-components/src/lib/network/tabletopApi.svelte.ts:201`
- **Invariant**: Notification Delivery owns the web-notification prompt preference. Game Client owns preferred Player colors and accessibility palette. Identity and Access may physically store or serve these values without owning their meaning. Each owning context validates and updates its own preferences rather than replacing one cross-context `UserPreferences` object.

### Sessions have fixed expiry but no revocation mechanism

- **Classification**: Configuration defect and planned revocation capability
- **Observed**: Authenticated Sessions expire seven days after creation or mutation and do not slide on ordinary requests. `authTimestamp` is written but never read. Accounts may have unlimited independent sessions, but Logout deletes only the current cookie. There is no Logout All, server-side session registry, or Account session version, so status is rechecked only where a route uses the stricter Active-Account guard and security events cannot proactively revoke every session.
- **Evidence**: `apps/backend/src/app/app.ts:124`; `apps/backend/src/app/lib/session.ts:3`; `apps/backend/src/app/plugins/authorization.ts:44`; `apps/backend/src/app/routes/api/auth/logout.ts:3`
- **Invariant**: A User Account may have multiple concurrent Authenticated Sessions. Logout terminates the current session, while Logout All terminates every session for the Account; a device inventory is not initially required. Sessions have a 30-day absolute lifetime with no sliding extension from ordinary activity. Recent Authentication lasts 15 minutes and is refreshed only by successful proof through an Authentication Method. Inactivation, deletion, Set Password through a challenge, and the other agreed security events invalidate the required sessions immediately regardless of remaining lifetime.

### Admin authority is always active on the backend

- **Classification**: Model contradiction; planned Admin Mode
- **Observed**: Backend services apply Admin bypasses whenever the Account has the Admin role. The frontend `actAsAdmin` toggle changes client acting behavior but does not constrain backend authority.
- **Evidence**: `libs/backend-services/src/games/gameService.ts:161`; `libs/backend-services/src/games/gameService.ts:709`; `apps/frontend/src/lib/services/authorizationService.svelte.ts:35`
- **Invariant**: The Admin role grants eligibility for administrative authority. An Administrator enters Admin Mode through Recent Authentication, and only requests explicitly made in that mode may exercise administrative bypasses. Outside Admin Mode, an Administrator behaves as an ordinary Active Account.

### External Identity uniqueness is enforced

- **Classification**: Global uniqueness aligned; per-provider cardinality contradiction
- **Observed**: External Identities are qualified by provider and protected by uniqueness records, preventing the same provider identity from being attached to multiple User Accounts. The store nevertheless permits one Account to link multiple identities from the same provider, while the profile UI assumes one per provider.
- **Evidence**: `libs/backend-services/src/persistence/firestore/userStore.ts:67`; `libs/backend-services/src/persistence/firestore/userStore.ts:402`
- **Invariant**: A provider-qualified External Identity belongs to exactly one User Account, and a User Account has at most one External Identity from each provider. Moving an identity requires explicit unlinking or support-assisted recovery.

### Provider identity collisions do not merge Accounts

- **Classification**: Core lookup behavior aligned; support handling planned
- **Observed**: Lookup prioritizes an already-linked provider identity over a returned email. If that email belongs to another Account, the linked Account is authenticated and no merge occurs, but the conflict is neither surfaced nor routed for resolution.
- **Evidence**: `libs/backend-services/src/users/userService.ts:250`
- **Invariant**: A known stable provider identity remains authoritative for its linked Account and all status restrictions still apply. A conflicting verified email does not relink or merge Accounts; it is a support case. Account Merge is not a current domain operation and requires a separate future design.

### Password is correctly optional for Account completion

- **Classification**: Aligned
- **Observed**: Activation depends on username and verified email rather than a password, allowing an External Identity to be the Authentication Method.
- **Evidence**: `libs/backend-services/src/persistence/firestore/userStore.ts:343`; `libs/backend-services/src/users/userService.ts:250`
- **Invariant**: Active completion requires Username and Verified Email Address. A Password Credential is optional when another Authentication Method exists.

### Profile password changes bypass the backend minimum

- **Classification**: Defect
- **Observed**: Signup and challenge-authorized Set Password enforce a 12-character minimum after trimming, but the general profile-update service accepts any nonempty new password. The profile UI enforces 12 characters, so the weaker path is exposed to direct API callers.
- **Evidence**: `apps/backend/src/app/routes/api/user/update.ts:31`; `libs/backend-services/src/users/userService.ts:132`; `libs/backend-services/src/persistence/firestore/userStore.ts:258`
- **Invariant**: Every operation that creates or replaces a Password Credential applies the same centrally owned password policy.

## Game Conversations

### Conversation reads have no audience authorization

- **Classification**: Broad read behavior intended; Game-access check may require hardening
- **Observed**: Any Active Account with the User role and a Game ID can fetch the complete Game conversation. The route does not consult Game visibility, ownership, Player association, or Player status.
- **Evidence**: `apps/backend/src/app/routes/api/chat/game.ts:9`; `libs/backend-services/src/chat/chatService.ts:21`
- **Invariant**: Every Hosted Game Conversation is readable by any Active Account that can access its Game, including a direct-link observer of an Invite-Only Game. It is neither anonymously readable nor made discoverable through public listings merely by existing.

### Conversation writes use incomplete participation rules

- **Classification**: Defect and planned moderation behavior
- **Observed**: A non-Admin may append when associated with any Player in the Game, without checking Player status. Reserved invitees and Declined Players can therefore write. A non-Player owner cannot write, while an Admin may bypass membership and attribution.
- **Evidence**: `libs/backend-services/src/chat/chatService.ts:26`; `libs/backend-services/src/games/gameService.ts:1147`
- **Invariant**: Only a Joined Player may ordinarily send a Conversation Message, and only while the Game is In Progress or Finished. Reserved, Declined, Open, observer, and non-Player owner identities may not send. An Administrator in Admin Mode may perform separately attributed, auditable moderation without impersonating a Player or owner; this moderation behavior is not currently implemented.

### Message author attribution is optional and impersonable

- **Classification**: Model and authorization defects; planned attribution redesign
- **Observed**: Both User Account ID and Player ID are optional in the Message model. The server overwrites Account ID and validates Player ID for ordinary Users, but the UI displays only Player color and initial. Administrators bypass Player validation and may appear as any Player or with blank attribution.
- **Evidence**: `libs/common/src/site/chat/chatMessage.ts:4`; `libs/common/src/site/chat/gameChatMessage.ts:4`; `libs/backend-services/src/chat/chatService.ts:26`; `libs/frontend-components/src/lib/components/GameChat.svelte:198`
- **Invariant**: A normal Conversation Message visibly identifies its Joined Player author and privately retains the submitting User Account for audit. An administrative Message visibly identifies the Administrator and has no Player author. Administrators cannot impersonate Players or owners.

### Local Hotseat Games expose unused conversation paths

- **Classification**: Boundary rule aligned in the client; backend hardening may be needed
- **Observed**: Game Client hides and disables the Conversation for Hotseat play, although backend message APIs do not encode a Hotseat exclusion when called directly.
- **Evidence**: `libs/frontend-components/src/lib/model/gameSession.svelte.ts:457`; `libs/frontend-components/src/lib/components/DefaultTabs.svelte:126`
- **Invariant**: Game Conversations belong only to Hosted, networked Game Instances. Local Hotseat Games have no Game Conversation.

### Arbitrary Game IDs produce virtual empty conversations

- **Classification**: Model contradiction
- **Observed**: Reading a nonexistent Game ID returns a synthesized empty conversation, making the route's not-found branch unreachable. Conversations are otherwise stored only beneath existing Games.
- **Evidence**: `libs/backend-services/src/chat/chatService.ts:21`; `apps/backend/src/app/routes/api/chat/game.ts:22`
- **Invariant**: A Game Conversation exists logically with its Hosted Game Instance. It remains readable after finish, is permanently removed with Game deletion, and a Fork begins with a new empty Conversation without copied Messages or Read Positions. Persistence may create the Conversation lazily.

### Message identity and time are client-assigned

- **Classification**: Timestamp and duplicate-identity defects; planned canonicalization
- **Observed**: The client assigns Message ID and timestamp. The server preserves both, persistence appends atomically in commit order, and interfaces display by the client timestamp. No duplicate-ID or timestamp-plausibility check exists.
- **Evidence**: `apps/backend/src/app/routes/api/chat/message.ts:27`; `libs/backend-services/src/persistence/firestore/chatStore.ts:39`; `apps/frontend/src/lib/services/chatService.svelte.ts:131`
- **Invariant**: The client supplies the canonical Message ID for optimistic correlation, and the server rejects duplicates. The server supplies the accepted canonical timestamp, with persisted append order breaking timestamp ties. An optimistic interface may temporarily show client creation time but replaces it with the accepted server timestamp. Read Position and unread calculations use only accepted timestamps.

### Message content is silently changed or may become empty

- **Classification**: Defect
- **Observed**: The server trims and slices content to 500 UTF-16 code units, silently changing overlong input and permitting content that becomes empty after trimming.
- **Evidence**: `apps/backend/src/app/routes/api/chat/message.ts:34`
- **Invariant**: Message content is trimmed, nonempty, may contain interior whitespace and line breaks, and contains no more than 500 user-perceived Unicode characters. Invalid content is rejected rather than silently truncated.

### Message redaction is absent

- **Classification**: Planned moderation capability
- **Observed**: Sent Messages have no edit, delete, redaction, or moderation operation. Their practical immutability is only the absence of mutation APIs.
- **Evidence**: `libs/backend-services/src/persistence/stores/chatStore.ts`; `libs/backend-services/src/chat/chatService.ts`
- **Invariant**: A sent Message is immutable to its author. An Administrator in Admin Mode may redact abusive visible content while retaining Message identity, author, timestamp, and position; the moderation action and Administrator are auditable.

### Conversation capacity uses an undifferentiated failure

- **Classification**: Intended cap with diagnostic defect
- **Observed**: The store permanently rejects additional Messages after 2,000 using a generic error, while the declared ChatFullError is unused.
- **Evidence**: `libs/backend-services/src/persistence/firestore/chatStore.ts:39`; `libs/backend-services/src/chat/errors.ts:29`
- **Invariant**: A Game Conversation retains up to 2,000 Messages for the lifetime of its Hosted Game Instance. At capacity it remains readable but accepts no further Messages, and the outcome is reported explicitly as Conversation Full. Permanent Game deletion removes the history.

### Read Position trusts arbitrary timestamps

- **Classification**: Integrity and ownership defects; planned Read Position redesign
- **Observed**: Durable read state is keyed by Player and stores a client-supplied timestamp. A client may advance it to any future time; the marker then cannot regress and suppresses unread state until Message timestamps exceed it. Public observers and Administrators have no durable marker.
- **Evidence**: `apps/backend/src/app/routes/api/chat/bookmark.ts:41`; `libs/backend-services/src/chat/chatService.ts:90`
- **Invariant**: A Read Position belongs to one User Account and one Game Conversation and anchors to the random ID of the latest canonical Message read. The server resolves that ID to canonical order and accepts only forward movement to an existing Message; IDs themselves are not ordered. Multiple devices share the furthest valid position, and sending advances the sender through the accepted Message. Game Client derives unread count and boolean state from Messages after the position; no separate durable unread counter exists.

### Missed-message recovery skips the first prefix

- **Classification**: Defect and planned revision abstraction
- **Observed**: Recovery runs only when the last known Message index is greater than zero. A client whose known prefix ends at the first Message receives no missed Messages. The ID-XOR checksum is also order-insensitive and duplicate IDs cancel.
- **Evidence**: `apps/backend/src/app/routes/api/chat/message.ts:48`; `libs/common/src/util/checksum.ts:11`
- **Invariant**: An opaque Conversation Revision changes whenever canonical content changes, including append or redaction. Clients reconcile missing or full history when revisions differ; checksum and hash algorithms are implementation details. Conversation reconciliation returns every Message after the client's known position.

### Realtime events can contaminate or strand client conversation state

- **Classification**: Defect
- **Observed**: The client accepts Game Conversation notifications without checking their Game ID against the loaded conversation. It also ignores Game-channel discontinuities, so missed events do not trigger immediate reconciliation.
- **Evidence**: `apps/frontend/src/lib/services/chatService.svelte.ts:192`; `apps/frontend/src/lib/services/chatService.svelte.ts:238`; `apps/frontend/src/lib/network/sseConnection.svelte.ts:114`
- **Invariant**: A persisted append is canonical; realtime delivery is best effort and failure never rolls it back. A realtime event affects only its matching loaded conversation. Game Client reconciles canonical history on initial load, reconnect, delivery discontinuity, and Conversation Revision mismatch. Offline push and email are not current Game Conversation delivery expectations.

### Game switches race asynchronous conversation work

- **Classification**: Defect
- **Observed**: Loading does not recheck the selected Game after awaiting its read marker. Sending continues against mutable current-conversation state after awaits; a Game switch can splice results into another Game, and an index of `-1` can remove its final unrelated Message.
- **Evidence**: `apps/frontend/src/lib/services/chatService.svelte.ts:90`; `apps/frontend/src/lib/services/chatService.svelte.ts:112`
- **Invariant**: Asynchronous conversation work remains isolated to the Game Conversation for which it began.

### Generic and stored chat models contain phantom structure

- **Classification**: Model and diagnostic contradictions; planned cleanup
- **Observed**: Generic Chat and ChatMessage abstractions have no non-game use. StoredGameChat declares timestamps never written, ChatFullError is never thrown, and persistence translates chat failures as DataToken errors.
- **Evidence**: `libs/common/src/site/chat/chat.ts:4`; `libs/backend-services/src/persistence/model/storedGameChat.ts:5`; `libs/backend-services/src/chat/errors.ts:29`; `libs/backend-services/src/persistence/firestore/chatStore.ts:152`
- **Invariant**: Game Conversations models only conversations belonging one-to-one to Hosted Game Instances. Generic Chat and non-game Conversation abstractions are not current domain concepts. Game Conversations owns canonical Message history and Read Position; Notification Delivery transports events and discontinuities, Game Client owns presentation, and Game Lifecycle supplies Game and participation facts.

## Notification Delivery

### Notification merges realtime updates and attention notices

- **Classification**: Model contradiction; planned contract split
- **Observed**: One generic Notification envelope combines topical realtime updates containing committed Actions, Undo data, Game projections, or Conversation Messages with direct User notices rendered through Web Push or Discord. Clients apply update payloads directly and reconcile after gaps or revision mismatches. There is no durable inbox, acknowledgement, read state, or delivery receipt. The System category has no producer or consumer.
- **Evidence**: `libs/common/src/site/notifications/notification.ts:4`; `libs/common/src/site/notifications/gameNotification.ts:7`; `libs/common/src/site/notifications/userNotification.ts:7`; `libs/backend-services/src/notifications/notificationService.ts:7`
- **Invariant**: A Realtime Update carries an actual committed domain change or projection, such as a Processed Action, Undo result, Game projection, or Conversation Message, which a client may apply incrementally before reconciling after a gap or revision mismatch. An Attention Notice is a User-addressed projection intended to attract attention. Both are ephemeral Notification Delivery contracts with distinct audiences, payloads, consumers, and presentation. Notification Delivery owns no durable inbox, read state, acknowledgement, or retention lifecycle; a future durable task or inbox requires a separate context.

### Dispatch is intentionally fire-and-forget

- **Classification**: Intended latency behavior with a contract-naming gap
- **Observed**: The default service starts topical publication and Attention Transport sends without awaiting them, logs and swallows errors, and returns before success or failure is known. Attention Dispatch waits for registration lookup but not Transport Attempts.
- **Evidence**: `libs/backend-services/src/notifications/defaultNotificationService.ts:84`
- **Invariant**: Dispatch is fire-and-forget so canonical source operations do not incur delivery latency. Completion means eligible delivery work was initiated, not that Transport Attempts completed or recipients received anything. Notification Delivery returns no synchronous Dispatch Result; asynchronous attempt outcomes may drive logging, metrics, and invalid-registration cleanup but never roll back canonical source changes.

### Best-effort guarantees are implicit

- **Classification**: Intended behavior requiring explicit contracts
- **Observed**: Realtime transports provide no application replay, acknowledgement, deduplication, or ordering contract. Attention transports perform one-shot sends without durable retry or acknowledgement. Turn reminders are independently scheduled source notices rather than delivery retries.
- **Evidence**: `libs/backend-services/src/pubsub/redisPubSubService.ts:34`; `libs/backend-services/src/notifications/transports/ablyTransport.ts:25`; `libs/backend-services/src/notifications/transports/webPushTransport.ts:44`; `libs/backend-services/src/games/gameService.ts:1268`
- **Invariant**: Realtime Updates are best effort and may be missed, duplicated, delayed, or observed out of order. A Discontinuity means continuity for its exact Topic is not guaranteed; it may be emitted on initial attachment, reconnection, or a detected gap. The consuming context reconciles against its canonical source, while Notification Delivery only signals uncertainty and does not supply recovery state. An Attention Notice receives one best-effort attempt through each applicable registered Attention Transport, with no durable retry, acknowledgement, inbox receipt, or exactly-once guarantee. Source-scheduled workflows revalidate their own domain conditions before producing a notice; Notification Delivery has no generic Valid Until concept. Scheduled reminders are new notices, not retries.

### Discord reports failed delivery as successful

- **Classification**: Defect
- **Observed**: Discord DM lookup and send failures return normally, after which the transport reports `success: true` unconditionally. The result is otherwise ignored.
- **Evidence**: `libs/backend-services/src/notifications/transports/discordTransport.ts:43`; `libs/backend-services/src/notifications/transports/discordTransport.ts:62`
- **Invariant**: A Delivery Result never reports success when the transport failed to deliver.
- **Planned improvement**: Asynchronous Transport Attempt outcomes may later be classified as Accepted, Permanently Invalid, or Transient Failure. Accepted means only that the transport accepted the attempt, not that the User received or viewed it. Permanently Invalid removes the affected transport registration; Transient Failure retains it and is logged or measured without retrying the notice. This classification does not add durable attempt history, receipts, retries, or a synchronous Dispatch Result.

### Topic registrations lack a complete authorization lifecycle

- **Classification**: Authorization and lifecycle risks
- **Observed**: Transport-specific subscriptions intentionally support multiple topics, but authorization and revocation are inconsistent. Web Push unsubscribe deletes an entire transport subscription using only its external capability; direct Account switching can retain an earlier User Topic Registration; logout may leave registrations when unregister fails; and Inactive or Deleted Accounts and unlinked Discord identities receive no registration cleanup or delivery-time eligibility check.
- **Evidence**: `apps/backend/src/app/routes/api/notification/webpush/unsubscribe.ts:13`; `apps/frontend/src/lib/services/notificationService.svelte.ts:44`; `apps/frontend/src/lib/services/notificationService.svelte.ts:207`; `libs/backend-services/src/notifications/defaultNotificationService.ts:84`
- **Invariant**: Realtime Update and Attention Notice are distinct notification contracts. SSE and Ably are Realtime Update Delivery Transports; Web Push and Discord are Attention Notice Delivery Transports. A Topic combines one contract with one Audience, and each Topic Registration records and is independently authorized for the requesting User Account through a compatible Delivery Transport. A Realtime Connection's registrations end with the connection and are reauthorized on reconnect. An Attention Transport registration persists until removed, reported invalid by its transport, or authorization is revoked. Logout removes registrations established by that client session; Logout All, Inactive, and Deleted revoke all registrations authorized by the Account; Discord unlink revokes registrations associated with that link. Known entitlement changes ideally revoke affected registrations without requiring a synchronous authorization lookup for every delivery. Transport-specific addresses, subscription objects, identifiers, and API endpoints are implementation details.
- **Gap**: Account inactivation and deletion currently do not revoke persisted Topic Registrations or trigger a delivery-time eligibility check. Logout cleanup is best effort and can leave registrations when unregister fails.
- **Planned improvement**: Topics may become typed values combining notification contract and Audience, with their string encoding retained only as an implementation detail. This is desirable but deferred; the current string representation need not be replaced as part of the initial domain documentation work.

### Attention delivery preferences are transport-registration-level

- **Classification**: Current behavior aligned with intended initial scope
- **Observed**: Browser permission and Topic Registration opt into Web Push. The sole stored preference suppresses the application's permission prompt but does not unsubscribe or filter notice types. Every compatible transport registration receives every applicable Attention Notice, with no per-purpose filters or quiet hours.
- **Evidence**: `apps/frontend/src/lib/services/notificationService.svelte.ts:163`; `libs/common/src/site/user.ts:25`
- **Invariant**: Realtime Updates are synchronization traffic rather than optional Attention Notices. Attention delivery is opt-in through a compatible Topic Registration; initially, a registered Attention Transport receives every applicable Attention Notice without per-purpose filters or quiet hours. The web-prompt preference only suppresses permission prompting. System Notices use Attention Transports and remain best effort.

### Attention rendering spans source and transport code

- **Classification**: Boundary clarification; implementation mostly aligned
- **Observed**: Source contexts produce semantic notice payloads. Discord renders server-side using Game Title metadata, while the service worker renders Web Push payloads client-side.
- **Evidence**: `libs/backend-services/src/games/gameService.ts:1363`; `libs/backend-services/src/notifications/transports/discordTransport.ts:123`; `apps/frontend/src/service-worker.ts:20`
- **Invariant**: The source context supplies Attention Notice kind, semantic facts, Audience, and navigation intent. Notification Delivery owns transport-specific rendering and formatting, while Game Distribution may supply Game Title presentation metadata. Source contexts do not construct transport-specific copy or payload structures.

### Game audience capabilities are not enforced

- **Classification**: Authorization defect with cross-context policy dependency
- **Observed**: An Active Account can request an SSE stream for an arbitrary Game ID, while Ably tokens carry an identity but no audience capabilities and clients may attach arbitrary named channels.
- **Evidence**: `apps/backend/src/app/routes/api/sse/game.ts:16`; `libs/backend-services/src/ably/ablyService.ts:16`; `apps/frontend/src/lib/network/ablyConnection.svelte.ts:55`
- **Invariant**: Identity and Access proves the Account, Game Lifecycle decides Game Instance Audience entitlement, and Notification Delivery enforces only granted Audience capabilities. A User Audience contains exactly its Active Account, a Game Instance Audience contains Active Accounts permitted to access that Hosted Game, and the Global Audience contains every Active Account.

### SSE channel identity and connection state are corrupted

- **Classification**: Defects
- **Observed**: SSE collapses Public Catalog events and discontinuities into the User channel. Disconnect closes every feed but sets overall state to Connected; an error on one feed closes all feeds and retries only the failing feed, potentially stranding the others.
- **Evidence**: `apps/frontend/src/lib/network/sseConnection.svelte.ts:86`; `apps/frontend/src/lib/network/sseConnection.svelte.ts:124`; `apps/frontend/src/lib/network/sseConnection.svelte.ts:144`
- **Invariant**: Every event and Discontinuity retains its exact Audience identity, and connection state describes the feeds that are actually live. Recovery re-establishes every affected feed.

### Player fanout can target an undefined User audience

- **Classification**: Defect
- **Observed**: Game Player fanout does not filter missing User Account IDs and may publish to a phantom `user-undefined` audience.
- **Evidence**: `libs/backend-services/src/games/gameService.ts:1216`
- **Invariant**: A User Audience always identifies an actual eligible User Account.

### Notification payload validation is only generic

- **Classification**: Integrity risk
- **Observed**: The common library already defines action-specific TypeBox schemas for Game and User notifications, but producers rely on TypeScript assertions, the frontend validates only the broad `{ id, type, action, data }` envelope, and the service worker trusts parsed push data before consumers interpret embedded Game, Action, Message, recipient, or revision fields. Notification IDs are not used to promise generic deduplication. The generic envelope does not retain the exact Topic, and System Notification has no concrete schema yet.
- **Evidence**: `libs/common/src/site/notifications/notification.ts:4`; `libs/common/src/site/notifications/gameNotification.ts:7`; `libs/common/src/site/notifications/userNotification.ts:7`; `apps/frontend/src/lib/services/notificationService.svelte.ts:221`; `apps/frontend/src/service-worker.ts:20`
- **Invariant**: Preserve the existing `{ id, type, action, data }` shape. Producers and consumers validate against a compiled action-specific discriminated contract at their trust boundaries, and concrete System Notice contracts are added when System Notices are implemented. The delivery event also retains the exact Topic. Generic expiry, production-time, and navigation fields are not added without a concrete requirement.

### Notification identity has no explicit contract

- **Classification**: Boundary clarification
- **Observed**: Producers usually assign a random `nanoid` when constructing an envelope. One send shares that ID across its Topics and Transport Attempts, but recipient-specific notices may be constructed with separate IDs. Turn reminders also reuse the ID as a scheduled-work guard. Ably and SSE add unrelated transport identifiers, and neither the delivery layer nor generic consumers deduplicate by Notification ID.
- **Evidence**: `libs/backend-services/src/games/gameService.ts:1203`; `libs/backend-services/src/games/gameService.ts:1276`; `libs/backend-services/src/notifications/defaultNotificationService.ts:84`; `libs/backend-services/src/notifications/transports/ablyTransport.ts:25`; `apps/backend/src/app/routes/api/sse/user.ts:35`
- **Invariant**: A Notification ID identifies one constructed notification envelope and remains shared across that envelope's Topic and transport fan-out. It is not a Transport Attempt identifier, a receipt, a delivery guarantee, or a canonical Game, Action, or Message identifier. Consuming contexts continue using their canonical domain identifiers, checksums, and revisions for deduplication and reconciliation.

### Notification vocabulary mixes scaffolded and technical concepts

- **Classification**: Model contradiction; planned terminology cleanup
- **Observed**: System Notification is scaffolded but has no runtime producer or consumer. Email is only a speculative comment under UserDirect, while UserDirect and Topical describe routing mechanics rather than recipient intent. Purpose-specific invitation, game-end, and Identity emails bypass Notification Delivery.
- **Evidence**: `libs/common/src/site/notifications/notification.ts:12`; `libs/backend-services/src/notifications/notificationService.ts:7`; `libs/backend-services/src/games/gameService.ts:670`; `libs/backend-services/src/games/gameService.ts:1234`
- **Invariant**: A System Notice is a platform-originated Attention Notice targeting a User Audience or the Global Audience, such as maintenance, outage, or required-upgrade messaging. Canonical platform state for incremental application remains a Realtime Update. Identity verification and Set Password emails remain Identity and Access workflows; Game invitation and Game-end emails remain Game Lifecycle workflows. Their purpose-specific scheduling, canonical rechecks, rendering, and delivery do not make email a generic Notification Delivery transport.

## Game Distribution

### Hosted Games intentionally follow the current Publication

- **Classification**: Intended compatibility policy with incomplete enforcement
- **Observed**: A Hosted Game records its stable Game Title ID but no logic or UI artifact version. The backend and frontend load the currently published artifacts. Current compatibility checks compare only the current client and server logic major versions; there is no title-specific migration registry or validation that a new Logic Artifact can continue every surviving Game.
- **Evidence**: `libs/common/src/game/model/game.ts:53`; `apps/backend/src/app/plugins/games.ts:23`; `libs/backend-services/src/games/libraryService.ts:139`
- **Invariant**: A Hosted Game Instance does not pin artifact versions. It always uses the current Publication for its Game Title, and every new Logic Artifact is responsible for operational compatibility with the latest canonical State of surviving Games. Historical traversal, replay, and Fork are not guaranteed to remain compatible.

### Logic is deployed separately but also embedded in UI

- **Classification**: Distribution-model clarification
- **Observed**: The backend loads a separately deployed Logic Artifact, while the UI Artifact contains the corresponding Game Runtime logic used for client execution and prediction. The manifest records separate logic and UI artifact versions, and UI code reports the embedded logic metadata independently of its artifact version.
- **Evidence**: `libs/backend-services/src/games/libraryService.ts:139`; `libs/frontend-components/src/lib/definition/gameUiDefinition.ts:57`; `games/bus-ui/src/lib/definitions/definition.ts:1`; `config/config-games/src/site-manifest.json:1`
- **Invariant**: A logic change cannot produce a Logic-only Publication. It requires both a new server Logic Artifact and a new UI Artifact embedding the same logic. A presentation-only UI change may produce an UI-only Publication whose embedded logic remains identical to the currently published server logic.

### Publication validation does not establish a valid artifact pair

- **Classification**: Publication integrity gap
- **Observed**: Deployment status checks only the selected UI artifact, manifest validation checks field shapes but not artifact existence or agreement, and backend definition ID or version mismatches warn rather than rejecting the Publication.
- **Evidence**: `tools/deploy/src/lib/gcs.ts:53`; `tools/deploy/src/lib/manifest.ts:7`; `libs/backend-services/src/games/libraryService.ts:186`
- **Invariant**: Publication selects artifacts atomically after validation. A logic-changing Publication requires a loadable server Logic Artifact and a loadable UI Artifact embedding the same Game Title logic version. An UI-only Publication requires a loadable UI Artifact whose embedded logic agrees with the currently published Logic Artifact. Logic-only Publication is invalid. Failed validation leaves the previous Publication current.

### Client and server logic compatibility follows semantic versioning

- **Classification**: Intended compatibility contract
- **Observed**: Gameplay requests carry the UI Artifact's embedded Logic version, and the backend rejects a different major version while accepting minor and patch differences.
- **Evidence**: `libs/frontend-components/src/lib/network/tabletopApi.svelte.ts:367`; `apps/backend/src/app/plugins/games.ts:23`
- **Invariant**: The selected Publication pairs a server Logic Artifact with an UI Artifact embedding that exact logic. During rollout, an already-loaded client may contain an older minor or patch Logic version and must remain compatible with the newer same-major server; a major mismatch requires reload. A newer client against an older server is not a valid forward-deployment state because logic changes necessarily publish matching server and UI artifacts together. Semver tolerance for loaded clients is therefore effectively unidirectional.

### UI-only publication does not invalidate loaded clients

- **Classification**: Intended compatibility contract
- **Observed**: UI Artifact versions are checked independently of embedded Logic versions. Current client policy may reload, prompt, or continue according to the UI version difference.
- **Evidence**: `libs/frontend-components/src/lib/network/tabletopApi.svelte.ts:63`; `apps/frontend/src/routes/(app)/+layout.svelte:179`
- **Invariant**: An UI-only Publication does not inherently invalidate an already-loaded earlier UI because both embed the same Logic. A particular UI Artifact may require reload for a concrete defect, but ordinary UI-only Publication allows the older loaded client to continue.

### Logic rollback requires reverse State compatibility

- **Classification**: Operational safety constraint
- **Observed**: Hosted Games store no creating Logic version and always run the currently published Logic. A newer Logic Artifact may process canonical State into a representation or meaning that the previous artifact cannot read, even within one semver major line.
- **Evidence**: `libs/common/src/game/model/game.ts:53`; `libs/backend-services/src/persistence/model/storedState.ts:3`; `libs/backend-services/src/games/libraryService.ts:139`
- **Invariant**: UI-only rollback is supported because Logic remains unchanged. Logic rollback is safe before the new Logic processes canonical Game State, or when reverse State compatibility has been explicitly established. Otherwise recovery uses a forward-fix Publication; same-major client interoperability does not prove persisted-State rollback safety.

### Game Distribution has no withdrawal lifecycle

- **Classification**: Domain clarification
- **Observed**: Manifest inclusion is the publication switch for backend Logic Artifact loading, title-specific routes, and frontend UI Artifact discovery. Removing an entry stops serving the title rather than moving it into a separately modeled lifecycle stage.
- **Evidence**: `libs/backend-services/src/games/libraryService.ts:229`; `apps/backend/src/app/plugins/games.ts:67`; `apps/frontend/src/lib/services/libraryService.svelte.ts:45`
- **Invariant**: Withdrawn Game Title is not a domain concept. A Game Title is either part of the site's Publication or it is not; removal provides no continued-service promise for existing Games.

### Eligible Undo cannot fail

- **Classification**: Domain invariant constraining State evolution
- **Observed**: Undo eligibility is decided by Game Lifecycle, after which the Game Runtime applies the stored inverse patch. Stored patches contain paths and values from the State representation in which their Actions were committed.
- **Evidence**: `libs/common/src/game/engine/gameEngine.ts:175`; `libs/common/src/game/engine/gameAction.ts:13`; `libs/backend-services/src/games/gameService.ts:1007`
- **Invariant**: Eligibility establishes that the stored Undo Patch is applicable to the current State. Once accepted, Undo succeeds atomically and cannot fail. A Logic Artifact that changes State representation must preserve or migrate every stored patch that can remain eligible for Undo.

### Operational compatibility is asymmetric across history

- **Classification**: Intended compatibility boundary
- **Observed**: Backward History Navigation applies stored inverse patches, while forward History Navigation and Fork execute historical Actions through the current Game Runtime. Both operations are local or derived and do not need to mutate the source Game's Canonical Action History.
- **Evidence**: `libs/frontend-components/src/lib/model/gameHistory.svelte.ts:283`; `libs/frontend-components/src/lib/model/gameHistory.svelte.ts:338`; `libs/backend-services/src/games/gameService.ts:173`
- **Invariant**: Backward History Navigation remains reliable by applying stored Undo Patches in their original reverse sequence. Forward History Navigation and Fork are rule-based reconstruction and are not guaranteed across Logic changes. Their failure is non-destructive: it cannot modify the canonical Game, and leaving History View restores the latest canonical State.

### One broken title can collapse or fragment the catalog

- **Classification**: Availability defects
- **Observed**: Backend title loading is aggregated so one missing Logic Artifact can leave GameService with no titles and register no title routes. The frontend instead catches individual UI import failures and silently omits those titles, allowing frontend and backend catalogs to disagree.
- **Evidence**: `apps/backend/src/app/plugins/services.ts:78`; `apps/backend/src/app/plugins/games.ts:90`; `apps/frontend/src/lib/services/libraryService.svelte.ts:45`
- **Invariant**: Failure is isolated to the affected Publication. It becomes explicitly Unavailable while other published Game Titles and routes remain available, and frontend and backend expose the same availability state.

### Catalog discovery requires executable title code

- **Classification**: Planned boundary improvement with unresolved configuration dependency
- **Observed**: Catalog presentation metadata is exposed through title definitions, and the frontend imports each title's UI entry module before it can render that title. Failed imports therefore remove titles from the visible catalog. Title configuration behavior is also attached to executable definitions, making a data-only separation non-trivial.
- **Evidence**: `libs/common/src/game/definition/gameDefinition.ts:12`; `libs/frontend-components/src/lib/definition/gameUiDefinition.ts:57`; `apps/frontend/src/lib/services/libraryService.svelte.ts:45`
- **Invariant**: Game Distribution should eventually expose a lightweight, non-executable Catalog Entry so browsing and identifying an eligible Game Title does not require loading its UI Artifact. The Game Title package may remain the metadata authoring source and Publication may extract the Catalog Entry. This is an ideal boundary to work toward rather than a requirement for the initial documentation or current implementation.
- **Planned improvement**: Catalog discovery and title configuration become a two-stage load. Selecting Play loads the current Publication's title-specific Configuration Definition and UI capability. The Game Title owns option identities, meanings, domains, defaults, dependencies, and compatibility; Game Client renders the form; Game Runtime authoritatively defaults and validates the complete proposal; Game Lifecycle stores the chosen Game Configuration and governs when it may change. Executable configuration behavior is not forced into the Catalog Entry.

### Beta is presentation rather than authorization

- **Classification**: Boundary clarification with misleading entitlement vocabulary
- **Observed**: Beta filtering occurs only in the frontend and currently reveals Beta titles to BetaTester or Admin Accounts. Backend title routes apply ordinary Account and Game authorization but do not enforce BetaTester status, so direct requests and invitations can reach a Beta title. Developer has no current production consumer.
- **Evidence**: `apps/frontend/src/lib/services/libraryService.svelte.ts:18`; `apps/backend/src/app/routes/titleSpecific/create.ts:23`; `apps/backend/src/app/routes/titleSpecific/action.ts:20`
- **Invariant**: Beta communicates expectations about a Game Title's maturity and may affect catalog presentation; it is not a security boundary or resource-authorization rule. An Active Account that otherwise has ordinary access is not forbidden from a Beta title merely for lacking BetaTester status.
- **Vocabulary**: BetaTester is a Beta Catalog Visibility Grant. Developer is not the same concept; it may later become a substantive Game Distribution entitlement for capabilities such as debug views, but its authority is not yet designed and it currently has no production consumer.
