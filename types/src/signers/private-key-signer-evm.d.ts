/**
 * Signer that wraps a raw private key in a memory-safe buffer, exposing a minimal
 * interface for signing messages, transactions and typed data. This signer does
 * not support derivation and always represents a single account.
 *
 * @implements {ISignerEvm}
 */
export default class PrivateKeySignerEvm implements ISignerEvm {
    /**
     * Create a signer from a raw private key.
     *
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
    private _path;
    /**
     * Whether this signer can derive child signers. Always false: a private-key signer is a
     * single standalone account and is bound directly to a wallet account.
     *
     * @type {boolean}
     */
    get isDerivable(): boolean;
    /**
     * The account index. Always undefined for private key signers: a raw key has no
     * BIP-44 position, so reporting an index would be misleading.
     *
     * @type {number|undefined}
     */
    get index(): number | undefined;
    /**
     * The derivation path. Always undefined for private key signers.
     *
     * @type {string|undefined}
     */
    get path(): string | undefined;
    /**
     * The account's address.
     *
     * @type {string}
     */
    get address(): string;
    /**
     * The account's key pair (private and public key buffers).
     *
     * @type {KeyPair}
     */
    get keyPair(): KeyPair;
    /**
     * Derive a child signer using a relative path (e.g., "0'/0/0").
     *
     * @param {string} relPath - The relative derivation path.
     * @returns {Promise<never>} Never resolves; private-key signers cannot derive.
     * @throws {SignerError} Always — private-key signers do not support derivation.
     */
    derive(relPath: string): Promise<never>;
    /**
     * Returns the account's address.
     *
     * @returns {Promise<string>} The account's address.
     */
    getAddress(): Promise<string>;
    /**
     * Signs a message.
     *
     * @param {string} message - The message to sign.
     * @returns {Promise<string>} The message's signature.
     */
    sign(message: string): Promise<string>;
    /**
     * Signs a transaction.
     *
     * @param {TransactionLike} tx - The transaction to sign.
     * @returns {Promise<string>} The signed transaction as a hex string.
     */
    signTransaction(tx: TransactionLike): Promise<string>;
    /**
     * Signs typed data according to EIP-712.
     *
     * @param {TypedData} typedData - The typed data to sign.
     * @returns {Promise<string>} The typed data signature.
     */
    signTypedData(typedData: TypedData): Promise<string>;
    /**
     * Signs an ERC-7702 authorization tuple.
     *
     * @param {AuthorizationRequest} auth - The authorization request.
     * @returns {Promise<Authorization>} The signed authorization.
     */
    signAuthorization(auth: AuthorizationRequest): Promise<Authorization>;
    /**
     * Disposes the signer, erasing its secrets from memory.
     */
    dispose(): void;
}
export type ISignerEvm = import("./signer-evm.js").ISignerEvm;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type SignerError = import("@tetherto/wdk-wallet").SignerError;
export type TransactionLike = import("ethers").TransactionLike;
export type AuthorizationRequest = import("ethers").AuthorizationRequest;
export type Authorization = import("ethers").Authorization;
export type TypedData = import("../wallet-account-read-only-evm.js").TypedData;
