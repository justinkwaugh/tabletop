# Notification Delivery

Notification Delivery owns the ephemeral, best-effort movement of Realtime Updates and Attention Notices to authorized Audiences. It owns neither canonical source state nor a durable inbox, receipt, acknowledgement, retry, read state, or retention lifecycle.

## Notification Contracts

**Notification Envelope**:
A typed semantic payload prepared for delivery to an Audience through one or more compatible Delivery Transports.

**Notification ID**:
The opaque identity of one constructed Notification Envelope, shared across that envelope’s fan-out. It is not a canonical domain identifier, Transport Attempt identifier, receipt, or delivery guarantee.

**Realtime Update**:
An ephemeral Notification Envelope carrying a committed domain change or projection that a consumer may apply incrementally. Delivery continuity is not guaranteed.
_Avoid_: Change hint, state hint

**Attention Notice**:
An ephemeral, best-effort Notification Envelope intended to attract a User’s attention. A missing Attention Notice may never be seen.
_Avoid_: Alert, inbox item

**System Notice**:
A platform-originated Attention Notice addressed to a User Audience or the Global Audience, such as maintenance, outage, or required-upgrade information.

## Addressing

**Audience**:
The set of Active User Accounts eligible to receive a Notification Envelope.
_Avoid_: Recipient list

**User Audience**:
The Audience containing one specified Active User Account.

**Game Instance Audience**:
The Audience containing the Active User Accounts permitted to access one Hosted Game Instance.

**Global Audience**:
The Audience containing every Active User Account.

**Topic**:
The exact delivery identity combining one notification contract with one Audience. Its encoded name is not domain language.
_Avoid_: Channel, string topic

**Topic Registration**:
An authorized request by a User Account to receive one Topic through a compatible Delivery Transport. One transport relationship may support multiple Topic Registrations.
_Avoid_: Endpoint registration, subscription topic

## Delivery

**Delivery Transport**:
A mechanism capable of carrying a supported notification contract. A transport-specific address, subscription object, identifier, or API endpoint is an implementation detail.
_Avoid_: Delivery endpoint, API endpoint

**Realtime Connection**:
A temporary delivery relationship that may hold multiple Topic Registrations. Its registrations end with the connection and are authorized again on reconnect.

**Dispatch**:
Initiation of eligible delivery work without waiting for Transport completion or User receipt. Completion of Dispatch means only that the work was initiated.
_Avoid_: Delivery confirmation, send result

**Discontinuity**:
A signal that delivery continuity for one exact Topic is not guaranteed. The consuming context reconciles with its canonical source; Notification Delivery does not provide recovery state.
