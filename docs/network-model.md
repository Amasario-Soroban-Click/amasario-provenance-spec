# Network Model

`schema/network.schema.json` requires `id`, `type` and `passphrase`. A network
descriptor identifies where an observation was made, and it is one of the two
components of a fact's boundary.

## The descriptor

| Field                  | Required | Meaning                                            |
| ---------------------- | -------- | -------------------------------------------------- |
| `id`                   | yes      | Stable identifier for this descriptor.             |
| `type`                 | yes      | The network type, from `network-types`.            |
| `passphrase`           | yes      | The Stellar network passphrase.                    |
| `networkId`            | no       | The network id derived from the passphrase.        |
| `rpcUrl`               | no       | The RPC endpoint used.                             |
| `horizonUrl`           | no       | The Horizon endpoint used, where relevant.         |
| `protocolVersion`      | no       | The protocol version observed.                     |
| `passphraseRecognised` | no       | Whether the passphrase is one Amasario recognises. |

## The passphrase is the fact, the type is the classification

This distinction is stated in the taxonomy and it is worth restating: the Stellar
network passphrase is the fact that identifies a Stellar network. The Amasario
`type` is a classification that groups environments sharing operational semantics.

They are separate because two environments can share a passphrase while having
different endpoints, different retention and different operators. A private
deployment of Stellar core using the public testnet passphrase is a `CUSTOM`
network by type with the testnet passphrase, and collapsing those into one field
would make it impossible to describe.

## Types

| Type        | Durability               | Notes                                                                              |
| ----------- | ------------------------ | ---------------------------------------------------------------------------------- |
| `LOCAL`     | ephemeral                | Developer-controlled, typically a local Quickstart container. State is disposable. |
| `FUTURENET` | reset without notice     | Features ahead of testnet. Observations must record their boundary.                |
| `TESTNET`   | persistent but untrusted | Public test network. Identifiers carry no production meaning.                      |
| `MAINNET`   | authoritative            | Public production network. Mutating commands require explicit opt-in.              |
| `CUSTOM`    | operator defined         | Endpoints must be supplied; Amasario keeps no registry of private networks.        |

The taxonomy is **open** and sets `consumersMustHandleUnknown: true`. A consumer
that encounters an unrecognised type must require explicit operator confirmation
rather than assuming anything about it. The taxonomy states a specific prohibition
because the mistake is so natural:

> Code that treats "not MAINNET" as "safe to mutate" is prohibited.

The prohibition is there because the reasoning is backwards. An unrecognised network
is not a safe one; it is an unclassified one, and the safe assumption about an
unclassified environment is that it might be production.

## Endpoints

`rpcUrl` and `horizonUrl` are recorded because an endpoint is part of what was
observed: two RPC providers can disagree about retention, and a boundary is only
reproducible if the source of the observation is known. The specification does not
maintain a registry of endpoints, and it does not require one — it requires that
whatever was used be recorded.

## Protocol version

`protocolVersion` records the Stellar protocol version observed. Soroban's
capabilities are protocol-versioned, so an observation of contract behaviour is
qualified by the protocol version it was observed under. Without it, two
observations of "the same" contract at different protocol versions are not
comparable, and a future protocol change would silently invalidate historical
analysis.

## Error handling is part of the model

The network layer is where the specification's central distinction between _absence_
and _failure_ is enforced at the data level:

- A network error must never be converted into an empty result. "No dependency
  found" and "the request failed" are different outcomes and must be represented
  differently.
- A resolution that could not complete reports truncation with a reason.
  `dependency-set.schema.json` enumerates them: `MAX_DEPTH_REACHED`,
  `MAX_NODES_REACHED`, `EVIDENCE_UNAVAILABLE`, `BOUNDARY_REACHED`, `RATE_LIMITED`,
  `CANCELLED`.
- `schema/error.schema.json` gives errors a category — `NETWORK` is one of
  fourteen — and a `retryable` flag, so a caller can distinguish a transient
  condition from a permanent one. Failure classification must not be collapsed into
  a single generic error.

The `RATE_LIMITED` truncation reason exists because rate limiting is the most common
real cause of an incomplete traversal, and it is the one most easily mistaken for a
complete result. The `contract-with-dependencies` example declares truncation with a
reason for exactly this case.

## What Amasario does not claim about networks

The specification records what was observed, where, and within what boundary. It
does not claim that a network is available, that an endpoint is authoritative, or
that an observation would repeat. Those are properties of an environment at a time,
and the specification's model is that facts are qualified rather than asserted.

## Related chapters

- [temporal-model.md](temporal-model.md) — boundaries in full
- [dependency-resolution.md](dependency-resolution.md) — where observations come from
- [reproducibility.md](reproducibility.md) — what a repeat can and cannot establish
