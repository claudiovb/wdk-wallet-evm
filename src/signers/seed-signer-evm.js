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

import { InvalidSignerError, ValueError } from '@tetherto/wdk-wallet'

import MemorySafeHDNodeWallet from '../memory-safe/hd-node-wallet.js'

// Relative BIP-44 prefix for Ethereum (purpose'/coin_type'). Exported so callers that want
// "the standard Ethereum path" (WalletAccountEvm's seed overload, WalletManagerEvm's own
// internal default signer) can compose an absolute path without hardcoding it themselves.
export const BIP_44_ETH_DERIVATION_PATH_PREFIX = "44'/60'"

// Full absolute path of the account derived when none is provided.
const DEFAULT_ACCOUNT_PATH = `m/${BIP_44_ETH_DERIVATION_PATH_PREFIX}/0'/0/0`

/** @typedef {import('./signer-evm.js').ISignerEvm} ISignerEvm */
/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('ethers').TransactionLike} TransactionLike */
/** @typedef {import('ethers').AuthorizationRequest} AuthorizationRequest */
/** @typedef {import('ethers').Authorization} Authorization */
/** @typedef {import('../wallet-account-read-only-evm.js').TypedData} TypedData */
/** @typedef {import('../memory-safe/hd-node-wallet.js').default} MemorySafeHDNodeWallet */

/**
 * Signer implementation that derives keys from a BIP-39 seed using an HD path. Every signer
 * holds exactly one HD node (the Ethereum BIP-44 account at index 0 by default) and can derive
 * child signers below its own path. Each signer owns an independent copy of its key, so
 * disposing one never affects its parent, children or siblings.
 *
 * @implements {ISignerEvm}
 */
export default class SeedSignerEvm {
  /**
   * Create a SeedSignerEvm from a BIP-39 seed.
   *
   * @param {string|Uint8Array} seed - BIP-39 mnemonic or seed bytes.
   * @param {string} [path] - Absolute BIP-32 path (e.g. "m/44'/60'/0'/0/0"). Defaults to the Ethereum BIP-44 account at index 0.
   * @throws {ValueError} If no seed is provided.
   * @throws {ValueError} If a seed is provided but is not a valid BIP-39 mnemonic.
   */
  constructor (seed, path = DEFAULT_ACCOUNT_PATH) {
    if (!seed) {
      throw new ValueError('Seed is required.')
    }

    const root = MemorySafeHDNodeWallet.fromSeed(SeedSignerEvm._normalizeSeed(seed))
    const account = root.derivePath(path)
    // derivePath returns the root itself when path is "m"; scrub the master key
    // whenever the signer sits below it, so no signer keeps the root alive.
    if (account !== root) root.dispose()
    SeedSignerEvm._init(this, account)
  }

  /**
   * Whether this signer can derive child signers. Always true: every seed signer holds an
   * HD node with a private key and can derive below its own path.
   *
   * @type {boolean}
   */
  get isDerivable () {
    return true
  }

  /**
   * The signer's absolute derivation path.
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
   * Derive a child signer relative to this signer's own path (e.g. calling derive("0'/0/1") on
   * a signer at "m/44'/60'" yields a child at "m/44'/60'/0'/0/1"). Purely self-relative: no
   * coin-specific prefix is ever assumed or injected. The child owns an independent copy of
   * its key and can itself derive further.
   *
   * @param {string} relPath - The path segment to derive, relative to this signer's own path.
   * @returns {Promise<SeedSignerEvm>} The derived child signer.
   * @throws {InvalidSignerError} If the signer has been disposed.
   */
  async derive (relPath) {
    if (!this._account) {
      throw new InvalidSignerError('Cannot derive: the signer has been disposed.')
    }
    const signer = Object.create(SeedSignerEvm.prototype)
    SeedSignerEvm._init(signer, this._account.derivePath(relPath))
    return signer
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
  }

  /** @private */
  static _normalizeSeed (seed) {
    if (typeof seed !== 'string') return seed
    if (!bip39.validateMnemonic(seed)) {
      throw new ValueError('The seed phrase is invalid.')
    }
    return bip39.mnemonicToSeedSync(seed)
  }

  /** @private */
  static _init (signer, account) {
    signer._account = account
    signer._address = account.address
    signer._path = account.path
  }
}
