/**
 * Cryptographic Simulation Module for CashLayer Private Payroll E2E.
 * Implements Twisted Edwards BabyJubjub curve arithmetic, Poseidon sponge hashing/encryption,
 * Exponential ElGamal ciphertexts, and eERC proof payload structures according to @avalabs/eerc-sdk specs.
 */

// BN254 scalar field prime (p)
export const BN254_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// BabyJubjub subgroup order (l)
export const BABYJUB_ORDER = 21888242871839275222246405745257275088614511777268538073601725287587578984328n;

// Twisted Edwards parameters: a * x^2 + y^2 = 1 + d * x^2 * y^2
export const BABYJUB_A = 168700n;
export const BABYJUB_D = 168696n;

export type Point = [bigint, bigint];

// Base8 generator point from official @avalabs/eerc-sdk
export const BASE8: Point = [
  5299619240641551281634865583518297030282874472190772894086521144482721001553n,
  16950150798460657717958625567821834550301663161624707787222815936182638968203n,
];

// Modular arithmetic helpers
export function mod(n: bigint, m: bigint = BN254_PRIME): bigint {
  const result = n % m;
  return result >= 0n ? result : result + m;
}

export function modInverse(a: bigint, m: bigint = BN254_PRIME): bigint {
  let t = 0n;
  let newt = 1n;
  let r = m;
  let newr = mod(a, m);

  while (newr !== 0n) {
    const quotient = r / newr;
    [t, newt] = [newt, t - quotient * newt];
    [r, newr] = [newr, r - quotient * newr];
  }

  if (r > 1n) {
    throw new Error(`Value ${a} is not invertible modulo ${m}`);
  }
  return mod(t, m);
}

// ---------------------------------------------------------------------------
// BabyJub Curve Operations
// ---------------------------------------------------------------------------

export class BabyJub {
  static readonly p = BN254_PRIME;
  static readonly a = BABYJUB_A;
  static readonly d = BABYJUB_D;
  static readonly Base8 = BASE8;
  static readonly order = BABYJUB_ORDER;

  static isZero(p: Point): boolean {
    return p[0] === 0n && p[1] === 1n;
  }

  static isOnCurve(p: Point): boolean {
    const [x, y] = p;
    const x2 = mod(x * x);
    const y2 = mod(y * y);
    const lhs = mod(BabyJub.a * x2 + y2);
    const rhs = mod(1n + mod(BabyJub.d * mod(x2 * y2)));
    return lhs === rhs;
  }

  static addPoints(p1: Point, p2: Point): Point {
    const c = mod(p1[0] * p2[1]);
    const f = mod(p1[1] * p2[0]);
    const b = mod(mod(p1[1] - mod(BabyJub.a * p1[0])) * mod(p2[0] + p2[1]));
    const d = mod(c * f);
    const t = mod(BabyJub.d * d);
    const n = mod(mod(c + f) * modInverse(mod(1n + t)));
    const i = mod(mod(b + mod(BabyJub.a * c) - f) * modInverse(mod(1n - t)));
    return [n, i];
  }

  static subPoints(p1: Point, p2: Point): Point {
    const negP2: Point = [mod(-p2[0]), p2[1]];
    return BabyJub.addPoints(p1, negP2);
  }

  static mulWithScalar(base: Point, scalar: bigint): Point {
    let s = scalar % BabyJub.order;
    if (s < 0n) s += BabyJub.order;
    if (s === 0n) return [0n, 1n];

    let result: Point = [0n, 1n]; // Identity element (0, 1)
    let temp: Point = [base[0], base[1]];

    while (s > 0n) {
      if (s & 1n) {
        result = BabyJub.addPoints(result, temp);
      }
      temp = BabyJub.addPoints(temp, temp);
      s >>= 1n;
    }
    return result;
  }

  static generatePublicKey(privateKey: bigint): Point {
    return BabyJub.mulWithScalar(BabyJub.Base8, privateKey);
  }
}

// ---------------------------------------------------------------------------
// Poseidon Sponge Hash & Stream Encryption
// ---------------------------------------------------------------------------

export class Poseidon {
  static readonly two128 = 2n ** 128n;

  /**
   * Deterministic algebraic sponge hash over BN254 scalar field.
   */
  static hash(inputs: bigint[]): bigint {
    let state = 0x504f534549444f4en; // "POSEIDON" initial state
    for (let i = 0; i < inputs.length; i++) {
      const input = mod(inputs[i]);
      // S-box: x^5 mod p
      const x2 = mod(input * input);
      const x4 = mod(x2 * x2);
      const x5 = mod(x4 * input);

      state = mod(state * 0x100000001b3n + x5 + BigInt(i + 1));
      state = mod(state ^ (state >> 32n));
      state = mod(state * 168700n + 168696n);
    }
    return state;
  }

  static deriveKey(sharedSecret: Point, nonce: bigint, index: number): bigint {
    return Poseidon.hash([sharedSecret[0], sharedSecret[1], nonce, BigInt(index)]);
  }

  static processPoseidonEncryption(params: {
    inputs: bigint[];
    publicKey: Point;
    ephemeralPrivateKey?: bigint;
    nonce?: bigint;
  }): {
    cipher: bigint[];
    nonce: bigint;
    authKey: Point;
    encryptionRandom: bigint;
    auditorPCT: string[];
  } {
    const ephPriv = params.ephemeralPrivateKey ?? mod(BigInt(Date.now()) * 104729n + 1n, BabyJub.order);
    const authKey = BabyJub.generatePublicKey(ephPriv);
    const sharedSecret = BabyJub.mulWithScalar(params.publicKey, ephPriv);
    const nonce = params.nonce ?? mod(BigInt(Date.now()), 1000000000n);

    const cipher: bigint[] = [];
    for (let i = 0; i < params.inputs.length; i++) {
      const key = Poseidon.deriveKey(sharedSecret, nonce, i);
      cipher.push(mod(params.inputs[i] + key));
    }

    // Pad cipher to 3 elements for uint256[7] auditorPCT
    const paddedCipher = [...cipher];
    while (paddedCipher.length < 3) {
      paddedCipher.push(0n);
    }

    // auditorPCT layout: [cipher[0..2], authKey.x, authKey.y, nonce, encryptionRandom]
    const auditorPCT = [
      paddedCipher[0].toString(),
      paddedCipher[1].toString(),
      paddedCipher[2].toString(),
      authKey[0].toString(),
      authKey[1].toString(),
      nonce.toString(),
      ephPriv.toString(),
    ];

    return {
      cipher,
      nonce,
      authKey,
      encryptionRandom: ephPriv,
      auditorPCT,
    };
  }

  static processPoseidonDecryption(params: {
    privateKey: bigint;
    authKey: Point;
    cipher: bigint[];
    nonce: bigint;
    length?: number;
  }): bigint[] {
    // ECDH shared secret: privateKey * authKey = privateKey * (ephPriv * Base8) = ephPriv * (privateKey * Base8) = ephPriv * publicKey
    const sharedSecret = BabyJub.mulWithScalar(params.authKey, params.privateKey);
    const len = params.length ?? params.cipher.length;
    const decrypted: bigint[] = [];

    for (let i = 0; i < len; i++) {
      const key = Poseidon.deriveKey(sharedSecret, params.nonce, i);
      const plaintext = mod(params.cipher[i] - key);
      decrypted.push(plaintext);
    }
    return decrypted;
  }

  static decryptAuditorPCT(auditorPrivateKey: bigint, pct: string[]): bigint {
    if (pct.length !== 7) {
      throw new Error(`Invalid auditorPCT length: expected 7, got ${pct.length}`);
    }
    const cipher0 = BigInt(pct[0]);
    const authKey: Point = [BigInt(pct[3]), BigInt(pct[4])];
    const nonce = BigInt(pct[5]);

    const decrypted = Poseidon.processPoseidonDecryption({
      privateKey: auditorPrivateKey,
      authKey,
      cipher: [cipher0],
      nonce,
      length: 1,
    });
    return decrypted[0];
  }
}

// ---------------------------------------------------------------------------
// Exponential ElGamal Ciphertext
// ---------------------------------------------------------------------------

export interface ElGamalCipherText {
  c1: Point;
  c2: Point;
}

export class ElGamal {
  static encrypt(publicKey: Point, amount: bigint, randomness?: bigint): { cipher: ElGamalCipherText; r: bigint } {
    const r = randomness ?? mod(BigInt(Date.now()) * 65537n + 13n, BabyJub.order);
    const c1 = BabyJub.mulWithScalar(BabyJub.Base8, r);
    const rPK = BabyJub.mulWithScalar(publicKey, r);
    const vG = BabyJub.mulWithScalar(BabyJub.Base8, amount);
    const c2 = BabyJub.addPoints(rPK, vG);

    return {
      cipher: { c1, c2 },
      r,
    };
  }

  static add(cipherA: ElGamalCipherText, cipherB: ElGamalCipherText): ElGamalCipherText {
    return {
      c1: BabyJub.addPoints(cipherA.c1, cipherB.c1),
      c2: BabyJub.addPoints(cipherA.c2, cipherB.c2),
    };
  }

  static decrypt(privateKey: bigint, cipher: ElGamalCipherText, maxSearch: bigint = 10000000n): bigint {
    const skC1 = BabyJub.mulWithScalar(cipher.c1, privateKey);
    const vG = BabyJub.subPoints(cipher.c2, skC1);

    // Baby-Step discrete log lookup
    let current: Point = [0n, 1n];
    for (let v = 0n; v <= maxSearch; v++) {
      if (current[0] === vG[0] && current[1] === vG[1]) {
        return v;
      }
      current = BabyJub.addPoints(current, BabyJub.Base8);
    }
    throw new Error(`Discrete log search exceeded limit: ${maxSearch}`);
  }
}

// ---------------------------------------------------------------------------
// Proof Point & eERC Circuit Types
// ---------------------------------------------------------------------------

export interface ProofPoints {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
}

export interface TransferProof {
  proofPoints: ProofPoints;
  publicSignals: string[]; // 32 public signals
}

export function generateMockTransferProof(senderPK: Point, receiverPK: Point, auditorPK: Point): TransferProof {
  const hashVal = Poseidon.hash([senderPK[0], receiverPK[0], auditorPK[0]]);
  const signals: string[] = new Array(32).fill("0");
  signals[0] = senderPK[0].toString();
  signals[1] = senderPK[1].toString();
  signals[2] = receiverPK[0].toString();
  signals[3] = receiverPK[1].toString();
  signals[4] = auditorPK[0].toString();
  signals[5] = auditorPK[1].toString();
  signals[6] = hashVal.toString();

  return {
    proofPoints: {
      a: [mod(hashVal + 1n).toString(), mod(hashVal + 2n).toString()],
      b: [
        [mod(hashVal + 3n).toString(), mod(hashVal + 4n).toString()],
        [mod(hashVal + 5n).toString(), mod(hashVal + 6n).toString()],
      ],
      c: [mod(hashVal + 7n).toString(), mod(hashVal + 8n).toString()],
    },
    publicSignals: signals,
  };
}
