/**
 * Signer implementation that derives keys from a BIP-39 seed using the BIP-44 Ethereum path.
 * Always holds a derived account (index 0 by default). A signer created from a seed also
 * retains the HD root and can derive child signers; a derived child holds only its own
 * account and cannot itself derive further.
 *
 * @implements {ISignerEvm}
 */
export default class SeedSignerEvm implements ISignerEvm {
    /** @private */
    private static _normalizeSeed;
    /** @private */
    private static _init;
    /**
     * Create a SeedSignerEvm from a BIP-39 seed.
     *
     * @param {string|Uint8Array} seed - BIP-39 mnemonic or seed bytes.
     * @param {string} [path] - Relative BIP-44 path segment (e.g. "0'/0/0"). Defaults to the account at index 0.
     * @throws {Error} If no seed is provided.
     * @throws {Error} If a seed is provided but is not a valid BIP-39 mnemonic.
     */
    constructor(seed: string | Uint8Array, path?: string);
    /** @private */
    private _account;
    /** @private */
    private _address;
    /** @private */
    private _path;
    /** @private */
    private _root;
    /**
     * Whether this signer can derive child signers. True for a signer created from a seed
     * (which retains the HD root); false for a derived child, which does not retain the root.
     *
     * @type {boolean}
     */
    get isDerivable(): boolean;
    /**
     * The BIP 0044 derivation path.
     *
     * @type {string}
     */
    get path(): string;
    /**
     * The account's derived address.
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
     * Derive a child signer using the provided relative path (e.g. "0'/0/0").
     *
     * @param {string} relPath - The relative BIP-44 path segment.
     * @returns {Promise<SeedSignerEvm>} The derived child signer.
     * @throws {Error} If called on a derived child signer, which does not retain the root.
     */
    derive(relPath: string): Promise<SeedSignerEvm>;
    /**
     * Returns the account's derived address.
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
/**
 * Memory-safe BIP-32 HD node (implemented by the internal src/memory-safe/hd-node-wallet.js)
 */
export type MemorySafeHDNodeWallet = {
    readonly address: string;
    readonly path: string | null;
    readonly index: number;
    readonly depth: number;
    readonly publicKey: string;
    readonly privateKeyBuffer: Uint8Array | undefined;
    readonly publicKeyBuffer: Uint8Array;
    deriveChild(index: number): MemorySafeHDNodeWallet;
    derivePath(path: string): MemorySafeHDNodeWallet;
    dispose(): void;
};
export type ISignerEvm = import("./signer-evm.js").ISignerEvm;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type TransactionLike = import("ethers").TransactionLike;
export type AuthorizationRequest = import("ethers").AuthorizationRequest;
export type Authorization = import("ethers").Authorization;
export type TypedData = import("../wallet-account-read-only-evm.js").TypedData;
