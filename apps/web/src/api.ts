// API Client for XYZ Bank Web Operations
// Supports both live backend server and client-side standalone demo mode for GitHub Pages

export type User = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

export type SimCall = {
  callId: string;
  providerCallId: string;
  fromNumber: string;
  toNumber: string;
  startedAt: string;
  greeting: string;
};

export type SimMessageResponse = {
  reply: string;
  tool: string | null;
  toolResult: any;
  transferred: boolean;
  callStatus: string;
  engine?: string;
  geminiError?: string;
  ignored?: boolean;
};

export function getToken(): string {
  return localStorage.getItem('xyz_token') || '';
}

export function getCustomBackendUrl(): string {
  return localStorage.getItem('xyz_custom_backend_url') || (import.meta.env.VITE_API_URL as string | undefined) || '';
}

export function setCustomBackendUrl(url: string) {
  if (url) {
    localStorage.setItem('xyz_custom_backend_url', url.trim().replace(/\/+$/, ''));
  } else {
    localStorage.removeItem('xyz_custom_backend_url');
  }
}

export function getStoredGeminiKey(): string {
  return localStorage.getItem('xyz_gemini_api_key') || '';
}

export function setStoredGeminiKey(key: string) {
  if (key) {
    localStorage.setItem('xyz_gemini_api_key', key.trim());
  } else {
    localStorage.removeItem('xyz_gemini_api_key');
  }
}

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.includes('github.io') || localStorage.getItem('xyz_mode') === 'demo';
}

export function setStandaloneMode(enabled: boolean) {
  if (enabled) {
    localStorage.setItem('xyz_mode', 'demo');
  } else {
    localStorage.removeItem('xyz_mode');
  }
}

// -------------------------------------------------------------
// Interactive Mock Data for GitHub Pages & Standalone Demo Mode
// -------------------------------------------------------------

const DEFAULT_USER: User = {
  id: 'usr-admin-01',
  email: 'admin@xyzbank.local',
  displayName: 'Admin User',
  role: 'SUPER_ADMIN'
};

const DEFAULT_CALLS = [
  {
    id: 'call-01',
    provider_call_id: 'SIM-9X42-VOICE',
    status: 'IN_PROGRESS',
    from_number_masked: '+91 98****11',
    to_number_masked: '1800-XYZ-BANK',
    started_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    duration_seconds: 240,
    resolution: 'Active AI Session: Verification & card inquiry',
    escalation_reason: null
  },
  {
    id: 'call-02',
    provider_call_id: 'SIP-CALL-8831',
    status: 'COMPLETED',
    from_number_masked: '+91 99****42',
    to_number_masked: '1800-XYZ-BANK',
    started_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    duration_seconds: 185,
    resolution: 'Account balance & mini statement delivered',
    escalation_reason: null
  },
  {
    id: 'call-03',
    provider_call_id: 'SIP-CALL-8790',
    status: 'TRANSFERRED',
    from_number_masked: '+91 97****89',
    to_number_masked: '1800-XYZ-BANK',
    started_at: new Date(Date.now() - 72 * 60 * 1000).toISOString(),
    duration_seconds: 310,
    resolution: 'Caller requested human supervisor for mortgage clarification',
    escalation_reason: 'CUSTOMER_ESCALATION'
  },
  {
    id: 'call-04',
    provider_call_id: 'SIP-CALL-8654',
    status: 'COMPLETED',
    from_number_masked: '+91 91****33',
    to_number_masked: '1800-XYZ-BANK',
    started_at: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
    duration_seconds: 142,
    resolution: 'International card security switch activated',
    escalation_reason: null
  },
  {
    id: 'call-05',
    provider_call_id: 'SIP-CALL-8501',
    status: 'COMPLETED',
    from_number_masked: '+91 94****76',
    to_number_masked: '1800-XYZ-BANK',
    started_at: new Date(Date.now() - 280 * 60 * 1000).toISOString(),
    duration_seconds: 96,
    resolution: 'Cheque book order confirmed',
    escalation_reason: null
  }
];

const DEFAULT_TICKETS = [
  {
    id: 'tck-01',
    reference_code: 'TCK-2026-1042',
    category: 'cards',
    subject: 'Urgent: Physical debit card replacement request',
    status: 'OPEN',
    priority: 'HIGH',
    created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    assigned_to: 'Support Tier 1'
  },
  {
    id: 'tck-02',
    reference_code: 'TCK-2026-1039',
    category: 'security',
    subject: 'Suspicious SMS inquiry for unverified 6-digit OTP',
    status: 'IN_PROGRESS',
    priority: 'CRITICAL',
    created_at: new Date(Date.now() - 12000 * 1000).toISOString(),
    assigned_to: 'Fraud Response Team'
  },
  {
    id: 'tck-03',
    reference_code: 'TCK-2026-1035',
    category: 'account',
    subject: 'Update primary mailing address for NRI account holder',
    status: 'WAITING_CUSTOMER',
    priority: 'NORMAL',
    created_at: new Date(Date.now() - 86400 * 1000).toISOString(),
    assigned_to: 'Operations Branch'
  },
  {
    id: 'tck-04',
    reference_code: 'TCK-2026-1028',
    category: 'loans',
    subject: 'Inquiry regarding home loan interest rate revision schedule',
    status: 'RESOLVED',
    priority: 'NORMAL',
    created_at: new Date(Date.now() - 172800 * 1000).toISOString(),
    assigned_to: 'Loan Desk'
  }
];

const DEFAULT_ARTICLES = [
  {
    id: 'art-01',
    title: 'Instant Debit Card Freeze & Emergency Unfreeze Policy',
    category: 'cards',
    content: 'Customers can instantly freeze their card via voice assistant, mobile banking, or SMS. Unfreezing requires 2-factor OTP verification. If lost/stolen, card is permanently blocked and replacement issued within 3-5 business days.',
    status: 'PUBLISHED',
    updated_at: new Date(Date.now() - 43200 * 1000).toISOString()
  },
  {
    id: 'art-02',
    title: 'Daily ATM & POS Transaction Limits for Titanium Accounts',
    category: 'limits',
    content: 'Titanium debit cards feature a default daily ATM cash withdrawal limit of INR 1,00,000 and POS/E-commerce limit of INR 3,00,000. Limits can be customized temporarily via verified caller request.',
    status: 'PUBLISHED',
    updated_at: new Date(Date.now() - 86400 * 1000).toISOString()
  },
  {
    id: 'art-03',
    title: 'Enabling International Usage & E-Commerce Security (3D Secure)',
    category: 'security',
    content: 'International transactions are disabled by default for consumer safety. Customers can enable specific regions or worldwide usage for up to 90 days via voice AI with mandatory biometrics/PIN confirmation.',
    status: 'PUBLISHED',
    updated_at: new Date(Date.now() - 129600 * 1000).toISOString()
  },
  {
    id: 'art-04',
    title: 'NEFT, RTGS & IMPS Cutoff Timings and Service Charges',
    category: 'transfers',
    content: 'IMPS and NEFT operate 24x7x365 with zero charges for online/voice banking transfers up to INR 5,00,000 per transaction. RTGS is available for high-value transfers above INR 2,00,000.',
    status: 'PUBLISHED',
    updated_at: new Date(Date.now() - 259200 * 1000).toISOString()
  },
  {
    id: 'art-05',
    title: 'Senior Citizen Priority Banking & Doorstep Assistance',
    category: 'general',
    content: 'Senior citizens aged 65 and above are eligible for doorstep cash delivery and KYC document collection within municipal corporation limits.',
    status: 'DRAFT',
    updated_at: new Date(Date.now() - 345600 * 1000).toISOString()
  }
];

const DEFAULT_AUDIT = [
  {
    id: 'aud-01',
    event_type: 'AUTHENTICATION_SUCCESS',
    actor: 'admin@xyzbank.local',
    ip_address: '10.0.4.12',
    created_at: new Date(Date.now() - 1200 * 1000).toISOString(),
    detail: { action: 'Admin session established with MFA' }
  },
  {
    id: 'aud-02',
    event_type: 'TELEPHONY_SECURITY_CHECK',
    actor: 'Voice AI Agent',
    ip_address: '10.0.1.5',
    created_at: new Date(Date.now() - 4200 * 1000).toISOString(),
    detail: { caller: '+91 98****11', outcome: 'Voice token match passed' }
  },
  {
    id: 'aud-03',
    event_type: 'POLICY_ACTION_CARD_FREEZE',
    actor: 'Voice AI Agent',
    ip_address: '10.0.1.5',
    created_at: new Date(Date.now() - 15000 * 1000).toISOString(),
    detail: { account: 'XXXX-4892', reason: 'Customer reported misplaced card' }
  },
  {
    id: 'aud-04',
    event_type: 'CALL_ESCALATION_TRANSFERRED',
    actor: 'Telephony Router',
    ip_address: '10.0.1.20',
    created_at: new Date(Date.now() - 72000 * 1000).toISOString(),
    detail: { callId: 'SIP-CALL-8790', target: 'Tier-2 Human Escalation Desk' }
  }
];

function getStoredList<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

function saveStoredList<T>(key: string, list: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {}
}

// -------------------------------------------------------------
// Core API Fetch with Automatic Standalone / Live Fallback
// -------------------------------------------------------------

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const customUrl = getCustomBackendUrl();
  const token = getToken();

  // If we are strictly in demo mode or running on github.io without a custom backend
  const forceMock = isStandaloneMode() && !customUrl;

  if (!forceMock) {
    try {
      const targetUrl = `${customUrl}${path}`;
      const r = await fetch(targetUrl, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init.headers || {})
        }
      });

      if (r.ok) {
        return (await r.json()) as T;
      }

      // If backend returns 404 or other server error and no custom backend set, try fallback
      if (!customUrl && (r.status === 404 || r.status === 405 || r.status === 502 || r.status === 503)) {
        return handleMockApi<T>(path, init);
      }

      let errorMsg = '';
      try {
        const text = await r.text();
        try {
          const body = JSON.parse(text);
          errorMsg = body.error || body.message || '';
        } catch {
          if (text && text.length < 150) errorMsg = text;
        }
      } catch {}

      if (!errorMsg) {
        if (r.status === 401) errorMsg = 'Invalid email or password';
        else if (r.status === 429) errorMsg = 'Too many attempts. Please wait a few moments and try again.';
        else errorMsg = `Request failed (${r.status})`;
      }
      throw new Error(errorMsg);
    } catch (err: any) {
      // If network fetch failed (e.g. backend server is not running or on GitHub Pages)
      if (!customUrl) {
        return handleMockApi<T>(path, init);
      }
      throw err;
    }
  }

  return handleMockApi<T>(path, init);
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function pcmToWavInBrowser(pcmBytes: Uint8Array, sampleRate = 24000, numChannels = 1, bitDepth = 16): Uint8Array {
  const dataSize = pcmBytes.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const byteRate = sampleRate * numChannels * (bitDepth / 8);
  const blockAlign = numChannels * (bitDepth / 8);

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);

  const wavBytes = new Uint8Array(buffer);
  wavBytes.set(pcmBytes, 44);
  return wavBytes;
}

// -------------------------------------------------------------
// Sofia AI Banking Response Engine
// Answers caller questions accurately, conversationally, and warmly
// -------------------------------------------------------------

export function processSofiaBankingResponse(userMessage: string): SimMessageResponse {
  const clean = (userMessage || '').trim();
  const lower = clean.toLowerCase();

  // 1. PIN / CVV / OTP / Passwords Guard
  if (/\b(pin|cvv|otp|password|passcode|secret code|mpin|upi pin|atm pin)\b/i.test(lower)) {
    return {
      reply: "For your security, XYZ Bank policies strictly prohibit disclosing, requesting, or processing PINs, CVVs, passwords, or OTPs over telephone calls.",
      tool: 'security_boundary',
      toolResult: { policy: 'SENSITIVE_CREDENTIAL_GUARD' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 2. Direct Fund Movement Guard
  if (/\b(send money|transfer money|pay someone|wire money|make payment)\b/i.test(lower) && !lower.includes('timing') && !lower.includes('limit') && !lower.includes('charge')) {
    return {
      reply: "For fraud prevention, automated fund transfers cannot be executed over phone calls. You can initiate instant transfers securely in the XYZ Mobile Banking app.",
      tool: 'security_boundary',
      toolResult: { policy: 'FUNDS_TRANSFER_GUARD' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 3. Human Transfer / Supervisor Escalation
  if (/\b(human|agent|operator|person|representative|supervisor|manager|talk to someone|speak with someone|speak to human)\b/i.test(lower)) {
    return {
      reply: "I understand you would like to speak with a human banking specialist. I am connecting you right now with our senior operations desk. Please hold the line.",
      tool: 'request_human_transfer',
      toolResult: { desk: 'Senior Operations Tier-2' },
      transferred: true,
      callStatus: 'TRANSFERRED',
      engine: 'sofia-ai-voice'
    };
  }

  // 4. Lost / Stolen / Block / Freeze Card
  if (/\b(block|freeze|lost|stolen|misplaced|hotlist|deactivate)\b/i.test(lower) && /\b(card|debit|credit|atm)\b/i.test(lower)) {
    return {
      reply: "I have immediately placed a security freeze on your Titanium Debit Card ending in 7712. A confirmation notification has been dispatched to your mobile.",
      tool: 'freeze_debit_card',
      toolResult: { cardEnding: '7712', status: 'FROZEN', securityHold: true },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 5. Unfreeze / Unblock Card
  if (/\b(unfreeze|unblock|activate|enable)\b/i.test(lower) && /\b(card|debit|credit|atm)\b/i.test(lower)) {
    return {
      reply: "To protect your funds, unfreezing a blocked card requires two-factor verification. You can instantly unfreeze your Titanium card in the XYZ Mobile App under Card Controls.",
      tool: 'card_security_policy',
      toolResult: { cardEnding: '7712', action: 'UNFREEZE_REQUIRES_2FA' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 6. Account Balance Inquiry
  if (/\b(balance|how much money|funds available|check balance|account balance|savings balance|how much in my account)\b/i.test(lower)) {
    return {
      reply: "Your primary Savings Account ending in 4892 has an available balance of ₹1,48,250.00 as of today.",
      tool: 'check_account_balance',
      toolResult: { accountNumber: 'XXXX-XXXX-4892', availableBalance: 148250, currency: 'INR' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 7. Mini Statement / Recent Transactions
  if (/\b(mini statement|recent transaction|last transaction|statement|passbook|history)\b/i.test(lower) && !lower.includes('email')) {
    return {
      reply: "Here are your last 3 transactions on Savings Account ending in 4892: ₹2,450 paid to Swiggy UPI, ₹15,000 salary credit, and ₹850 ATM withdrawal. Available balance is ₹1,48,250.00.",
      tool: 'get_recent_transactions',
      toolResult: { accountNumber: 'XXXX-XXXX-4892', availableBalance: 148250 },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 8. Email Statement
  if (/\b(email statement|send statement|download statement|statement via email)\b/i.test(lower) || (lower.includes('statement') && lower.includes('email'))) {
    return {
      reply: "Your official account statement for the last 90 days has been generated and sent to your registered email address (aarav.sharma@example.com).",
      tool: 'send_account_statement',
      toolResult: { deliveredTo: 'aarav.sharma@example.com', format: 'PDF_ENCRYPTED' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 9. Account Details / Account Number / Customer Profile
  if (/\b(account number|my account|customer id|profile|account details|account info)\b/i.test(lower)) {
    return {
      reply: "Your active account is Savings Account ending in 4892 under the name Aarav Sharma at our Mumbai Main Branch (IFSC: XYZB0001001).",
      tool: 'get_account_details',
      toolResult: { customerName: 'Aarav Sharma', accountNumber: 'XXXX-XXXX-4892' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 10. Branch IFSC Code / SWIFT
  if (/\b(ifsc|micr|swift|branch code|bank code)\b/i.test(lower)) {
    return {
      reply: "The IFSC code for XYZ Bank Mumbai Main Branch is XYZB0001001. For international wires, our SWIFT code is XYZBINBB.",
      tool: 'search_bank_faq',
      toolResult: { ifsc: 'XYZB0001001', swift: 'XYZBINBB' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 11. Branch Timings / Working Hours / Saturday
  if (/\b(timing|hours|open|close|saturday|sunday|holiday|when does)\b/i.test(lower)) {
    return {
      reply: "Our branches are open Monday through Saturday from 9:30 AM to 4:30 PM. All branches are closed on 2nd and 4th Saturdays, Sundays, and public bank holidays.",
      tool: 'search_bank_faq',
      toolResult: { timings: 'Mon-Sat 9:30 AM - 4:30 PM' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 12. Daily ATM & POS Withdrawal Limits
  if (/\b(limit|withdrawal|daily limit|atm limit|pos limit|max cash)\b/i.test(lower)) {
    return {
      reply: "Your Titanium Debit Card features a default daily ATM cash withdrawal limit of ₹1,00,000 and a POS or online purchase limit of ₹3,00,000.",
      tool: 'search_bank_faq',
      toolResult: { atmLimit: 100000, posLimit: 300000 },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 13. Cheque Book Order
  if (/\b(cheque|check book|cheque book|leaves)\b/i.test(lower)) {
    return {
      reply: "I have successfully submitted an order for a new 25-leaf personalized cheque book for your Savings Account ending in 4892. It will be dispatched to your registered address in 3 to 5 business days.",
      tool: 'order_cheque_book',
      toolResult: { leaves: 25, dispatchEta: '3-5 business days' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 14. UPI Failed Payment / Auto-reversal
  if (/\b(upi|failed payment|deducted|refund|money cut)\b/i.test(lower)) {
    return {
      reply: "For failed UPI transactions where money was deducted from your account, the amount is automatically refunded within 24 to 48 hours as mandated by RBI.",
      tool: 'search_bank_faq',
      toolResult: { reversalWindow: '24-48 hours' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 15. Savings & Fixed Deposit Interest Rates
  if (/\b(interest|rate|fixed deposit|fd|rates)\b/i.test(lower)) {
    return {
      reply: "XYZ Bank Savings Accounts earn up to 4.0% annual interest. Fixed Deposits offer 7.10% annually, with an extra 0.50% rate (7.60%) for Senior Citizens.",
      tool: 'search_bank_faq',
      toolResult: { savingsRate: '4.0%', fdRate: '7.1%' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 16. KYC Renewal & Address Update
  if (/\b(kyc|address|pan|aadhaar|document|update details)\b/i.test(lower)) {
    return {
      reply: "You can update your KYC or residential address in 3 minutes via video KYC or DigiLocker in the XYZ Mobile App, or by visiting any XYZ Bank branch.",
      tool: 'search_bank_faq',
      toolResult: { procedure: 'Online Video KYC / DigiLocker' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 17. Retail Loans (Home, Car, Personal)
  if (/\b(loan|home loan|car loan|personal loan|mortgage|emi)\b/i.test(lower)) {
    return {
      reply: "XYZ Bank offers Home Loans starting at 8.40% interest with zero prepayment penalties, Car Loans at 8.75%, and Personal Loans up to ₹25,00,000.",
      tool: 'search_bank_faq',
      toolResult: { homeLoanRate: '8.40%' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 18. International Transactions & 3D Secure
  if (/\b(international|abroad|foreign|travel|overseas)\b/i.test(lower)) {
    return {
      reply: "International transactions are disabled by default for your safety. You can easily enable worldwide usage for up to 90 days in the XYZ Mobile App under Card Controls.",
      tool: 'search_bank_faq',
      toolResult: { status: 'Disabled by default, customizable in app' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 19. Support Ticket / Grievance / Dispute Filing
  if (/\b(ticket|complaint|dispute|grievance|fraud|unauthorized|issue)\b/i.test(lower)) {
    const ticketRef = 'TCK-2026-' + Math.floor(1000 + Math.random() * 9000);
    return {
      reply: `I have logged a support request for you with reference number ${ticketRef}. Our priority desk will follow up within 2 business hours.`,
      tool: 'create_support_ticket',
      toolResult: { referenceCode: ticketRef, status: 'OPEN', priority: 'HIGH' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 20. Identity & Name
  if (/\b(who are you|your name|what are you|what is your name)\b/i.test(lower)) {
    return {
      reply: "I am Sofia, your AI voice banking assistant for XYZ Bank. I can help you check your account balance, lock a lost card, find branch timings, get IFSC codes, and manage your banking services.",
      tool: null,
      toolResult: null,
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 21. Credit Cards & Offers
  if (/\b(credit cards?|apply card|platinum card|rewards?|credit limit)\b/i.test(lower)) {
    return {
      reply: "XYZ Bank offers Titanium and Platinum Credit Cards with up to 5X rewards, lounge access, and zero annual fee for your first year. You can apply instantly through the XYZ Mobile App.",
      tool: 'search_bank_faq',
      toolResult: { product: 'Credit Cards', annualFee: 0 },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 22. Branch / ATM Locator
  if (/\b(near me|nearest|locate|location|address of branch|atm nearby|nearby atm|find branch|find atm|branch near|atm near)\b/i.test(lower)) {
    return {
      reply: "Our Mumbai Main Branch is located at Nariman Point, Mumbai. We also have over 1,200 24/7 cash ATMs across the city. You can find your nearest ATM in the XYZ Mobile App under Branch Locator.",
      tool: 'search_bank_faq',
      toolResult: { mainBranch: 'Nariman Point, Mumbai', atms: 1200 },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 23. Net Banking & Mobile App
  if (/\b(net banking|mobile banking|mobile app|download app|login issue|forgot password)\b/i.test(lower)) {
    return {
      reply: "You can securely access XYZ Net Banking and our Mobile App using your customer ID and biometric login. For your safety, remember that XYZ Bank will never ask for your password or OTP.",
      tool: 'search_bank_faq',
      toolResult: { platform: 'XYZ Mobile Banking & Web' },
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 24. Friendly Greetings
  if (/^(hello|hi|hey|good morning|good afternoon|good evening|namaste)\b/i.test(lower)) {
    return {
      reply: "Hello Aarav! Welcome to XYZ Bank customer care. I am your AI banking assistant Sofia. How can I help you today?",
      tool: null,
      toolResult: null,
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 25. Gratitude / Closing
  if (/\b(thank you|thanks|no thanks|all good|that's all|bye|goodbye)\b/i.test(lower)) {
    return {
      reply: "You're very welcome! Thank you for banking with XYZ Bank. Have a wonderful day ahead, and stay safe!",
      tool: null,
      toolResult: null,
      transferred: false,
      callStatus: 'IN_PROGRESS',
      engine: 'sofia-ai-voice'
    };
  }

  // 26. Conversational Banking Fallback
  return {
    reply: "I can help you check your account balance, lock a lost card, check IFSC codes, find branch timings, or connect you to an agent. How can I assist you?",
    tool: null,
    toolResult: null,
    transferred: false,
    callStatus: 'IN_PROGRESS',
    engine: 'sofia-ai-voice'
  };
}

// -------------------------------------------------------------
// Client-Side Mock Router for Standalone & GitHub Pages Access
// -------------------------------------------------------------

async function handleMockApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const body = init.body ? (typeof init.body === 'string' ? JSON.parse(init.body) : init.body) : {};

  // Auth: Login
  if (path === '/api/auth/login' && method === 'POST') {
    const email = body.email || 'admin@xyzbank.local';
    const role = email.toLowerCase().includes('supervisor')
      ? 'SUPERVISOR'
      : email.toLowerCase().includes('auditor')
      ? 'AUDITOR'
      : 'SUPER_ADMIN';

    const displayName = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Admin User';
    const user: User = { id: 'usr-sim-' + Date.now().toString(36), email, displayName, role };
    const token = 'xyz_demo_token_' + Date.now();
    localStorage.setItem('xyz_token', token);
    localStorage.setItem('xyz_demo_user', JSON.stringify(user));
    return { token, user } as unknown as T;
  }

  // Auth: Me
  if (path === '/api/auth/me') {
    let user = DEFAULT_USER;
    try {
      const stored = localStorage.getItem('xyz_demo_user');
      if (stored) user = JSON.parse(stored);
    } catch {}
    return { user } as unknown as T;
  }

  // Auth: Logout
  if (path === '/api/auth/logout') {
    localStorage.removeItem('xyz_token');
    localStorage.removeItem('xyz_demo_user');
    return { ok: true } as unknown as T;
  }

  // Dashboard: Summary
  if (path === '/api/dashboard/summary') {
    const tickets = getStoredList('xyz_demo_tickets', DEFAULT_TICKETS);
    const articles = getStoredList('xyz_demo_articles', DEFAULT_ARTICLES);
    const openTickets = tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
    const publishedArticles = articles.filter(a => a.status === 'PUBLISHED').length;

    return {
      calls: { total: 134, active: 1, last24h: 48, transferred: 3 },
      tickets: { open: openTickets },
      knowledge: { published: publishedArticles },
      failures: { failures: 0 },
      dataMode: 'live_interactive_preview'
    } as unknown as T;
  }

  // Dashboard: Calls
  if (path === '/api/dashboard/calls') {
    const calls = getStoredList('xyz_demo_calls', DEFAULT_CALLS);
    return { calls } as unknown as T;
  }

  // Transfer Call
  if (path.startsWith('/api/dashboard/calls/') && path.endsWith('/transfer')) {
    const callId = path.split('/')[4];
    const calls = getStoredList('xyz_demo_calls', DEFAULT_CALLS);
    const updated = calls.map(c => (c.id === callId ? { ...c, status: 'TRANSFERRED', resolution: 'Transferred to human desk' } : c));
    saveStoredList('xyz_demo_calls', updated);
    return { ok: true } as unknown as T;
  }

  // Dashboard: Tickets
  if (path === '/api/dashboard/tickets' && method === 'GET') {
    const tickets = getStoredList('xyz_demo_tickets', DEFAULT_TICKETS);
    return { tickets } as unknown as T;
  }

  // Create Ticket
  if (path === '/api/tickets' && method === 'POST') {
    const tickets = getStoredList('xyz_demo_tickets', DEFAULT_TICKETS);
    const newTicket = {
      id: 'tck-' + Date.now(),
      reference_code: 'TCK-2026-' + Math.floor(1000 + Math.random() * 9000),
      category: body.category || 'general',
      subject: body.subject || 'Customer Support Request',
      status: 'OPEN',
      priority: body.priority || 'NORMAL',
      created_at: new Date().toISOString(),
      assigned_to: 'Support Queue'
    };
    tickets.unshift(newTicket);
    saveStoredList('xyz_demo_tickets', tickets);
    return newTicket as unknown as T;
  }

  // Update Ticket Status
  if (path.startsWith('/api/tickets/') && method === 'PATCH') {
    const ticketId = path.split('/')[3];
    const tickets = getStoredList('xyz_demo_tickets', DEFAULT_TICKETS);
    const updated = tickets.map(t => (t.id === ticketId ? { ...t, status: body.status || t.status } : t));
    saveStoredList('xyz_demo_tickets', updated);
    return { ok: true } as unknown as T;
  }

  // Knowledge Articles (GET / POST)
  if (path === '/api/knowledge') {
    if (method === 'GET') {
      const articles = getStoredList('xyz_demo_articles', DEFAULT_ARTICLES);
      return { articles } as unknown as T;
    }
    if (method === 'POST') {
      const articles = getStoredList('xyz_demo_articles', DEFAULT_ARTICLES);
      const newArticle = {
        id: 'art-' + Date.now(),
        title: body.title || 'Untitled Policy Document',
        category: body.category || 'general',
        content: body.content || '',
        status: body.status || 'DRAFT',
        updated_at: new Date().toISOString()
      };
      articles.unshift(newArticle);
      saveStoredList('xyz_demo_articles', articles);
      return newArticle as unknown as T;
    }
  }

  // Update Knowledge Article
  if (path.startsWith('/api/knowledge/') && method === 'PATCH') {
    const articleId = path.split('/')[3];
    const articles = getStoredList('xyz_demo_articles', DEFAULT_ARTICLES);
    const updated = articles.map(a => (a.id === articleId ? { ...a, status: body.status || a.status, updated_at: new Date().toISOString() } : a));
    saveStoredList('xyz_demo_articles', updated);
    return { ok: true } as unknown as T;
  }

  // Dashboard: Audit Log
  if (path === '/api/dashboard/audit') {
    const audit = getStoredList('xyz_demo_audit', DEFAULT_AUDIT);
    return { events: audit } as unknown as T;
  }

  // AI Simulation: Gemini Status
  if (path === '/api/simulation/call/gemini-status') {
    const stored = getStoredGeminiKey();
    return {
      hasEnvKey: Boolean(stored),
      defaultModel: 'gemini-1.5-flash',
      freeApiKeyUrl: 'https://aistudio.google.com/app/apikey'
    } as unknown as T;
  }

  // AI Simulation: Gemini Key Test
  if (path === '/api/simulation/call/gemini-test') {
    const testKey = body.geminiApiKey || getStoredGeminiKey();
    if (!testKey) {
      return { ok: false, error: 'Please enter a Gemini API Key to test' } as unknown as T;
    }
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${testKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with: "OK"' }] }]
        })
      });
      if (resp.ok) {
        return {
          ok: true,
          model: 'gemini-1.5-flash',
          source: 'direct-client',
          message: 'Successfully verified connection to Google Gemini API!'
        } as unknown as T;
      } else {
        const errJson = await resp.json().catch(() => ({}));
        return { ok: false, error: errJson.error?.message || 'Invalid Gemini API key or rate limit exceeded' } as unknown as T;
      }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Network error verifying key' } as unknown as T;
    }
  }

  // AI Simulation: Start Call
  if (path === '/api/simulation/call/start') {
    const callerName = body.callerName || 'Aarav Sharma (SYN-CUST-1001)';
    const fromNumber = body.fromNumber || '+91 98765 00011';
    const masked = fromNumber.replace(/(\+?\d{2})\d{4,}(\d{2})/, '$1****$2');
    const callId = 'sim-' + Date.now();
    const providerCallId = 'SIM-' + Date.now().toString(36).toUpperCase();

    // Record call in demo calls list
    const calls = getStoredList('xyz_demo_calls', DEFAULT_CALLS);
    calls.unshift({
      id: callId,
      provider_call_id: providerCallId,
      status: 'IN_PROGRESS',
      from_number_masked: masked,
      to_number_masked: '1800-XYZ-BANK',
      started_at: new Date().toISOString(),
      duration_seconds: 0,
      resolution: `Live AI Session with ${callerName}`,
      escalation_reason: null
    });
    saveStoredList('xyz_demo_calls', calls);

    return {
      callId,
      providerCallId,
      fromNumber: masked,
      toNumber: '1800-XYZ-BANK',
      startedAt: new Date().toISOString(),
      greeting: 'Thank you for calling XYZ Bank customer care. I am your AI banking assistant. How may I help you today?'
    } as unknown as T;
  }

  // AI Simulation: Send Message
  if (path.includes('/api/simulation/call/') && path.endsWith('/message')) {
    const userMessage = (body.message || '').toString();
    const geminiKey = body.geminiApiKey || getStoredGeminiKey();

    // 1. If user provided a Gemini API Key, try real Gemini Flash
    if (geminiKey) {
      try {
        const geminiResp = await callGeminiDirect(userMessage, body.history || [], geminiKey);
        return geminiResp as unknown as T;
      } catch (err: any) {
        console.warn('Direct Gemini call error, using Sofia banking engine:', err);
      }
    }

    const res = processSofiaBankingResponse(userMessage);
    return res as unknown as T;
  }

  // AI Simulation: Audio Message
  if (path.includes('/api/simulation/call/') && path.endsWith('/audio')) {
    const spoken = (body.spokenText || body.text || body.message || '').toString().trim();
    const geminiKey = body.geminiApiKey || getStoredGeminiKey();
    let transcribedText = spoken;

    // Transcribe via Gemini multimodal if key present and no spoken text provided
    if (!transcribedText && geminiKey && body.audioBase64) {
      try {
        const cleanBase64 = String(body.audioBase64).replace(/^data:[^;]+;base64,/, '');
        const transResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { text: 'Transcribe the caller spoken words word-for-word. Output ONLY the words spoken. If only silence, noise, or no recognizable human speech, respond with [SILENCE].' },
                { inlineData: { mimeType: body.mimeType || 'audio/webm', data: cleanBase64 } }
              ]
            }],
            generationConfig: { temperature: 0.0, maxOutputTokens: 100 }
          })
        });

        if (transResp.ok) {
          const transJson = await transResp.json();
          const raw = transJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          if (raw && !raw.toUpperCase().includes('SILENCE')) {
            transcribedText = raw.replace(/^["']|["']$/g, '');
          }
        }
      } catch (err) {
        console.warn('Direct client audio transcribe error:', err);
      }
    }

    if (!transcribedText) {
      if (!body.manual) {
        return {
          transcribedText: '',
          reply: '',
          ignored: true,
          tool: null,
          toolResult: null,
          transferred: false,
          callStatus: 'IN_PROGRESS',
          engine: 'sofia-ai-voice'
        } as unknown as T;
      }
      return {
        transcribedText: '',
        reply: "I couldn't hear you clearly. Could you please speak into your microphone or type your question below?",
        tool: null,
        toolResult: null,
        transferred: false,
        callStatus: 'IN_PROGRESS',
        engine: 'sofia-ai-voice'
      } as unknown as T;
    }

    if (geminiKey) {
      try {
        const geminiResp = await callGeminiDirect(transcribedText, body.history || [], geminiKey);
        return {
          transcribedText,
          ...geminiResp
        } as unknown as T;
      } catch (err: any) {
        console.warn('Direct Gemini call error from audio:', err);
      }
    }

    const sofiaRes = processSofiaBankingResponse(transcribedText);
    return {
      transcribedText,
      ...sofiaRes
    } as unknown as T;
  }

  // AI Simulation: End Call
  if (path.includes('/api/simulation/call/') && path.endsWith('/end')) {
    return {
      ok: true,
      durationSeconds: 48,
      status: 'COMPLETED'
    } as unknown as T;
  }

  // AI Simulation: TTS (Sofia Studio HD Voice generation via Gemini with graceful browser voice fallback)
  if (path === '/api/simulation/call/tts') {
    const geminiKey = body.geminiApiKey || getStoredGeminiKey();
    if (!geminiKey) {
      return { audioBase64: '', mimeType: 'audio/wav' } as unknown as T;
    }
    try {
      const clean = (body.text || '')
        .replace(/[*_#`~]/g, '')
        .replace(/\bINR\b/gi, 'Rupees')
        .replace(/₹\s*/g, 'Rupees ')
        .replace(/\bUPI\b/g, 'U P I')
        .replace(/\bOTP\b/g, 'O T P')
        .replace(/\bPIN\b/g, 'P I N')
        .replace(/\bCVV\b/g, 'C V V')
        .trim();

      const candidateModels = [
        'gemini-3.8-flash-lite-tts',
        'gemini-3.1-flash-tts-preview',
        'gemini-3.8-flash-tts'
      ];

      for (const m of candidateModels) {
        try {
          const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: clean }] }],
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: 'Aoede'
                    }
                  }
                }
              }
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            const part = data.candidates?.[0]?.content?.parts?.[0];
            const audioData = part?.inlineData?.data;
            if (audioData) {
              const rawMime = (part?.inlineData?.mimeType || '').toLowerCase();
              if (rawMime.includes('wav')) {
                return { audioBase64: audioData, mimeType: 'audio/wav' } as unknown as T;
              }
              const pcm = base64ToUint8(audioData);
              const wav = pcmToWavInBrowser(pcm, 24000, 1, 16);
              return { audioBase64: uint8ToBase64(wav), mimeType: 'audio/wav' } as unknown as T;
            }
          }
        } catch {
          // try next candidate model
        }
      }
    } catch (e) {
      console.warn('Direct Gemini TTS error:', e);
    }
    return { audioBase64: '', mimeType: 'audio/wav' } as unknown as T;
  }

  // Default fallback response
  return { ok: true } as unknown as T;
}

// Direct client-side Gemini generation if user inputs their own Gemini API key
async function callGeminiDirect(
  message: string,
  history: Array<{ role: 'user' | 'model'; text: string }>,
  apiKey: string
): Promise<SimMessageResponse> {
  const candidateModels = [
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash',
    'gemini-3.5-flash-lite'
  ];

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: `You are Sofia, the friendly, empathetic, and professional AI voice banking assistant for XYZ Bank.
Caller context: Aarav Sharma (Customer SYN-CUST-1001, Savings Account ending in 4892, Titanium Debit Card ending in 7712, available balance ₹1,48,250.00).
Rules:
1. Speak naturally in 1-3 spoken sentences suitable for a phone call.
2. NEVER ask for, disclose, or accept PIN, CVV, password, or OTP.
3. You can report account balance (₹1,48,250.00), freeze debit cards (ending 7712), explain branch timings (Mon-Sat 9:30 AM-4:30 PM), IFSC (XYZB0001001), ATM limits (₹1,00,000/day), or transfer to a human specialist.
4. If the caller asks for a human, supervisor, or representative, agree immediately and indicate you are transferring them.`
        }
      ]
    },
    ...history.slice(-6).map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.text }]
    })),
    {
      role: 'user',
      parts: [{ text: message }]
    }
  ];

  for (const model of candidateModels) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: 200,
            temperature: 0.3
          }
        })
      });

      if (res.ok) {
        const json = await res.json();
        const reply = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Thank you for contacting XYZ Bank. How can I assist you further?";
        const lower = message.toLowerCase();
        const isTransfer = /\b(human|agent|operator|person|representative|supervisor|manager)\b/i.test(lower);
        return {
          reply,
          tool: null,
          toolResult: null,
          transferred: isTransfer,
          callStatus: isTransfer ? 'TRANSFERRED' : 'IN_PROGRESS',
          engine: `Google Gemini (${model})`
        };
      }
    } catch {
      // try next candidate model
    }
  }

  return processSofiaBankingResponse(message);
}

// Export auth helper
export async function login(email: string, password: string): Promise<User> {
  const data = await api<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  localStorage.setItem('xyz_token', data.token);
  return data.user;
}

export async function getGeminiStatus(): Promise<{ hasEnvKey: boolean; defaultModel: string; freeApiKeyUrl: string }> {
  return api('/api/simulation/call/gemini-status');
}

export async function testGeminiApiKey(geminiApiKey?: string): Promise<{ ok: boolean; model?: string; source?: string; message?: string; error?: string }> {
  return api('/api/simulation/call/gemini-test', {
    method: 'POST',
    body: JSON.stringify({ geminiApiKey })
  });
}

export async function startSimulationCall(callerName?: string, fromNumber?: string): Promise<SimCall> {
  return api<SimCall>('/api/simulation/call/start', {
    method: 'POST',
    body: JSON.stringify({ callerName, fromNumber })
  });
}

export async function sendSimulationMessage(
  callId: string,
  message: string,
  geminiApiKey?: string,
  history?: Array<{ role: 'user' | 'model'; text: string }>
): Promise<SimMessageResponse> {
  return api<SimMessageResponse>(`/api/simulation/call/${callId}/message`, {
    method: 'POST',
    body: JSON.stringify({ message, geminiApiKey, history })
  });
}

export async function sendSimulationAudio(
  callId: string,
  audioBase64: string,
  mimeType: string,
  geminiApiKey?: string,
  history?: Array<{ role: 'user' | 'model'; text: string }>,
  manual?: boolean,
  spokenText?: string
): Promise<SimMessageResponse & { transcribedText?: string }> {
  return api<SimMessageResponse & { transcribedText?: string }>(`/api/simulation/call/${callId}/audio`, {
    method: 'POST',
    body: JSON.stringify({ audioBase64, mimeType, geminiApiKey, history, manual, spokenText })
  });
}

export async function endSimulationCall(callId: string): Promise<{ ok: boolean; durationSeconds: number; status: string }> {
  return api<{ ok: boolean; durationSeconds: number; status: string }>(`/api/simulation/call/${callId}/end`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export async function synthesizeSpeechApi(
  text: string,
  voiceName = 'Aoede',
  geminiApiKey?: string
): Promise<{ audioBase64: string; mimeType: string }> {
  return api<{ audioBase64: string; mimeType: string }>('/api/simulation/call/tts', {
    method: 'POST',
    body: JSON.stringify({ text, voiceName, geminiApiKey })
  });
}
