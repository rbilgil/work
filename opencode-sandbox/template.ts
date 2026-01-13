import { Template } from 'e2b'

export const template = Template()
  .fromImage('e2bdev/base')
  // Install required packages (base image runs as 'user', need sudo)
  .runCmd('sudo apt-get update && sudo apt-get install -y curl git ca-certificates')
  // Install OpenCode CLI
  .runCmd('curl -fsSL https://opencode.ai/install | bash')
  // Verify OpenCode installation
  .runCmd('/home/user/.opencode/bin/opencode --version')