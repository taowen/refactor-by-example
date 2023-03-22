import { executeNewCommand, executeOldCommand } from "./api";
import { BrobCommand } from "./brob-command";
import { VickCommand } from "./vick-command";

export function main() {
    executeOldCommand(BrobCommand);
    executeOldCommand(VickCommand);
}