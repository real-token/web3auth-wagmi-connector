import type { AuthLoginParams, IProvider, IWeb3AuthModal } from "@web3auth/modal";

export interface Web3AuthConnectorParams {
  web3AuthInstance: IWeb3AuthModal;
  loginParams?: AuthLoginParams;
  id?: string;
  name?: string;
  type?: string;
}

export type Provider = IProvider;
