/** @typedef {import('../utils/tx-populator-evm.js').UnsignedEvmTransaction} UnsignedEvmTransaction */
/** @typedef {import('./seed-signer-evm.js').ISignerEvm} ISignerEvm */
/**
 * @implements {ISignerEvm}
 * Signer that wraps a raw private key in a memory-safe buffer, exposing a minimal
 * interface for signing messages, transactions and typed data. This signer does
 * not support derivation and always represents a single account.
 */
export default class PrivateKeySignerEvm implements ISignerEvm {
    /**
     * @param {string|Uint8Array} privateKey - Hex string (with/without 0x) or raw key bytes.
     */
    constructor(privateKey: string | Uint8Array);
    /** @private */
    private _signingKey;
    /** @private */
    private _wallet;
    /** @private */
    private _address;
    /** @private */
    private _isRoot;
    /** @private */
    private _path;
    /** @type {boolean} */
    get isRoot(): boolean;
    /** @type {boolean} */
    get isPrivateKey(): boolean;
    /** @type {number} */
    get index(): number;
    /** @type {string|undefined} */
    get path(): string | undefined;
    /** @type {string} */
    get address(): string;
    /** @type {{privateKey: Uint8Array|null, publicKey: Uint8Array|null}} */
    get keyPair(): {
        privateKey: Uint8Array | null;
        publicKey: Uint8Array | null;
    };
    /**
     * PrivateKeySignerEvm is not a hierarchical signer and cannot derive.
     * @throws {Error}
     */
    derive(): void;
    /** @returns {Promise<string>} */
    getAddress(): Promise<string>;
    /**
     * Signs a message.
     *
     * @param {string} message - The message to sign.
     * @returns {Promise<string>} The message's signature.
     */
    sign(message: string): Promise<string>;
    /**
     * Signs a transaction and returns the serialized signed transaction hex.
     *
     * @param {UnsignedEvmTransaction} unsignedTx - The unsigned transaction object.
     * @returns {Promise<string>}
     */
    signTransaction(unsignedTx: UnsignedEvmTransaction): Promise<string>;
    /**
     * EIP-712 typed data signing.
     * @param {Record<string, any>} domain
     * @param {Record<string, any>} types
     * @param {Record<string, any>} message
     * @returns {Promise<string>}
     */
    signTypedData(domain: Record<string, any>, types: Record<string, any>, message: Record<string, any>): Promise<string>;
    /**
     * Sign an ERC-7702 authorization tuple.
     * @param {import('ethers').AuthorizationRequest} auth
     * @returns {Promise<import('ethers').Authorization>}
     */
    signAuthorization(auth: import('ethers').AuthorizationRequest): Promise<import('ethers').Authorization>;
    /** Dispose secrets from memory. */
    dispose(): void;
}
export type UnsignedEvmTransaction = import("../utils/tx-populator-evm.js").UnsignedEvmTransaction;
export type ISignerEvm = import("./seed-signer-evm.js").ISignerEvm;
import MemorySafeSigningKey from '../memory-safe/signing-key.js';
import { BaseWallet } from 'ethers';
