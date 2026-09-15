# WASM Identity

## The problem

Six things are routinely conflated when people say where a contract "came from":

1. the contract address,
2. the hash of the deployed executable,
3. the source repository,
4. the source revision,
5. the build artifact,
6. the build configuration.

They are not interchangeable, and treating any pair as equivalent produces
provenance claims that cannot be checked. A repository can be rewritten while a
revision digest cannot; a build configuration can change while the source stays
fixed; a deployed hash can change while the address stays fixed.

`schema/wasm.schema.json` keeps all six distinct.

## The model

| Field                   | Required | Meaning                                                              |
| ----------------------- | -------- | -------------------------------------------------------------------- |
| `hash`                  | yes      | Content hash of the deployed executable.                             |
| `contractId`            | no       | The address it was observed at, when observed from a network.        |
| `sizeBytes`             | no       | Size in bytes, as a cheap drift check against the hash.              |
| `sourceRepository`      | no       | The repository this executable is _claimed_ to have been built from. |
| `sourceRevision`        | no       | The revision claimed for it.                                         |
| `buildArtifact`         | no       | The build artifact it was produced as.                               |
| `buildConfiguration`    | no       | A digest-addressed reference to the claimed build configuration.     |
| `deploymentTransaction` | no       | The transaction that deployed it.                                    |
| `reproducible`          | no       | `REPRODUCED`, `NOT_REPRODUCED` or `NOT_ATTEMPTED`.                   |
| `evidence`              | no       | Evidence references supporting the identity claim.                   |

Only `hash` is required, because a hash is the one fact that is both obtainable
from a network and sufficient to identify the bytes. Everything else is a claim
that may or may not have been established.

### Why `sourceRepository` is optional and why the schema calls it a claim

A contract can be deployed by anyone, from a private repository, or from a
repository that has since been deleted. Requiring `sourceRepository` would force
an implementation to invent a value or to refuse a perfectly valid observation. The
schema therefore labels it a claim, and the provenance rules require it to be
supported by source and build evidence before it is presented as established.

### Why `sourceRevision` is separate from `sourceRepository`

Because a repository is mutable and a revision digest is not. Storing only the
repository URL loses the ability to notice that a repository was force-pushed, and
makes two different revisions indistinguishable.

### Why `buildConfiguration` is a digest and not a structured object

Amasario models the _relationship_ between a build configuration and an executable,
not the toolchain's configuration format. Keeping the field as an opaque
digest-addressed reference means two configurations that differ in any way are
different references, while the specification avoids claiming to understand a
Cargo profile it has no business interpreting. An implementation that wants more
detail records it in `build` provenance, where toolchain identity lives.

### Why `sizeBytes` exists

A network reports both a hash and a size for a contract's executable. Recording
the size makes a faulty observation detectable: a matching hash with a mismatching
size indicates that something in the observation pipeline is wrong, and the
mismatch is a signal rather than noise.

### Why `reproducible` is tri-state

Absence means the question was not answered. `NOT_ATTEMPTED` means it was asked and
not answered. Collapsing those two into a boolean `false` would read as
"established as not reproducible", which is a claim no evidence supports. Tri-state
is the smallest representation that cannot be misread; see
[reproducibility.md](reproducibility.md).

## Rules

Rule `identity/wasm-identity` makes the following normative:

- `hash` must use `sha256` for `WASM` artifact type, matching the algorithm the
  Stellar network reports for a contract's executable hash, so a reported hash and
  a locally computed hash are directly comparable.
- A record claiming both `sourceRepository` and `sourceRevision` must be supported
  by source evidence for the revision, not merely for the repository.
- A `buildArtifact` claim must carry artifact evidence whose digest matches
  `hash`. A build artifact whose digest does not match the deployed hash is a
  contradiction and must be reported as `CONFLICTING`.
- `reproducible: REPRODUCED` requires at least one artifact or build evidence
  record establishing it; it must never be set from the outcome of an unrecorded
  rebuild.

Rule `provenance/build-to-wasm` carries the digest comparison itself: the deployed
`hash` is compared against the digest of the build artifact, and a mismatch is a
conflict, never a low-confidence match.

## Worked example

A deployed executable with a fully established chain:

```yaml
hash: { algorithm: sha256, value: '9d...4a' }
contractId: CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE
sizeBytes: 41984
sourceRepository: https://github.com/example/token-contract
sourceRevision: 6f9c2b1e4d8a7305c2f1b9e6a4d3c8f7b2a1905e
buildArtifact:
  type: WASM
  digest: { algorithm: sha256, value: '9d...4a' }
buildConfiguration: { algorithm: sha256, value: '1c...77' }
deploymentTransaction: '3b...9e'
reproducible: REPRODUCED
evidence: [ev-wasm-network, ev-build-artifact, ev-rebuild]
```

An executable with only a network observation:

```yaml
hash: { algorithm: sha256, value: '9d...4a' }
contractId: CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE
evidence: [ev-wasm-network]
```

Both are valid. The first supports a strong provenance claim; the second supports
exactly one claim — the bytes — and the specification requires the verification
status to reflect that difference rather than presenting the second as an
incomplete version of the first.
