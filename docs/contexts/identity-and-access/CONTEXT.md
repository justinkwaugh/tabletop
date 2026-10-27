# Identity and Access

Identity and Access owns User Account lifecycle, authentication methods, sessions, and administrative role assignment. Resource-specific authorization and preference semantics belong to their consuming contexts.

## Accounts

**User Account**:
The persistent identity through which a person accesses the platform. “User” is acceptable shorthand when it is unambiguous.
_Avoid_: Person, Profile, User record

**Account ID**:
The permanent identity of a User Account. It is never reused, including after deletion.

**Public User Profile**:
The Account ID and Username published for an Active Account. Private Account details and non-Active Accounts are not discoverable.

**Username**:
The case-insensitively unique login name and public handle of a User Account. It is nonempty after trimming, preserves chosen display casing, and excludes control characters.
_Avoid_: Display name, login ID

**Account Completion**:
The requirements for normal platform use: a Username and Verified Email Address. A Password Credential is optional when another Authentication Method exists.

**Email Address**:
The private email associated with a User Account. Comparison and uniqueness are case-insensitive.

**Verified Email Address**:
An Email Address whose control has been established through an Email Verification Challenge or a trusted provider assertion.

**Pending Email Address**:
A reserved replacement awaiting verification while the existing Verified Email Address remains active. Verification atomically promotes it and releases the previous address.

## Account Status

**Account Status**:
The mutually exclusive lifecycle status of a User Account: Incomplete, Active, Inactive, or Deleted.

**Incomplete**:
A User Account that has not satisfied Account Completion. It may authenticate only for onboarding, verification, Set Password, and logout.

**Active**:
A complete User Account permitted normal platform use. Only Active Accounts publish a Public User Profile.

**Inactive**:
A retained User Account disabled by an Administrator. It cannot establish or continue an Authenticated Session and may prove identity only for support.

**Deleted**:
The terminal, anonymized tombstone of a removed User Account. It cannot authenticate or become another status.
_Avoid_: Soft-deleted, archived

## Authentication

**Authentication Method**:
A means by which a User Account proves identity: a Password Credential or External Identity. An Account must retain at least one Authentication Method.

**Password Credential**:
A secret used to authenticate a User Account. Leading and trailing whitespace is ignored, interior whitespace and case are significant, and the minimum length is twelve characters after trimming.
_Avoid_: Password record

**External Identity**:
A stable, provider-qualified identity linked to exactly one User Account. An Account may link at most one identity from each provider. Linking requires Recent Authentication and completes only a Provider Authorization Attempt the linking session began.
_Avoid_: Social account, provider email

**Trusted External Provider**:
A provider whose verified-email assertion is accepted as proof of email control for Account linking. Google and Discord are currently trusted; additional providers require an explicit trust decision.

**Set Password**:
The operation that establishes a new Password Credential, replacing any existing one. It advances the Account's Session Generation in the same commit, which terminates every Authenticated Session of the Account.
_Avoid_: Password Recovery

**Authentication Challenge**:
A purpose-bound, single-use proof with a fifteen-minute lifetime, consumed in the same commit as the operation it authorizes. Issuing a replacement invalidates earlier challenges for the same Account and purpose. A challenge never establishes an Authenticated Session.
_Avoid_: Authentication token, verification token

**Email Verification Challenge**:
An Authentication Challenge proving control of its exact target Email Address.

**Set Password Challenge**:
An Authentication Challenge, bound to the Email Address it was sent to, authorizing Set Password for an Incomplete or Active Account without establishing an Authenticated Session. It changes neither Account Status nor email verification; the person signs in afterwards through an Authentication Method.

**Sensitive Change Challenge**:
An Authentication Challenge, bound to the Email Address it was sent to and to the exact requested change (the proposed Email Address and whether a Password Credential is being set), through which an Account without a Password Credential authorizes that change. An Account with a Password Credential proves the change with that password instead.

**Authenticated Session**:
Ongoing authorization associated with a User Account, recorded server-side under an unguessable Session ID that the session cookie carries. It has a thirty-day absolute lifetime and no sliding extension from ordinary activity, and it ends early through Logout, Logout All, or Set Password. A cookie without a live record authorizes nothing. An Account may have multiple concurrent sessions.
_Avoid_: Login cookie, stateless session

**Session ID**:
The unguessable identifier of one Authenticated Session. It is the only authorization the session cookie carries and is never derived from Account data. It is a bearer secret: logs and error reports carry its Secret Reference instead, and the cache service keeps its cache key, which embeds the Session ID, out of its diagnostics.

**Secret Reference**:
A one-way digest of a bearer value with enough entropy to defeat enumeration: a Session ID, an Authorization State or a data token. It is stable for the same value and useless for presenting it, and application logs and error reports name such a value only through it. The secrets and codes of Authentication Challenges, passwords, provider credentials and any other supplied secret are redacted outright, never digested, because a digest of a short code is an offline verifier for it.
_Avoid_: Masked token, session hash

**Session Generation**:
A counter on the User Account that every Authenticated Session records when it is established. A session authorizes only while its recorded generation equals the Account's. A Password Credential change advances the generation in the same commit as the new credential, so no session established from the old credential survives it, including one established concurrently.

**Recent Authentication**:
Successful proof through an Authentication Method within the previous fifteen minutes for one Authenticated Session. Ordinary activity does not refresh it, and a session re-established after a Sensitive Change Challenge has none until the person Reauthenticates.

**Reauthentication**:
Proof through an Authentication Method of the Account that already holds the current Authenticated Session, which refreshes that session's Recent Authentication. It establishes no session, extends no lifetime, and cannot switch the session to another Account: a Password Credential must be the Account's own and an External Identity must already be linked to it.
_Avoid_: Re-login, step-up

**Provider Authorization Attempt**:
One pass through an external provider's authorization flow, begun on this platform for a stated purpose: sign-in, linking, or Reauthentication. Its Authorization State is an unpredictable, server-recorded, single-use value with a ten-minute lifetime, bound to the provider, the purpose, the registered return address, and either the Authenticated Session that began it or, for sign-in, the browser that began it. A provider callback is accepted only with the state of a live attempt from the same binding, consumed exactly once.
_Avoid_: OAuth state parameter, CSRF token

**Logout**:
Termination of the current Authenticated Session. Any Account holding a session may log out; a copied cookie for that session stops authorizing at the same moment.

**Logout All**:
Termination of every Authenticated Session belonging to a User Account, including the one requesting it.

## Authorization

**Role Assignment**:
An additive authorization grant associated with a User Account. A role is effective only while the Account is Active.

**Admin Role**:
The role making an Active Account eligible to exercise administrative authority. It does not replace ordinary Active Account access.

**Administrator**:
An Active User Account assigned the Admin Role.

**Admin Mode**:
An explicit mode of one Authenticated Session in which an Administrator may exercise administrative bypasses. An Administrator activates it with Recent Authentication, and it lasts until that Recent Authentication lapses, the Administrator deactivates it, or the session ends; reauthentication alone neither activates nor revives it. Outside Admin Mode, the Administrator behaves as an ordinary Active Account.

**Principal**:
The identity a request acts with: the User Account holding the Authenticated Session and whether that session is in Admin Mode. Consuming contexts grant administrative bypasses to a Principal in Admin Mode, never to the Admin Role alone.

**Beta Catalog Visibility Grant**:
An additive grant that makes Beta Game Titles visible to an Active Account in catalog discovery. It does not authorize access to a Game or confer administrative authority.
_Avoid_: Beta entitlement, Beta access role

**Alpha Catalog Visibility Grant**:
An additive grant that makes Alpha Game Titles visible to an Active Account in catalog discovery. Like the Beta grant, it authorizes neither Game access nor administrative authority.
_Avoid_: Alpha entitlement, Alpha access role

**Developer Role**:
An additive grant exposing developer tooling, such as debug views and the host view of a Game, to an Active Account. It includes the Alpha and Beta Catalog Visibility Grants, so Alpha and Beta Game Titles are visible in catalog discovery. It confers no administrative authority.

**Assignable Role**:
A Role Assignment an Administrator may grant or revoke for another User Account: the Alpha Catalog Visibility Grant, the Beta Catalog Visibility Grant, and the Developer Role. The Admin Role is not assignable through this path.
