export function executeOldCommand(commandClass: any) {
}

export class ICommand {}

export function registerNewCommand(commandClass: new () => ICommand) {
}

export function executeNewCommand(commandClass: new () => ICommand) {
}