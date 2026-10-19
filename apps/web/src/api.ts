const API = (import.meta.env.VITE_API_URL as string | undefined) || '';
export type User={id:string;email:string;displayName:string;role:string};
export function getToken(){return localStorage.getItem('xyz_token')||'';}
export async function api<T>(path:string,init:RequestInit={}):Promise<T>{
  const token=getToken();
  const r=await fetch(`${API}${path}`,{
    ...init,
    headers:{
      'Content-Type':'application/json',
      ...(token?{Authorization:`Bearer ${token}`}:{}),
      ...(init.headers||{})
    }
  });
  if(!r.ok){
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
  }
  return r.json();
}
export async function login(email:string,password:string){
  const data=await api<{token:string;user:User}>('/api/auth/login',{
    method:'POST',
    body:JSON.stringify({email,password})
  });
  localStorage.setItem('xyz_token',data.token);
  return data.user;
}

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
  manual?: boolean
): Promise<SimMessageResponse & { transcribedText?: string }> {
  return api<SimMessageResponse & { transcribedText?: string }>(`/api/simulation/call/${callId}/audio`, {
    method: 'POST',
    body: JSON.stringify({ audioBase64, mimeType, geminiApiKey, history, manual })
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

