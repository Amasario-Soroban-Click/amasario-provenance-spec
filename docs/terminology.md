# Terminology

Terms are defined here once and used with that meaning throughout the
specification. Where a term has a Stellar-specific meaning, the entry says so
explicitly, because conflating an Amasario model with a Stellar protocol fact is
the fastest way to write a specification that is subtly wrong.

## Entities

**Contract**
A deployed Soroban smart contract, identified at minimum by its contract address
and the network it lives on. In this specification a contract is an _entity_,
which means it has identity that survives re-deployment; the deployed bytes are a
separate, time-bound fact. See [contract-identity.md](contract-identity.md).

**Contract address**
The Stellar strkey encoding of a contract identifier: a `C...` string. This is a
Stellar fact. An address is not an identity: two different WASM modules can be
deployed to the same address over time.

**WASM artifact**
The WebAssembly module installed and instantiated for a contract. Identified by a
digest of its bytes. See [wasm-identity.md](wasm-identity.md).

**Artifact**
Any mechanically produced or consumed file whose identity rests on its content: a
source archive, a lockfile, a build output, a WASM module, a deployment artifact.
See [artifact-model.md](artifact-model.md).

**Source revision**
A specific commit or equivalent immutable revision of a source repository. A
branch or tag name is not a revision; where only a name is known, that is a weaker
fact and must be represented as such.

**Build**
A recorded act of producing an artifact from a source revision with a toolchain
and configuration. See [build-provenance.md](build-provenance.md).

**Deployment**
A recorded act of installing and/or instantiating an executable as a contract, on
a network, in a ledger. See [deployment-model.md](deployment-model.md).

**Evidence**
A record that supports or refutes a claim. Evidence is traceable to something a
reviewer can consult independently. See [evidence-model.md](evidence-model.md).

## Relationships

**Dependency**
A relationship in which the subject requires the object in order to function or to
be built, and where that requirement is supported by evidence. The word
_dependency_ is never used in this specification for a coincidence of naming,
ecosystem co-membership, or mutual mention.

**Edge**
A directed relationship between two entities, carrying its relationship type,
basis, evidence, confidence, network and observation boundary. See
[dependency-model.md](dependency-model.md).

**Direct dependency**
A dependency established from the subject itself, for example an observed
invocation from the subject, or a declared dependency in the subject's own build
inputs.

**Transitive dependency**
A dependency established through at least one intermediate entity. Every
transitive dependency must be existential: at least one concrete path must be
recorded. See [transitive-dependencies.md](transitive-dependencies.md).

**Basis**
The specific kind of observation that justifies an edge: an observed invocation, a
declared build input, a digest match, an issuer attestation, an interface
observation, or an inference. A basis is required for every dependency edge.

**Observation boundary**
The network and ledger range within which an observation was made. Facts are
qualified by it, so a fact observed at ledger _N_ on testnet is not silently
presented as a current mainnet fact. See [temporal-model.md](temporal-model.md).

## Assessment

**Confidence**
How strongly the available evidence supports a claim, as an ordering from
`UNKNOWN` to `VERIFIED`. Confidence describes the evidence, never the
trustworthiness of the subject. See [confidence-model.md](confidence-model.md).

**Verification status**
What the evidence says about a claim: `VERIFIED`, `PARTIALLY_VERIFIED`,
`UNVERIFIED`, `CONFLICTING`, `UNKNOWN`. Independent of confidence. See
[verification.md](verification.md).

**Conflicting**
The state in which evidence contradicts a claim, or two pieces of valid evidence
contradict each other. It takes precedence over every other verification status.
A claim with any contradicted component must be reported as `CONFLICTING`.

**Impact**
A potential consequence of a change to one entity for another entity. Impact is
_derived_, not observed: it is computed from the change-propagation semantics of
the relationships on a path. See [impact-model.md](impact-model.md).

**Propagation**
The direction in which a relationship carries a change. Declared per term in
`taxonomies/relationship-types.yaml` as `changePropagation`, and it is the only
permitted source of impact semantics. See
[impact-propagation.md](impact-propagation.md).

## Words this specification avoids

**"Secure", "safe", "malicious", "vulnerable".**
Amasario produces provenance, dependency and impact facts. It does not perform
security assessment, and no term in any taxonomy means "trustworthy". Using these
words to describe an Amasario output is a specification violation. See
[security.md](security.md).

**"The" dependency graph.**
There is no single dependency graph, only the graph derivable from a stated set of
evidence at a stated observation boundary.

**"Verified" as a standalone claim.**
Every use of `VERIFIED` is a statement that evidence was checked against a
specific claim and did not contradict it. It is not a property of a contract.
