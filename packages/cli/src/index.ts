/**
 * @cashlayer/cli
 * Scriptable Command-Line Tooling (CLI) for CashLayer Private Payroll on Avalanche L1.
 */

import { Command } from "commander";
import { registerCreateCommand } from "./commands/create.js";
import { registerExecuteCommand } from "./commands/execute.js";
import { registerAuditCommand } from "./commands/audit.js";
import { registerBalanceCommand } from "./commands/balance.js";
import { registerInspectCommand } from "./commands/inspect.js";

export * from "./contracts.js";
export * from "./adapters.js";
export * from "./commands/create.js";
export * from "./commands/execute.js";
export * from "./commands/audit.js";
export * from "./commands/balance.js";
export * from "./commands/inspect.js";

/**
 * Creates and configures the top-level Commander program with all subcommands.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name("cashlayer-payroll")
    .description("Scriptable Command-Line Tooling (CLI) for CashLayer Private Payroll on Avalanche L1")
    .version("0.1.0");

  // 1. "batch" command group
  const batchCmd = program
    .command("batch")
    .description("Payroll batch creation, pre-flight encryption, and on-chain settlement");
  registerCreateCommand(batchCmd);
  registerExecuteCommand(batchCmd);

  // 2. "audit" command group
  const auditCmd = program
    .command("audit")
    .description("Compliance auditor log discovery, Poseidon decryption, and attestation");
  registerAuditCommand(auditCmd);

  // 3. "employee" command group
  const employeeCmd = program
    .command("employee")
    .description("Confidential employee portal for viewing private token balances");
  registerBalanceCommand(employeeCmd);

  // 4. "observer" command group
  const observerCmd = program
    .command("observer")
    .description("Public observer inspector verifying zero plaintext salary figure leakage");
  registerInspectCommand(observerCmd);

  return program;
}

/**
 * Main entry point for CLI execution.
 */
export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}
