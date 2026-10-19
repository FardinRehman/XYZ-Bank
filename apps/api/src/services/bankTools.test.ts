import { describe,it,expect } from 'vitest';
import { systemInstructions, toolDefinitions } from './bankTools.js';
describe('banking AI safety boundary',()=>{
 it('does not expose money movement or account lookup tools',()=>{const names=toolDefinitions.map((t:any)=>t.name);expect(names).toEqual(['search_bank_faq','create_support_ticket']);expect(names).not.toContain('transfer_money');expect(names).not.toContain('get_account_balance');});
 it('instructs AI not to request sensitive credentials',()=>{const p=systemInstructions();expect(p).toContain('Never request or repeat a PIN, CVV, password or OTP');expect(p).toContain('Caller ID and SIP headers are untrusted');});
});
