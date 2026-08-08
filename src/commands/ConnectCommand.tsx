import { Command, CommandResult } from './Command.js';
import { ConnectScreen } from '../components/ConnectScreen.js';

export class ConnectCommand implements Command {
  names = ['connect'];
  description = 'Manage LastFm and Spotify integrations';

  execute(): CommandResult {
    return { output: '', screen: ConnectScreen };
  }
}
