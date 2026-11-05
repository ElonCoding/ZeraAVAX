import React, { createContext, useContext, useState, useEffect } from "react";
import { DEMO_ACCOUNTS } from "../data/demoAccounts";
import { DemoAccount, PersonaRole } from "../types";
import {
  AVALANCHE_MAINNET_CHAIN_ID,
  AVALANCHE_FUJI_CHAIN_ID,
  LOCAL_ANVIL_CHAIN_ID,
  SUPPORTED_CHAIN_IDS,
} from "@cashlayer/shared";

interface WalletContextType {
  account: `0x${string}` | null;
  activeAccount: DemoAccount;
  chainId: number;
  isConnected: boolean;
  isNetworkValid: boolean;
  networkError: string | null;
  activeRole: PersonaRole;
  setActiveRole: (role: PersonaRole) => void;
  selectDemoAccount: (id: string) => void;
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

  const isNetworkValid = (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);

  const setActiveRole = (role: PersonaRole) => {
    setActiveRoleState(role);
    // Find matching demo account for role
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
  };

  const switchNetwork = async (targetChainId: number) => {
    setChainId(targetChainId);
    if ((SUPPORTED_CHAIN_IDS as readonly number[]).includes(targetChainId)) {
      setNetworkError(null);
    } else {
      setNetworkError(
        `Mismatched network: Connected to ${targetChainId}, expected CashLayer Avalanche L1 (${AVALANCHE_MAINNET_CHAIN_ID})`
      );
    }
  };

  return (
    <WalletContext.Provider
      value={{
        account: isConnected ? activeAccount.address : null,
        activeAccount,
        chainId,
        isConnected,
        isNetworkValid,
        networkError,
        activeRole,
        setActiveRole,
        selectDemoAccount,
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
