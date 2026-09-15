# Deployment Model

A deployment is the join between an executable and a contract address on a network.
`schema/deployment.schema.json` requires `contractId`, `network` and `status`, and
records the transaction and ledger that carried it where they could be established.

## The model

| Field                | Required | Meaning                                                |
| -------------------- | -------- | ------------------------------------------------------ |
| `contractId`         | yes      | The address that resulted.                             |
| `network`            | yes      | The network the deployment happened on.                |
| `status`             | yes      | What is known about the deployment.                    |
| `transaction`        | no       | The transaction that performed it.                     |
| `ledger`             | no       | The ledger it was included in.                         |
| `operation`          | no       | Zero-based operation index, where meaningful.          |
| `wasmHash`           | no       | The executable deployed.                               |
| `deploymentArtifact` | no       | The content submitted.                                 |
| `deployer`           | no       | The account that submitted it.                         |
| `upgradeOf`          | no       | The digest of the executable this deployment replaced. |
| `evidence`           | no       | Evidence references supporting the deployment claims.  |

## Statuses

`taxonomies/deployment-statuses.yaml` defines five statuses. They are ordered by
how much is established, and the ordering matters because a consumer needs to
distinguish "not known" from "known not to have happened".

| Status        | Establishes success | Meaning                                                                                          |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| `OBSERVED`    | no                  | A deployment record exists at the boundary; success and current effectiveness are unestablished. |
| `CONFIRMED`   | yes                 | Evidenced as successful and reported by the network at the boundary.                             |
| `UNCONFIRMED` | no                  | Attempted or reported, but the resulting contract could not be observed.                         |
| `FAILED`      | no                  | Evidenced as not having taken effect.                                                            |
| `UNKNOWN`     | no                  | Status could not be established.                                                                 |

`UNCONFIRMED` deliberately differs from `FAILED`. An attempt whose outcome is
unknown is not evidence of failure, and a consumer that treats it as failure will
draw the wrong conclusion about whether a contract exists. `CONFIRMED` requires
evidence that the transaction was successful and that the network reports the
contract at the boundary; it must not be asserted from a failed transaction.

## Why the deployment artifact and the contract are separate

An upload and an instantiation are two different operations. Soroban separates them:
an executable can be uploaded and never instantiated, or instantiated by a
different account than the one that uploaded it. `deploymentArtifact` records the
content that was submitted, while `contractId` records the address that resulted.
Conflating them hides the case where an upload was never instantiated, which is
exactly the case a provenance consumer needs to detect when a claimed deployment
does not correspond to a live contract.

## Why `upgradeOf` is a digest and not a reference

The prior executable may be one Amasario has never observed as an artifact, and the
placeholder has no artifact id to reference. Recording the prior digest lets an
upgrade be reconstructed even when only one side of it is in the corpus, and a
digest is the one identifier that survives that asymmetry.

## Rules

Rule `provenance/contract-to-deployment` and rule `impact/deployment-impact` make
the following normative:

- `status: CONFIRMED` requires at least deployment and transaction evidence, and
  the transaction must be recorded as successful. A deployment asserted from a
  failed transaction is a specification violation.
- `ledger` must be within the `boundary` of the document that contains it, where a
  boundary is stated.
- `operation` must be absent rather than guessed when the deployment was not
  established from a specific operation.
- A `wasmHash` on a deployment must be consistent with the `wasmHash` on the
  contract identity for the same `identityVersion`. A disagreement is a conflict.
- Deployment status must never be inferred from the mere existence of a contract
  address. An address can outlive a failed re-deployment attempt.

## Worked example

```yaml
contractId: CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE
network: { type: TESTNET, passphrase: 'Test SDF Network ; September 2015' }
status: CONFIRMED
transaction: { hash: '3b...9e', successful: true, ledger: 320 }
ledger: 320
wasmHash: { algorithm: sha256, value: '9d...4a' }
deploymentArtifact:
  id: art-deploy
  type: DEPLOYMENT_ARTIFACT
  digest: { algorithm: sha256, value: '9d...4a' }
deployer: GBL4XQSTN7W2KQ2VXQJ7M5YB4XQSTN7W2KQ2VXQJ7M5YB4XQSTN7W2KQ
evidence: [ev-deploy-tx, ev-contract-lookup]
```

The status is `CONFIRMED` because the transaction is recorded as successful and the
contract is reported at the boundary. Had the transaction not been inspectable, the
honest status would be `OBSERVED`, and had the contract lookup failed, it would be
`UNCONFIRMED`.
