# Provenance Model

Provenance is the answer to a backwards question: given a contract observed on a
network, what produced the bytes it is running?

The specification models that answer as a chain with six joins, each of which can
be established, unestablished, or contradicted:

```
SOURCE            a repository and an immutable revision
  │ BUILT_FROM
BUILD             a recorded act of production: toolchain, config, inputs
  │ DERIVED_FROM
ARTIFACT          content-addressed outputs, including the WASM module
  │ DEPLOYED_AS
DEPLOYMENT        a transaction and a ledger that installed/instantiated it
  │ DEPLOYED_AS
CONTRACT          an address on a network hosting that executable
```

Only the rightmost node is directly observable from a network. Everything to the
left is either supplied by a builder, matched against a digest, or unknown. This
is why provenance is modelled as a chain of claims with evidence rather than as a
single "verified: true" field: at any moment, some joins are established and
others are not, and a consumer needs to know which.

## The record

`schema/provenance.schema.json` is the top-level document. It requires:

| Field                       | Why it is required                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apiVersion`, `specVersion` | A consumer must be able to tell which specification produced the document before interpreting anything else. |
| `contract`                  | The subject. A provenance document about nothing is not meaningful.                                          |
| `evidence` (min 1)          | A document with no evidence can support no claim, so it is malformed rather than weakly supported.           |
| `confidence`                | Required so that "no evidence" cannot masquerade as strong support.                                          |
| `verificationStatus`        | Required so that the outcome of comparing claim against evidence is always explicit.                         |
| `boundary`                  | Network plus ledger range. Without it the document is not reproducible.                                      |

Everything else — `wasm`, `source`, `build`, `artifacts`, `deployment`,
`dependencies`, `impact`, `attestations` — is optional, and _its absence is a
fact in itself_. An omitted `source` means source provenance was not established,
not that the contract has no source. A consumer that reads absence as "no source
exists" is misreading the document, and the specification states this in each
schema's description so the misreading is not a matter of interpretation.

## Why the chain is not a boolean

Consider a contract whose deployed WASM digest matches a locally rebuilt artifact,
where the rebuild used a recorded lockfile and toolchain. That establishes
`BUILT_FROM` and `DERIVED_FROM` for the WASM. It does not establish that the
claimed source revision is the revision actually used, unless the rebuild was
pinned to that revision and the toolchain identity was recorded and reproducible.
The correct outcome is `PARTIALLY_VERIFIED`, not `VERIFIED`.

Now consider the case where the claimed revision's rebuild produces a _different_
digest than the deployed module. That is not a weaker verification — it is a
contradiction. The specification requires `CONFLICTING`, and rule
`provenance/build-to-wasm` states that a digest mismatch must never be recorded as
`VERIFIED` or `PARTIALLY_VERIFIED`. A tool that cannot represent contradiction
will report one of those, and an incorrect `VERIFIED` is the most damaging output
this system can produce.

## Matching

Matching is the operation that turns two observed facts into a join. The
specification constrains how a match may be established:

- **Digest match** is conclusive for identity of bytes. Two artifacts with the same
  `sha256` are the same bytes.
- **Revision match** on an exact commit digest is conclusive for the source side of
  the chain. A branch or tag name is not: names move.
- **Interface observation** suggests a relationship and is never sufficient to
  establish one. It is recorded at `LOW_CONFIDENCE` and rule
  `dependency/direct-dependency` forbids presenting it as an established
  relationship.
- **Attestation** may establish a claim the verifier cannot re-derive, and is
  recorded at `HIGH_CONFIDENCE` with the attestation attached as evidence rather
  than folded into a boolean.

Where a match is ambiguous, the specification requires the ambiguity to be
recorded rather than resolved by preference. Rule `provenance/source-to-build`
states this explicitly, because a silent tie-break converts an ambiguous fact into
an authoritative-looking one.

## Digest algorithms

Every digest in the specification is a `digest` object with an explicit
`algorithm`. WASM artifacts are identified by `sha256`, which is also the algorithm
Stellar reports for a contract's executable hash, so a network-reported hash and a
locally computed hash are comparable without conversion. Recording the algorithm
per digest rather than fixing one globally is what allows a future migration
without invalidating existing records.

## Serialisation and identity

A provenance document's identity for comparison purposes is its canonical
serialisation. The specification defines a canonical order for set-valued fields
and states that `generatedAt` is not part of any digest, so two runs against the
same boundary and evidence can be compared byte-for-byte. Vectors under
`vectors/provenance/` pin this behaviour with recorded digests.

## Related chapters

- [contract-identity.md](contract-identity.md) — why an address is not an identity
- [wasm-identity.md](wasm-identity.md) — the executable side of the chain
- [source-identity.md](source-identity.md) — the source side of the chain
- [build-provenance.md](build-provenance.md) — the middle of the chain
- [artifact-model.md](artifact-model.md) — content-addressed nodes
- [deployment-model.md](deployment-model.md) — the chain's join to a network
- [verification.md](verification.md) — how the outcome is decided
- [reproducibility.md](reproducibility.md) — what a rebuild can and cannot prove
