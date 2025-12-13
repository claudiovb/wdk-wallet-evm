'use strict'

import {
  DeviceActionStatus,
  DeviceManagementKitBuilder
} from '@ledgerhq/device-management-kit'
import { webHidTransportFactory } from '@ledgerhq/device-transport-kit-web-hid'
import { SignerEthBuilder } from '@ledgerhq/device-signer-kit-ethereum'
import { filter, firstValueFrom, map } from 'rxjs'
import { verifyMessage, Signature, Transaction, getBytes } from 'ethers'

const BIP_44_ETH_DERIVATION_PATH_PREFIX = "44'/60'"

// Simple shared connection/state across derived Ledger signers within the same runtime.
// We intentionally keep this minimal (no ref-count) and add proper lifecycle handling later.
const SHARED = {
  dmk: undefined,
  sessionId: '',
  account: undefined, // SignerEth
  device: undefined
}

// Internal token to guard constructor usage
const INTERNAL_TOKEN = Symbol('ledger-signer-evm-internal')

/**
 * @implements {ISignerEvm}
 */
export default class LedgerSignerEvm {
  /**
   * Creates a fully initialized child signer for the given path.
   * Ensures the DMK/session/signer are ready and resolves the address up-front.
   *
   * @param {string} path - Relative BIP-44 path suffix, e.g. "0'/0/0"
   * @param {object} [config]
   * @returns {Promise<LedgerSignerEvm>}
   */
  static async createChild (path, config = {}) {
    if (!path) throw new Error('Path is required.')

    // Reuse or create DMK
    if (!SHARED.dmk) {
      SHARED.dmk = new DeviceManagementKitBuilder().addTransport(webHidTransportFactory).build()
    }

    // Ensure connection/session
    if (!SHARED.sessionId) {
      try {
        const device = await firstValueFrom(SHARED.dmk.startDiscovering({ }))
        const sessionId = await SHARED.dmk.connect({
          device,
          sessionRefresherOptions: { isRefresherDisabled: false, pollingInterval: 3000 }
        })
        SHARED.sessionId = sessionId
        SHARED.device = device
      } catch (e) {
        throw new Error(
          typeof e?.message === 'string'
            ? e.message
            : 'Failed to connect to Ledger device. Ensure WebHID is allowed, device is unlocked, and Ethereum app is open.'
        )
      }
    }

    // Ensure hardware signer
    if (!SHARED.account) {
      SHARED.account = new SignerEthBuilder({
        dmk: SHARED.dmk,
        sessionId: SHARED.sessionId
      }).build()
    }

    // Resolve address for this path
    const fullPath = `${BIP_44_ETH_DERIVATION_PATH_PREFIX}/${path}`
    const { observable } = SHARED.account.getAddress(fullPath)
    const address = await firstValueFrom(
      observable.pipe(
        filter((evt) => evt.status === DeviceActionStatus.Completed),
        map((evt) => evt.output.address)
      )
    )

    // Create instance and bind initialized state
    const instance = new LedgerSignerEvm(path, config, INTERNAL_TOKEN)
    instance._dmk = SHARED.dmk
    instance._sessionId = SHARED.sessionId
    instance._account = SHARED.account
    instance._address = address
    instance._isActive = true

    return instance
  }

  constructor (path, config = {}, __token) {
    if (!path) {
      throw new Error('Path is required.')
    }
    if (__token !== INTERNAL_TOKEN) {
      throw new Error('Direct construction is not supported. Use LedgerSignerEvm.createChild(path, config).')
    }

    this._config = config
    this._dmk = SHARED.dmk
    this._account = undefined
    this._address = undefined
    this._sessionId = ''
    this._path = `${BIP_44_ETH_DERIVATION_PATH_PREFIX}/${path}`
    this._isActive = false
  }

  get isActive () {
    return this._isActive
  }

  get isRoot () { return false }
  get isPrivateKey () { return false }

  get index () {
    if (!this._path) return undefined
    return +this._path.split('/').pop()
  }

  get path () {
    return this._path
  }

  get config () {
    return this._config
  }

  get address () {
    return this._address
  }

  async getAddress () { return this._address }

  derive (relPath, cfg = {}) {
    const mergedCfg = {
      ...this._config,
      ...Object.fromEntries(
        Object.entries(cfg || {}).filter(([, v]) => v !== undefined)
      )
    }

    // Build the child path relative to the current one, avoiding double-prefixing
    const prefix = `${BIP_44_ETH_DERIVATION_PATH_PREFIX}/`
    const currentSuffix = this._path.startsWith(prefix) ? this._path.slice(prefix.length) : this._path
    const child = new LedgerSignerEvm(`${currentSuffix}/${relPath}`, mergedCfg, INTERNAL_TOKEN)
    // Inherit shared runtime state
    child._dmk = SHARED.dmk
    child._sessionId = SHARED.sessionId
    child._account = SHARED.account
    // Address is not pre-populated for derived signers; must be created via createChild for that path.
    return child
  }

  async sign (message) {
    if (!this._account || !this._address) {
      throw new Error('Ledger signer is not initialized. Construct it via LedgerSignerEvm.createChild(path, config).')
    }

    const { observable } = this._account.signMessage(this._path, message)
    const { r, s, v } = await firstValueFrom(
      observable.pipe(
        filter((evt) => evt.status === DeviceActionStatus.Completed),
        map((evt) => evt.output)
      )
    )

    return r.replace(/^0x/, '') + s.replace(/^0x/, '') + BigInt(v).toString(16)
  }

  async verify (message, signature) {
    if (!this._address) return false
    const addr = verifyMessage(message, signature)
    return addr.toLowerCase() === this._address.toLowerCase()
  }

  async signTransaction (unsignedTx) {
    if (!this._account || !this._address) {
      throw new Error('Ledger signer is not initialized. Construct it via LedgerSignerEvm.createChild(path, config).')
    }

    const tx = Transaction.from(unsignedTx)

    const { observable: signTransaction } = this._account.signTransaction(
      this._path,
      getBytes(tx.unsignedSerialized)
    )

    const { r, s, v } = await firstValueFrom(
      signTransaction.pipe(
        filter((evt) => evt.status === DeviceActionStatus.Completed),
        map((evt) => evt.output)
      )
    )

    tx.signature = Signature.from({ r, s, v })

    return tx.serialized
  }

  async signTypedData (domain, types, message) {
    if (!this._account || !this._address) {
      throw new Error('Ledger signer is not initialized. Construct it via LedgerSignerEvm.createChild(path, config).')
    }

    const [[primaryType]] = Object.entries(types)

    const { observable } = this._account.signTypedData(this._path, {
      domain,
      types,
      message,
      primaryType
    })
    const { r, s, v } = await firstValueFrom(
      observable.pipe(
        filter((evt) => evt.status === DeviceActionStatus.Completed),
        map((evt) => evt.output)
      )
    )

    return r.replace(/^0x/, '') + s.replace(/^0x/, '') + BigInt(v).toString(16)
  }

  dispose () {
    // Do not disconnect shared session here to avoid breaking other derived signers.
    // Proper ref-counted disposal will be added in a follow-up.
    this._account = undefined
    this._dmk = undefined
    this._sessionId = ''
    this._isActive = false
  }
}
