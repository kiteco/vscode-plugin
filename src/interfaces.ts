import { Disposable } from 'vscode'

export interface ICommandRegistrant {
  register(): Disposable[]
}
