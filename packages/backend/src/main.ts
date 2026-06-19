// spec:[spec](/specs/backend/main.md)
import { runCLI, handleFatalError } from './cli';

runCLI().catch(handleFatalError);
