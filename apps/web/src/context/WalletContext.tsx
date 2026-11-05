import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { DEMO_ACCOUNTS } from "../data/demoAccounts";
import { DemoAccount, PersonaRole } from "../types";
import {
  AVALANCHE_MAINNET_CHAIN_ID,
  AVALANCHE_FUJI_CHAIN_ID,
  LOCAL_ANVIL_CHAIN_ID,
  SUPPORTED_CHAIN_IDS,
} from "@cashlayer/shared";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  WalletClient,
  PublicClient,
  Chain,
} from "viem";
import { avalanche, avalancheFuji } from "viem/chains";

// Local anvil chain configuration
const anvilChain: Chain = {
  id: LOCAL_ANVIL_CHAIN_ID,
  name: "Local Anvil L1",
  nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
};

const getViemChain = (cid: number): Chain => {
  if (cid === AVALANCHE_FUJI_CHAIN_ID) return avalancheFuji;
  if (cid === LOCAL_ANVIL_CHAIN_ID) return anvilChain;
  return avalanche;
};

export type WalletProviderType = "metamask" | "core" | "injected" | "demo";

interface WalletContextType {
  account: `0x${string}` | null;
  activeAccount: DemoAccount;
  chainId: number;
  isConnected: boolean;
  isNetworkValid: boolean;
  networkError: string | null;
  activeRole: PersonaRole;
  walletProviderType: WalletProviderType;
  isRealWalletConnected: boolean;
  publicClient: PublicClient | null;
  walletClient: WalletClient | null;
  setActiveRole: (role: PersonaRole) => void;
  selectDemoAccount: (id: string) => void;
  connectInjectedWallet: () => Promise<void>;
  connectWallet: (customAddress?: `0x${string}`, targetChainId?: number) => void;
  disconnectWallet: () => void;
  switchNetwork: (targetChainId: number) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeAccount, setActiveAccount] = useState<DemoAccount>(DEMO_ACCOUNTS[0]);
  const [activeRole, setActiveRoleState] = useState<PersonaRole>("employer");
  const [chainId, setChainId] = useState<number>(AVALANCHE_MAINNET_CHAIN_ID);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [walletProviderType, setWalletProviderType] = useState<WalletProviderType>("demo");
  const [realAddress, setRealAddress] = useState<`0x${string}` | null>(null);

  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  const isNetworkValid = (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);

  // Initialize public client whenever chainId changes
  useEffect(() => {
    const chain = getViemChain(chainId);
    const client = createPublicClient({
      chain,
      transport: typeof window !== "undefined" && (window as any).ethereum
        ? custom((window as any).ethereum)
        : http(),
    });
    setPublicClient(client);
  }, [chainId]);

  // Handle Ethereum provider events (MetaMask, Core, Rabby)
  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    const ethereum = (window as any).ethereum;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setIsConnected(false);
        setRealAddress(null);
        setWalletProviderType("demo");
      } else {
        const addr = accounts[0] as `0x${string}`;
        setRealAddress(addr);
        setIsConnected(true);
      }
    };

    const handleChainChanged = (hexChainId: string) => {
      const parsed = parseInt(hexChainId, 16);
      setChainId(parsed);
      if (!(SUPPORTED_CHAIN_IDS as readonly number[]).includes(parsed)) {
        setNetworkError(`Connected to chain ${parsed}. Please switch to Avalanche Fuji (43113) or Mainnet (43114).`);
      } else {
        setNetworkError(null);
      }
    };

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  const setActiveRole = (role: PersonaRole) => {
    setActiveRoleState(role);
    const matched = DEMO_ACCOUNTS.find((a) => a.role === role);
    if (matched) {
      setActiveAccount(matched);
    }
  };

  const selectDemoAccount = (id: string) => {
    const acc = DEMO_ACCOUNTS.find((a) => a.id === id);
    if (acc) {
      setActiveAccount(acc);
      setActiveRoleState(acc.role);
      setWalletProviderType("demo");
      setRealAddress(null);
      setIsConnected(true);
    }
  };

  const connectInjectedWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("No Web3 wallet found! Please install MetaMask or Avalanche Core wallet.");
      return;
    }

    try {
      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const currentChainHex = await ethereum.request({ method: "eth_chainId" });
      const currentCid = parseInt(currentChainHex, 16);

      const chain = getViemChain(currentCid);
      const wClient = createWalletClient({
        chain,
        transport: custom(ethereum),
      });

      const userAddr = accounts[0] as `0x${string}`;
      setRealAddress(userAddr);
      setWalletClient(wClient);
      setChainId(currentCid);
      setIsConnected(true);

      const isCore = !!(ethereum.isAvalanche || ethereum.isCore);
      setWalletProviderType(isCore ? "core" : "metamask");

      if (!(SUPPORTED_CHAIN_IDS as readonly number[]).includes(currentCid)) {
        setNetworkError(`Mismatched network: Connected to ${currentCid}, expected Avalanche (43114 or 43113)`);
      } else {
        setNetworkError(null);
      }
    } catch (err: any) {
      setNetworkError(err.message || "User rejected wallet connection");
    }
  };

  const connectWallet = (customAddress?: `0x${string}`, targetChain?: number) => {
    const selectedChain = targetChain || chainId;
    setChainId(selectedChain);

    if (customAddress) {
      if (!customAddress.startsWith("0x") || customAddress.length !== 42) {
        setNetworkError("Invalid EVM wallet address");
        setIsConnected(false);
        return;
      }
      setRealAddress(customAddress);
    }

    if (!(SUPPORTED_CHAIN_IDS as readonly number[]).includes(selectedChain)) {
      setNetworkError(
        `Mismatched network: Connected to ${selectedChain}, expected CashLayer Avalanche L1 (${AVALANCHE_MAINNET_CHAIN_ID})`
      );
      setIsConnected(true);
      return;
    }

    setNetworkError(null);
    setIsConnected(true);
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setRealAddress(null);
    setWalletClient(null);
    setWalletProviderType("demo");
  };

  const switchNetwork = async (targetChainId: number) => {
    setChainId(targetChainId);
    if (typeof window !== "undefined" && (window as any).ethereum && walletProviderType !== "demo") {
      try {
        const hex = `0x${targetChainId.toString(16)}`;
        await (window as any).ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hex }],
        });
        setNetworkError(null);
      } catch (switchError: any) {
        // Chain not added error code 4902
        if (switchError.code === 4902) {
          try {
            await (window as any).ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: `0x${targetChainId.toString(16)}`,
                  chainName: targetChainId === AVALANCHE_FUJI_CHAIN_ID ? "Avalanche Fuji Testnet" : "Avalanche C-Chain",
                  nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
                  rpcUrls: [
                    targetChainId === AVALANCHE_FUJI_CHAIN_ID
                      ? "https://api.avax-test.network/ext/bc/C/rpc"
                      : "https://api.avax.network/ext/bc/C/rpc",
                  ],
                  blockExplorerUrls: [
                    targetChainId === AVALANCHE_FUJI_CHAIN_ID
                      ? "https://testnet.snowtrace.io"
                      : "https://snowtrace.io",
                  ],
                },
              ],
            });
            setNetworkError(null);
          } catch (addError: any) {
            setNetworkError(addError.message);
          }
        } else {
          setNetworkError(switchError.message);
        }
      }
      return;
    }

    if ((SUPPORTED_CHAIN_IDS as readonly number[]).includes(targetChainId)) {
      setNetworkError(null);
    } else {
      setNetworkError(
        `Mismatched network: Connected to ${targetChainId}, expected CashLayer Avalanche L1 (${AVALANCHE_MAINNET_CHAIN_ID})`
      );
    }
  };

  const activeDisplayAddress = realAddress || (isConnected ? activeAccount.address : null);

  return (
    <WalletContext.Provider
      value={{
        account: activeDisplayAddress,
        activeAccount: realAddress
          ? {
              ...activeAccount,
              address: realAddress,
              name: `${walletProviderType === "core" ? "Core" : "MetaMask"} (${realAddress.slice(0, 6)}...${realAddress.slice(-4)})`,
            }
          : activeAccount,
        chainId,
        isConnected,
        isNetworkValid,
        networkError,
        activeRole,
        walletProviderType,
        isRealWalletConnected: !!realAddress,
        publicClient,
        walletClient,
        setActiveRole,
        selectDemoAccount,
        connectInjectedWallet,
        connectWallet,
        disconnectWallet,
        switchNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
