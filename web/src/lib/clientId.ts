import { v7 as uuidv7 } from 'uuid'

// Generate and store a unique client ID for this browser session
function getOrCreateClientId(): string {
  return uuidv7()
}

export const clientId = getOrCreateClientId()

