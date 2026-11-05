/**
 * Constants for CashLayer Private Payroll and eERC Protocol.
 */

import { Point } from "./types.js";

// ===========================================================================
// Network & Chain Identifiers
// ===========================================================================

export const AVALANCHE_MAINNET_CHAIN_ID = 43114;
export const AVALANCHE_FUJI_CHAIN_ID = 43113;
export const LOCAL_ANVIL_CHAIN_ID = 31337;

export const SUPPORTED_CHAIN_IDS = [
  AVALANCHE_MAINNET_CHAIN_ID,
  AVALANCHE_FUJI_CHAIN_ID,
  LOCAL_ANVIL_CHAIN_ID,
] as const;

export const DEFAULT_AVALANCHE_RPC = "https://api.avax.network/ext/bc/C/rpc";
export const DEFAULT_FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
export const DEFAULT_LOCAL_RPC = "http://127.0.0.1:8545";

// ===========================================================================
// Cryptographic Curve & Field Constants
// ===========================================================================

/**
 * BN254 / alt_bn128 scalar field prime (p)
 */
export const BN254_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * BabyJubjub subgroup order (l)
 */
export const BABYJUB_ORDER = 21888242871839275222246405745257275088614511777268538073601725287587578984328n;

/**
 * BabyJubjub Twisted Edwards curve parameters: a * x^2 + y^2 = 1 + d * x^2 * y^2
 */
export const BABYJUB_A = 168700n;
export const BABYJUB_D = 168696n;

/**
 * Base8 subgroup generator point from official @avalabs/eerc-sdk
 */
export const BASE8: Point = [
  5299619240641551281634865583518297030282874472190772894086521144482721001553n,
  16950150798460657717958625567821834550301663161624707787222815936182638968203n,
];

/**
 * Maximum safe compensation transfer amount enforced by Circom 51-bit range proofs: (2^51 - 1)
 */
export const MAX_SAFE_AMOUNT_51BIT = (1n << 51n) - 1n; // 2251799813685247n

// ===========================================================================
// eERC and Contract Event Topics (Keccak-256 Hashes)
// ===========================================================================

export const EVENT_TOPIC_PRIVATE_TRANSFER = "0x89e02c608fef9fef39ff43ee57ec777c5fe18600494cf8105c31754020a10972";
export const EVENT_TOPIC_PRIVATE_MINT = "0x403c683ee37351336c57d7cf2547b31ddcc9bebe75b2829ec9713606b04856f6";
export const EVENT_TOPIC_PRIVATE_BURN = "0x7856b3e9a59bc8bbefcb16f7ec62fdb3f6b4e76a6669ee3144a164b3ef1f0c2a";
export const EVENT_TOPIC_AUDITOR_CHANGED = "0x370cebe60c6f1dc77a6f3aeb5c234b07a51c4a16f2c20f18858f9fc242ab8be4";
export const EVENT_TOPIC_REGISTER = "0xca2e93b9e4a3faea8e4c76ef488a0b06b9b18360d5b54630a9e701a5fc5dc875";

export const EVENT_TOPIC_BATCH_CREATED = "0x53e410ddf33e085e7fc559868be22543e0618035ee5ec879d7146580cf2a40bf";
export const EVENT_TOPIC_BATCH_CONFIRMED = "0x50f977bf513ce474f85e49bbdf8f1a1aa4385be6d649ae51b660a9f5d3463a8a";
export const EVENT_TOPIC_COMPLIANCE_ATTESTED = "0x4feff84c6827f8a7e32a67a0572e0aeb1fba380fa05b82269c57d0f94ef3be19";
