import 'express-session';

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
    userId?: string;
    sessionVersion?: number;
    clientSignature?: string;
    clientIpSignature?: string;
    clientAgentSignature?: string;
  }
}
