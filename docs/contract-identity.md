# Contract Identity

## The problem

A Soroban contract address is a 56-character Stellar strkey value beginning with
`C`. It is stable, it is what a network returns, and it is what every tool exposes.
It is also **not an identity**, for three independent reasons:

1. An address is unique only within a network. The same strkey on testnet and
   mainnet denote unrelated contracts.
2. An address can host different executables over time. Soroban contracts can be
   upgraded, so "the contract at `C...`" is not a statement about any particular
   bytes.
3. An address says nothing about origin. It establishes no source revision, no
   build, and no deployment record by itself.

Any model that treats an address as sufficient identity will silently conflate
contracts, or silently conflate two versions of one contract. Both failures are
unrecoverable downstream because every derived relationship inherits the
ambiguity.

## The model

`schema/contract.schema.json` defines identity as a combination, not a string.

| Field                   | Required | Meaning                                                               |
| ----------------------- | -------- | --------------------------------------------------------------------- |
| `contractId`            | yes      | The strkey address. Shape-checked by `^C[A-Z2-7]{55}$`.               |
| `network`               | yes      | The network the identity was observed on.                             |
| `identityVersion`       | yes      | Increments whenever an identity-defining field changes.               |
| `wasmHash`              | no       | The executable the address hosted at this identity version.           |
| `ledgerSequence`        | no       | The ledger at which this identity was most recently established.      |
| `firstObservedLedger`   | no       | Earliest ledger at which Amasario observed the address.               |
| `lastObservedLedger`    | no       | Latest ledger at which this identity was observed to hold.            |
| `deploymentTransaction` | no       | The transaction that created the contract, when identifiable.         |
| `deploymentOperation`   | no       | Zero-based operation index within that transaction, where meaningful. |
| `executableType`        | no       | `WASM`, `STELLAR_ASSET` or `UNKNOWN`.                                 |
| `upgradeHistory`        | no       | Observed executable changes, ascending by ledger.                     |
| `evidence`              | no       | Evidence references supporting the identity claim.                    |

### On the address pattern

The pattern checks shape only. Stellar strkey encodes a CRC16 checksum, and a
consumer that needs to reject forged addresses must verify that checksum itself.
The schema says this in the field description rather than pretending the pattern
is a full validation, because a pattern that looks authoritative and is not is
worse than no pattern.

### On `identityVersion`

`identityVersion` exists because the alternative — allowing one record to be
mutated in place — destroys the ability to distinguish "this contract changed" from
"we observed it differently". Two records sharing a `contractId` and differing in
`identityVersion` are two identities, not two observations of one. An
implementation that overwrites the record loses exactly the information an upgrade
analysis needs.

### On `executableType`

A Stellar Asset Contract is a built-in executable and has no user-uploaded WASM
module. Requiring `wasmHash` for every contract would therefore force an
implementation to invent a value for a large and important class of contracts. The
enumeration makes the distinction explicit and lets `wasmHash` stay optional
without becoming ambiguous.

### On observed versus created

`firstObservedLedger` is an observation, not a creation fact. The true creation
ledger can be earlier than the earliest ledger an implementation queried, and the
field description says so. A consumer that reports `firstObservedLedger` as "the
contract was deployed at this ledger" has upgraded an observation into a claim the
evidence does not support.

### On upgrade history

`upgradeHistory` records observed changes of the executable behind an address, each
with at least one evidence reference. It exists so that "the address is the same"
cannot be mistaken for "the executable is the same", which is the single most
common provenance error in contract systems.

## Rules

Rule `identity/contract-identity` makes the following normative:

- `lastObservedLedger` must not be less than `firstObservedLedger`. JSON Schema
  cannot express a comparison between two properties, so this is a rule.
- `upgradeHistory` must be in ascending ledger order and must not contain two
  entries for the same ledger.
- A record with a `wasmHash` must reference evidence for it. An executable change
  without evidence is not assertable.
- `identityVersion` must increase when `wasmHash` changes, and must not increase
  when no identity-defining field changes.

## Worked example

A contract observed on testnet whose executable was replaced at ledger 500:

```yaml
contractId: CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE
network: { type: TESTNET, passphrase: 'Test SDF Network ; September 2015' }
identityVersion: 2
wasmHash: { algorithm: sha256, value: '0f...c1' }
firstObservedLedger: 320
lastObservedLedger: 640
deploymentTransaction: '3b...9e'
upgradeHistory:
  - ledger: 500
    wasmHash: { algorithm: sha256, value: '0f...c1' }
    evidence: [ev-upgrade-500]
```

Reading this: the address was first seen at ledger 320, was upgraded at ledger 500,
and is now at identity version 2. A consumer comparing this to a snapshot whose
`wasmHash` was the pre-500 value will see a _changed WASM identity_, not a
conflicting observation, because `identityVersion` distinguishes them.
