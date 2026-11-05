import assert from "node:assert";
import {
  BabyJub,
  Poseidon,
  ElGamal,
  generateMockTransferProof,
} from "../src/crypto.js";
import { BASE8, Point, BABYJUB_ORDER } from "@cashlayer/shared";

console.log("==============================================================================");
console.log("   Running @cashlayer/eerc-adapter Cryptographic Unit Tests");
console.log("==============================================================================");

let passed = 0;
let failed = 0;

function it(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      res
        .then(() => {
          console.log(` ✔ ${name}`);
          passed++;
        })
        .catch((err) => {
          console.error(` ✘ ${name}`);
          console.error(err);
          failed++;
        });
    } else {
      console.log(` ✔ ${name}`);
      passed++;
    }
  } catch (err: any) {
    console.error(` ✘ ${name}`);
    console.error(err);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// BabyJubjub Curve Arithmetic Tests
// ---------------------------------------------------------------------------
it("BabyJub identity element (0, 1) is recognized as zero", () => {
  const identity: Point = [0n, 1n];
  assert.strictEqual(BabyJub.isZero(identity), true);
  assert.strictEqual(BabyJub.isOnCurve(identity), true);
});

it("BabyJub Base8 generator point lies on Twisted Edwards curve", () => {
  assert.strictEqual(BabyJub.isOnCurve(BASE8), true);
  assert.strictEqual(BabyJub.isZero(BASE8), false);
});

it("Point addition on curve produces valid points and satisfies identity", () => {
  const identity: Point = [0n, 1n];
  const p1 = BabyJub.addPoints(BASE8, identity);
  assert.strictEqual(p1[0], BASE8[0]);
  assert.strictEqual(p1[1], BASE8[1]);

  const p2 = BabyJub.addPoints(BASE8, BASE8);
  assert.strictEqual(BabyJub.isOnCurve(p2), true);
});

it("Point subtraction: P - P = (0, 1) identity", () => {
  const diff = BabyJub.subPoints(BASE8, BASE8);
  assert.strictEqual(BabyJub.isZero(diff), true);
});

it("Scalar multiplication matches double-and-add and identity multiplication", () => {
  const mult1 = BabyJub.mulWithScalar(BASE8, 1n);
  assert.strictEqual(mult1[0], BASE8[0]);
  assert.strictEqual(mult1[1], BASE8[1]);

  const mult2 = BabyJub.mulWithScalar(BASE8, 2n);
  const add2 = BabyJub.addPoints(BASE8, BASE8);
  assert.strictEqual(mult2[0], add2[0]);
  assert.strictEqual(mult2[1], add2[1]);

  const zeroMult = BabyJub.mulWithScalar(BASE8, 0n);
  assert.strictEqual(BabyJub.isZero(zeroMult), true);

  const orderMult = BabyJub.mulWithScalar(BASE8, BABYJUB_ORDER);
  assert.strictEqual(BabyJub.isZero(orderMult), true);
});

it("Deterministic public key generation from scalar", () => {
  const sk = 123456789n;
  const pk = BabyJub.generatePublicKey(sk);
  assert.strictEqual(BabyJub.isOnCurve(pk), true);
  assert.strictEqual(pk[0] > 0n, true);
  assert.strictEqual(pk[1] > 0n, true);
});

it("Derives secret key deterministically from EVM hex string", () => {
  const sk1 = BabyJub.deriveSecretKey("0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
  const sk2 = BabyJub.deriveSecretKey("0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
  assert.strictEqual(sk1, sk2);
  assert.strictEqual(sk1 > 0n, true);
});

// ---------------------------------------------------------------------------
// Poseidon Sponge Hashing Tests
// ---------------------------------------------------------------------------
it("Poseidon hash produces deterministic non-zero scalar in BN254 field", () => {
  const h1 = Poseidon.hash([100n, 200n, 300n]);
  const h2 = Poseidon.hash([100n, 200n, 300n]);
  assert.strictEqual(h1, h2);
  assert.strictEqual(h1 > 0n, true);

  const h3 = Poseidon.hash([100n, 200n, 301n]);
  assert.notStrictEqual(h1, h3);
});

// ---------------------------------------------------------------------------
// Poseidon Symmetric Encryption & Decryption Tests
// ---------------------------------------------------------------------------
it("Poseidon encryption and decryption roundtrip for single scalar", () => {
  const sk = 88888888n;
  const pk = BabyJub.generatePublicKey(sk);
  const secretAmount = 750000n;

  const enc = Poseidon.processPoseidonEncryption({
    inputs: [secretAmount],
    publicKey: pk,
    nonce: 42n,
  });

  assert.strictEqual(enc.auditorPCT.length, 7);

  const dec = Poseidon.processPoseidonDecryption({
    privateKey: sk,
    authKey: enc.authKey,
    cipher: enc.cipher,
    nonce: enc.nonce,
  });

  assert.strictEqual(dec[0], secretAmount);
});

it("Poseidon encryption produces valid uint256[7] auditorPCT format", () => {
  const sk = 99999999n;
  const pk = BabyJub.generatePublicKey(sk);
  const enc = Poseidon.processPoseidonEncryption({
    inputs: [50000n],
    publicKey: pk,
    nonce: 100n,
  });

  assert.strictEqual(enc.auditorPCT.length, 7);
  for (const item of enc.auditorPCT) {
    assert.strictEqual(typeof item, "string");
    assert.strictEqual(BigInt(item) >= 0n, true);
  }

  const decrypted = Poseidon.decryptAuditorPCT(sk, enc.auditorPCT);
  assert.strictEqual(decrypted, 50000n);
});

it("Poseidon decryption with incorrect private key produces different plaintext", () => {
  const skCorrect = 11111111n;
  const skWrong = 22222222n;
  const pk = BabyJub.generatePublicKey(skCorrect);
  const secret = 123456n;

  const enc = Poseidon.processPoseidonEncryption({
    inputs: [secret],
    publicKey: pk,
    nonce: 55n,
  });

  const decrypted = Poseidon.decryptAuditorPCT(skWrong, enc.auditorPCT);
  assert.notStrictEqual(decrypted, secret);
});

// ---------------------------------------------------------------------------
// Twisted ElGamal Tests
// ---------------------------------------------------------------------------
it("ElGamal encryption and decryption of single amount via discrete log", () => {
  const sk = 44444444n;
  const pk = BabyJub.generatePublicKey(sk);
  const amount = 3500n;

  const eg = ElGamal.encrypt(pk, amount, 17n);
  assert.strictEqual(BabyJub.isOnCurve(eg.cipher.c1), true);
  assert.strictEqual(BabyJub.isOnCurve(eg.cipher.c2), true);

  const decrypted = ElGamal.decrypt(sk, eg.cipher, 10000n);
  assert.strictEqual(decrypted, amount);
});

it("ElGamal homomorphic addition correctly sums two encrypted amounts", () => {
  const sk = 55555555n;
  const pk = BabyJub.generatePublicKey(sk);

  const eg1 = ElGamal.encrypt(pk, 1200n, 31n);
  const eg2 = ElGamal.encrypt(pk, 1800n, 43n);

  const sum = ElGamal.add(eg1.cipher, eg2.cipher);
  const decrypted = ElGamal.decrypt(sk, sum, 10000n);
  assert.strictEqual(decrypted, 3000n);
});

it("ElGamal discrete log throws when amount exceeds maxSearch limit", () => {
  const sk = 66666666n;
  const pk = BabyJub.generatePublicKey(sk);
  const eg = ElGamal.encrypt(pk, 5000n, 11n);

  assert.throws(
    () => ElGamal.decrypt(sk, eg.cipher, 100n),
    /Discrete log search exceeded limit/
  );
});

// ---------------------------------------------------------------------------
// Proof Generator Tests
// ---------------------------------------------------------------------------
it("generateMockTransferProof produces 32 public signals and valid Groth16 proof points", () => {
  const senderPK = BabyJub.generatePublicKey(11n);
  const receiverPK = BabyJub.generatePublicKey(22n);
  const auditorPK = BabyJub.generatePublicKey(33n);

  const proof = generateMockTransferProof(senderPK, receiverPK, auditorPK, 1000n);
  assert.strictEqual(proof.publicSignals.length, 32);
  assert.strictEqual(proof.proofPoints.a.length, 2);
  assert.strictEqual(proof.proofPoints.b.length, 2);
  assert.strictEqual(proof.proofPoints.c.length, 2);
  assert.strictEqual(proof.publicSignals[0], senderPK[0].toString());
  assert.strictEqual(proof.publicSignals[2], receiverPK[0].toString());
  assert.strictEqual(proof.publicSignals[4], auditorPK[0].toString());
});

console.log("------------------------------------------------------------------------------");
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("✔ ALL CRYPTO TESTS PASSED");
}
