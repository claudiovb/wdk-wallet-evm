// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
'use strict'

import * as bip39 from 'bip39'

import MemorySafeHDNodeWallet from '../memory-safe/hd-node-wallet.js'

const BIP_44_ETH_DERIVATION_PATH_PREFIX = "m/44'/60'"

// Relative path of the account derived when none is provided.
const DEFAULT_ACCOUNT_PATH = "0'/0/0"

/** @typedef {import('./signer-evm.js').ISignerEvm} ISignerEvm */
/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('ethers').TransactionLike} TransactionLike */
/** @typedef {import('ethers').AuthorizationRequest} AuthorizationRequest */
/** @typedef {import('ethers').Authorization} Authorization */
/** @typedef {import('../wallet-account-read-only-evm.js').TypedData} TypedData */
/** @typedef {import('../memory-safe/hd-node-wallet.js').default} MemorySafeHDNodeWallet */

/**
 * @typedef {Object} SeedSignerEvmOpts
 * @property {MemorySafeHDNodeWallet} [root] - An existing HD node wallet root to derive from.
 * @property {string} [path] - Relative BIP-44 path segment (e.g. "0'/0/0"). Defaults to the account at index 0.
 * @property {boolean} [isChild] - When true, the signer is a derived child and does not retain the root.
 */

/**
 * Signer implementation that derives keys from a BIP-39 seed using the BIP-44 Ethereum path.
 * Always holds a derived account (index 0 by default). A root signer also retains the HD root
 * and can derive child signers; a derived child holds only its own account.
 *
 * @implements {ISignerEvm}
 */
export default class SeedSignerEvm {
  /**
   * Create a SeedSignerEvm.
   * Provide either a mnemonic/seed or an existing root via opts.root (for children root is not stored internally)
   *
   * @param {string|Uint8Array|null} seed - BIP-39 mnemonic or seed bytes. Omit when providing `opts.root`.
   * @param {SeedSignerEvmOpts} [opts] - Construction options for root reuse, direct child derivation or path definition (default is index 0).
   * @throws {Error} If neither a seed nor a root is provided, or if both are provided.
   * @throws {Error} If a seed is provided but is not a valid BIP-39 mnemonic.
   */
  constructor (seed, opts = {}) {
    // If a root is provided, do not expect a seed
    if (opts.root && seed) {
      throw new Error('Provide either a seed or a root, not both.')
    }

    if (!opts.root && !seed) {
      throw new Error('Seed or root is required.')
    }

    if (typeof seed === 'string') {
      if (!bip39.validateMnemonic(seed)) {
        throw new Error('The seed phrase is invalid.')
      }
      seed = bip39.mnemonicToSeedSync(seed)
    }

    const root = opts.root || (seed ? MemorySafeHDNodeWallet.fromSeed(seed) : undefined)

    const fullPath = `${BIP_44_ETH_DERIVATION_PATH_PREFIX}/${opts.path || DEFAULT_ACCOUNT_PATH}`
    const account = root.derivePath(fullPath)

    if (opts.isChild && !opts.root) root.dispose()

    /** @private */
    this._account = account
    /** @private */
    this._address = account.address
    /** @private */
    this._path = fullPath
    /** @private */
    this._root = opts.isChild ? undefined : root
  }

  /**
   * Whether this signer can derive child signers. True for a root signer (which holds the
   * HD root); false for a derived child, which does not retain the root.
   *
   * @type {boolean}
   */
  get isDerivable () {
    return Boolean(this._root)
  }

  /**
   * The last component index of the derivation path.
   *
   * @type {number}
   */
  get index () {
    return +this._path.split('/').pop()
  }

  /**
   * The full derivation path of this signer's account.
   *
   * @type {string}
   */
  get path () {
    return this._path
  }

  /**
   * The account's derived address.
   *
   * @type {string}
   */
  get address () {
    return this._address
  }

  /**
   * The account's key pair (private and public key buffers).
   *
   * @type {KeyPair}
   */
  get keyPair () {
    return {
      privateKey: this._account ? this._account.privateKeyBuffer : null,
      publicKey: this._account ? this._account.publicKeyBuffer : null
    }
  }

  /**
   * Derive a child signer using the provided relative path (e.g. "0'/0/0").
   *
   * @param {string} relPath - The relative BIP-44 path segment.
   * @returns {Promise<SeedSignerEvm>} The derived child signer.
   * @throws {Error} If called on a derived child signer, which does not retain the root.
   */
  async derive (relPath) {
    if (!this._root) {
      throw new Error('Cannot derive: this signer has no root (it is a derived child or has been disposed).')
    }
    return new SeedSignerEvm(null, { root: this._root, path: relPath, isChild: true })
  }

  /**
   * Returns the account's derived address.
   *
   * @returns {Promise<string>} The account's address.
   */
  async getAddress () {
    return this._address
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    return this._account.signMessage(message)
  }

  /**
   * Signs a transaction.
   *
   * @param {TransactionLike} tx - The transaction to sign.
   * @returns {Promise<string>} The signed transaction as a hex string.
   */
  async signTransaction (tx) {
    return this._account.signTransaction(tx)
  }

  /**
   * Signs typed data according to EIP-712.
   *
   * @param {TypedData} typedData - The typed data to sign.
   * @returns {Promise<string>} The typed data signature.
   */
  async signTypedData ({ domain, types, message }) {
    return this._account.signTypedData(domain, types, message)
  }

  /**
   * Signs an ERC-7702 authorization tuple.
   *
   * @param {AuthorizationRequest} auth - The authorization request.
   * @returns {Promise<Authorization>} The signed authorization.
   */
  async signAuthorization (auth) {
    return this._account.authorizeSync(auth)
  }

  /**
   * Disposes the signer, erasing its secrets from memory.
   */
  dispose () {
    if (this._account) this._account.dispose()
    this._account = undefined
    if (this._root) this._root.dispose()
    this._root = undefined
  }
}
