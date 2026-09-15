# Reproducibility

Reproducibility is the ability to re-derive an artifact from its declared inputs and
obtain the same digest. It is the strongest form of provenance evidence, because it
is checkable by repetition rather than by trust.

It is also commonly overstated. This chapter states what the specification models,
and — more importantly — what a reproduction does and does not establish.

## The values

Two enumerations exist, and their differences are deliberate.

**On artifacts and WASM identity** — `REPRODUCED`, `NOT_REPRODUCED`,
`NOT_ATTEMPTED`, `UNKNOWN`.

**On build provenance** — `REPRODUCED`, `REPRODUCED_BY_THIRD_PARTY`,
`NOT_REPRODUCED`, `NOT_ATTEMPTED`, `UNKNOWN`.

| Value                       | Meaning                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `REPRODUCED`                | The producer re-derived the artifact from its declared inputs and got the same digest. |
| `REPRODUCED_BY_THIRD_PARTY` | An independent party re-derived it from the published inputs and got the same digest.  |
| `NOT_REPRODUCED`            | A reproduction was attempted and produced a different result.                          |
| `NOT_ATTEMPTED`             | The question was asked and not answered.                                               |
| `UNKNOWN`                   | The question could not be answered at this specification version.                      |

### Why `REPRODUCED_BY_THIRD_PARTY` is separate

A producer reproducing its own build is different evidence from an independent party
reproducing it. The producer may hold unpublished state that affects the output; an
independent reproduction from published inputs is the claim that matters to someone
else. Collapsing them into one value would make the weaker evidence look like the
stronger, which is the opposite of what a provenance record is for.

### Why absence is not `NOT_REPRODUCED`

An absent field means the question was not answered. `NOT_ATTEMPTED` means it was
asked and not answered. These are different, and neither is `NOT_REPRODUCED`, which
is a result — a reproduction was attempted and disagreed. Collapsing them into a
boolean `false` would read as "established as not reproducible", which is a claim no
evidence supports. Tri-state (and its five-value build variant) is the smallest
representation that cannot be misread.

## What a reproduction establishes

A successful reproduction establishes that the artifact's digest is a deterministic
function of the declared inputs: source revision, toolchain, configuration and
resolved lockfile. Combined with a matching deployed hash, that is a strong
`BUILT_FROM` and `DERIVED_FROM` chain.

## What it does not establish

A reproduction is often described as proving "the contract's source code". It proves
nothing of the sort. Correctly stated, it establishes:

- **Which revision produced the bytes.** Not that the revision is the one the owner
  intended, and not that anyone reviewed it.
- **Nothing about deployment.** A reproduced artifact is not evidence that the
  artifact was deployed, or that it remains deployed. Deployment is a separate join
  with its own evidence — see [deployment-model.md](deployment-model.md).
- **Nothing about behaviour or safety.** A reproduced artifact can be a backdoor.
  The specification's `VERIFIED` describes evidence completeness, and this is the
  case that most clearly shows why the two must not be conflated. See
  [security.md](security.md).
- **Nothing about the build having been honest.** A producer that re-runs the same
  build script gets the same output whether or not the script does what its inputs
  claim. `REPRODUCED_BY_THIRD_PARTY` addresses this partly, but only if the third
  party rebuilt from independent inputs.

## The mismatch case

A reproduction that produces a **different digest** is the most valuable signal the
mechanism can produce, and it is the case the specification is built to represent.
Rule `provenance/build-to-wasm` requires it to be recorded as `CONFLICTING`, and it
must never be downgraded to `VERIFIED` or `PARTIALLY_VERIFIED`.

The `provenance/mismatched-wasm` fixture is exactly this case and is validated in
CI. Its existence is the reason the `CONFLICTING` status is not optional: without
it, an implementation facing a mismatch must either claim verification it cannot
support or discard the finding.

## Determinism requirements

For a reproduction to be meaningful, the inputs must be fully specified:

- source revision as an immutable digest, never a branch name;
- toolchain identity recorded verbatim;
- configuration identified by digest;
- lockfile present as an artifact with a digest;
- target recorded.

If any of these is missing, a reproduction attempt is not comparable to another, and
the correct value is `NOT_ATTEMPTED` or `UNKNOWN` — not `REPRODUCED`. The
specification would rather record an incomplete chain than a strong claim resting on
unrecorded inputs.

## Across environments

A reproduction on a different network or in a different protocol version is a
different question. Results are qualified by the boundary they were obtained within,
and comparing a `MAINNET` observation with a `TESTNET` reproduction is not a
reproduction at all. The `BOUNDARY_ORDER_INVALID` and `NETWORK_MISMATCH`
incomparable reasons in `schema/diff.schema.json` exist so that this comparison is
refused explicitly rather than producing a plausible-looking difference.

## Related chapters

- [build-provenance.md](build-provenance.md) — where reproducibility is recorded
- [verification.md](verification.md) — how a mismatch becomes `CONFLICTING`
- [security.md](security.md) — why this is not a safety statement
- [confidence-model.md](confidence-model.md) — how the method caps the level
