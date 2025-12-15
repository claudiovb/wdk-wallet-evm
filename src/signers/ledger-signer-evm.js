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

/**
 * @implements {ISignerEvm}
 */
export default class LedgerSignerEvm {
  constructor (path, config = {}, opts = {}) {
    if (!path) {
      throw new Error('Path is required.')
    }

    this._config = config
    this._opts = opts
    this._dmk = opts.dmk
    this._account = undefined
    this._address = undefined
    this._sessionId = opts.sessionId || ''
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

  /**
   * Lazily initializes DMK connection, SignerEth and resolves address.
   * Safe to call multiple times; subsequent calls are no-ops.
   */
  async _ensureInitialized () {
    if (this._account && this._address && this._isActive) return

    // Ensure DMK
    if (!this._dmk) {
      this._dmk = new DeviceManagementKitBuilder().addTransport(webHidTransportFactory).build()
    }

    // Ensure session
    if (!this._sessionId) {
      try {
        const device = await firstValueFrom(this._dmk.startDiscovering({ }))
        this._sessionId = await this._dmk.connect({
          device,
          sessionRefresherOptions: { isRefresherDisabled: false, pollingInterval: 3000 }
        })
      } catch (e) {
        throw new Error(
          typeof e?.message === 'string'
            ? e.message
            : 'Failed to connect to Ledger device. Ensure WebHID is allowed, device is unlocked, and Ethereum app is open.'
        )
      }
    }

    // Ensure account
    if (!this._account) {
      this._account = new SignerEthBuilder({
        dmk: this._dmk,
        sessionId: this._sessionId
      }).build()
    }

    // Resolve address for this path
    if (!this._address) {
      const { observable } = this._account.getAddress(this._path)
      const address = await firstValueFrom(
        observable.pipe(
          filter((evt) => evt.status === DeviceActionStatus.Completed),
          map((evt) => evt.output.address)
        )
      )
      this._address = address
    }

    this._isActive = true
  }

  async getAddress () {
    await this._ensureInitialized()
    return this._address
  }

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
    const mergedOpts = {
      ...(this._opts || {}),
      dmk: this._dmk,
      sessionId: this._sessionId
    }
    return new LedgerSignerEvm(`${currentSuffix}/${relPath}`, mergedCfg, mergedOpts)
  }

  async sign (message) {
    await this._ensureInitialized()

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
    await this._ensureInitialized()

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
    await this._ensureInitialized()

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
