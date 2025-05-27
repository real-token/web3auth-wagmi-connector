import { ChainNotConfiguredError, createConnector } from "@wagmi/core";
import * as pkg from "@web3auth/modal";
import type { IProvider } from "@web3auth/no-modal";
import { Chain, getAddress, SwitchChainError, UserRejectedRequestError } from "viem";

import type { Provider, Web3AuthConnectorParams } from "./interfaces";

const { CONNECTOR_STATUS, log, WALLET_CONNECTORS } = pkg;
export function Web3AuthConnector(parameters: Web3AuthConnectorParams) {
  let walletProvider: Provider | null = null;

  const { web3AuthInstance, loginParams, id, name, type } = parameters;

  return createConnector<Provider>((config) => ({
    id: id || "web3auth",
    name: name || "Web3Auth",
    type: type || "Web3Auth",
    async connect({ chainId }: { chainId?: number } = {}) {
      try {
        config.emitter.emit("message", {
          type: "connecting",
        });
        const provider = await this.getProvider();

        provider.on("accountsChanged", this.onAccountsChanged);
        provider.on("chainChanged", this.onChainChanged);
        provider.on("disconnect", this.onDisconnect.bind(this));

        if (!web3AuthInstance.connected) {
          if (!loginParams) {
            await web3AuthInstance.connect();
          } else if (loginParams) {
            const { email } = web3AuthInstance.coreOptions as unknown as { email: string };
            await web3AuthInstance.connectTo<typeof WALLET_CONNECTORS.AUTH>(WALLET_CONNECTORS.AUTH, {
              ...loginParams,
              extraLoginOptions: { ...loginParams.extraLoginOptions, login_hint: email },
            });
          }
        }

        let currentChainId = await this.getChainId();
        if (chainId && currentChainId !== chainId) {
          const chain = await this.switchChain!({ chainId }).catch((error) => {
            if (error.code === UserRejectedRequestError.code) throw error;
            return { id: currentChainId };
          });
          currentChainId = chain?.id ?? currentChainId;
        }

        const accounts = await this.getAccounts();

        return { accounts, chainId: currentChainId };
      } catch (error) {
        log.error("error while connecting", error);
        this.onDisconnect();
        throw new UserRejectedRequestError("Something went wrong" as unknown as Error);
      }
    },
    async getAccounts() {
      const provider: IProvider = await this.getProvider();
      return (
        await provider.request<unknown, string[]>({
          method: "eth_accounts",
        })
      ).map((x: string) => getAddress(x));
    },
    async getChainId() {
      const provider: IProvider = await this.getProvider();
      const chainId = await provider.request<unknown, number>({ method: "eth_chainId" });
      return Number(chainId);
    },
    async getProvider(): Promise<Provider> {
      if (walletProvider) {
        return walletProvider;
      }
      if (web3AuthInstance.status === CONNECTOR_STATUS.NOT_READY) {
        await web3AuthInstance.init();
      }

      walletProvider = web3AuthInstance.provider;
      return walletProvider;
    },
    async isAuthorized() {
      try {
        const accounts = await this.getAccounts();
        return !!accounts.length;
      } catch {
        return false;
      }
    },
    async switchChain({ chainId }): Promise<Chain> {
      try {
        const chain = config.chains.find((x) => x.id === chainId);
        if (!chain) throw new SwitchChainError(new ChainNotConfiguredError());
        log.info("Chain Added: ", chain.name);
        await web3AuthInstance.switchChain({ chainId: `0x${chain.id.toString(16)}` });
        log.info("Chain Switched to ", chain.name);
        config.emitter.emit("change", {
          chainId,
        });
        return chain;
      } catch (error: unknown) {
        log.error("Error: Cannot change chain", error);
        throw new SwitchChainError(error as Error);
      }
    },
    async disconnect(): Promise<void> {
      await web3AuthInstance.logout();
      const provider = await this.getProvider();
      provider.removeListener("accountsChanged", this.onAccountsChanged);
      provider.removeListener("chainChanged", this.onChainChanged);
    },
    onAccountsChanged(accounts) {
      if (accounts.length === 0) config.emitter.emit("disconnect");
      else
        config.emitter.emit("change", {
          accounts: accounts.map((x) => getAddress(x)),
        });
    },
    onChainChanged(chain) {
      const chainId = Number(chain);
      config.emitter.emit("change", { chainId });
    },
    onDisconnect(): void {
      config.emitter.emit("disconnect");
    },
  }));
}
