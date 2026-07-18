/**
 * Interface for EVM signers, extending the base `ISigner` from `@tetherto/wdk-wallet`.
 *
 * @interface
 */
export class ISignerEvm extends ISigner {
    /**
     * Whether the signer supports account derivation via {@link derive}.
     *
     * @type {boolean}
     */
    get isDerivable(): boolean;
    /**
     * The signer's key pair, or null if the signer does not allow retrieving
     * key material (e.g. hardware signers).
     *
     * @type {KeyPair | null}
     */
    get keyPair(): KeyPair | null;
    /**
     * The last component index of the BIP 0044 derivation path.
     *
     * @type {number | null}
     */
    get index(): number | null;
    /**
     * The BIP 0044 derivation path.
     *
     * @type {string | null}
     */
    get path(): string | null;
    /**
     * The account's address, if available.
     *
     * @type {string | undefined}
     */
    get address(): string | undefined;
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
}
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type TransactionLike = import("ethers").TransactionLike;
export type AuthorizationRequest = import("ethers").AuthorizationRequest;
export type Authorization = import("ethers").Authorization;
export type TypedData = import("../wallet-account-read-only-evm.js").TypedData;
import { ISigner } from "@tetherto/wdk-wallet";
