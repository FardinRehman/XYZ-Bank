import { env } from '../config.js';
import { executeBankTool, systemInstructions } from './bankTools.js';

export interface GeminiCallContext {
  callId: string;
  providerCallId: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
}

const CANDIDATE_CHAT_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3-flash-preview',
  'gemini-3.5-flash'
];

const CANDIDATE_TRANSCRIBE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite'
];

const CANDIDATE_TTS_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-3.8-flash-lite-tts',
  'gemini-2.5-flash-preview-tts',
  'gemini-3.8-flash-tts'
];

/**
 * Converts raw linear 16-bit mono PCM into standard WAV format with a 44-byte RIFF header
 */
function pcmToWav(pcmData: Buffer, sampleRate = 24000, numChannels = 1, bitDepth = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * numChannels * (bitDepth / 8);
  const blockAlign = numChannels * (bitDepth / 8);
  const dataSize = pcmData.length;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

/**
 * Executes a Gemini generateContent request with automatic model fallback
 */
async function fetchGeminiWithFallback(
  apiKey: string,
  payload: any,
  models: string[] = CANDIDATE_CHAT_MODELS
): Promise<{ data: any; model: string }> {
  let lastError: Error | null = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        return { data, model };
      }

      const errorText = await response.text();
      // If 503, 404, 429, or 400 (model incompatibilities), try next candidate model
      if (response.status === 503 || response.status === 404 || response.status === 429 || response.status === 400) {
        console.warn(`Gemini model ${model} returned ${response.status}. Trying next candidate model...`);
        lastError = new Error(`Gemini ${model} status ${response.status}`);
        continue;
      }

      let parsedMessage = errorText;
      try {
        const errJson = JSON.parse(errorText);
        parsedMessage = errJson.error?.message || errorText;
      } catch {}
      throw new Error(`Gemini API error (${response.status}): ${parsedMessage}`);
    } catch (e: any) {
      if (e.message && (e.message.includes('unavailable') || e.message.includes('fetch failed') || e.message.includes('limit') || e.message.includes('status 400'))) {
        lastError = e;
        continue;
      }
      throw e;
    }
  }

  throw lastError || new Error('All Gemini candidate models were unavailable.');
}

/**
 * Validates a Gemini API Key quickly with a tiny prompt
 */
export async function verifyGeminiApiKey(
  apiKeyInput?: string
): Promise<{ valid: boolean; model?: string; error?: string }> {
  const apiKey = (apiKeyInput || env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return { valid: false, error: 'No Gemini API key provided' };
  }

  try {
    const { model } = await fetchGeminiWithFallback(apiKey, {
      contents: [{ role: 'user', parts: [{ text: 'Respond with the single word OK.' }] }]
    });
    return { valid: true, model };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Validation failed' };
  }
}

/**
 * Transcribes caller audio using fast dedicated Gemini audio transcription
 * Supports English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, etc.
 */
export async function transcribeAudioWithGemini(
  audioBase64: string,
  mimeType = 'audio/webm',
  customApiKey?: string
): Promise<{ text: string; model: string }> {
  const apiKey = (customApiKey || env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('NO_GEMINI_KEY');
  }

  // Clean data url prefix if present
  const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');

  const { data, model } = await fetchGeminiWithFallback(
    apiKey,
    {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Transcribe the caller spoken words in this audio recording word-for-word in the language spoken (English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, etc.). Do not translate into English if another language is spoken—preserve the exact words in native script or transliteration. Output ONLY the transcribed words. Do not include markdown formatting or commentary. If there is only silence, background noise, or no recognizable human speech, respond with [SILENCE].'
            },
            {
              inlineData: {
                mimeType: mimeType.split(';')[0] || 'audio/webm',
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 250
      }
    },
    CANDIDATE_TRANSCRIBE_MODELS
  );

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const text = rawText.trim().replace(/^["']|["']$/g, '');
  const isSilence = !text || text.toUpperCase().includes('SILENCE') || text.includes('[SILENCE]');
  return {
    text: isSilence ? '' : text,
    model
  };
}

/**
 * Synthesizes natural human-sounding speech using Gemini 2.5 Flash TTS
 * Prebuilt voice "Aoede" sounds warm, empathetic, and speaks Hindi, Tamil, Telugu, Kannada, Malayalam, and English naturally
 */
export async function synthesizeSpeechWithGemini(
  text: string,
  voiceName = 'Aoede',
  customApiKey?: string
): Promise<{ audioBase64: string; mimeType: string }> {
  const apiKey = (customApiKey || env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('NO_GEMINI_KEY');
  }

  // Clean markdown asterisks and symbols so TTS pronounces words cleanly
  const cleanText = text
    .replace(/[*_#`~]/g, '')
    .replace(/\bINR\b/gi, 'Rupees')
    .replace(/₹\s*/g, 'Rupees ')
    .replace(/\bUPI\b/g, 'U P I')
    .replace(/\bOTP\b/g, 'O T P')
    .replace(/\bPIN\b/g, 'P I N')
    .replace(/\bCVV\b/g, 'C V V')
    .trim();

  const { data } = await fetchGeminiWithFallback(
    apiKey,
    {
      contents: [{ parts: [{ text: cleanText }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName || 'Aoede'
            }
          }
        }
      }
    },
    CANDIDATE_TTS_MODELS
  );

  const part = data.candidates?.[0]?.content?.parts?.[0];
  const audioData = part?.inlineData?.data;
  if (!audioData) {
    throw new Error('No audio returned by Gemini TTS');
  }

  const rawMime = (part?.inlineData?.mimeType || '').toLowerCase();
  if (rawMime.includes('wav')) {
    return {
      audioBase64: audioData,
      mimeType: 'audio/wav'
    };
  }

  const pcmBuffer = Buffer.from(audioData, 'base64');
  const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);

  return {
    audioBase64: wavBuffer.toString('base64'),
    mimeType: 'audio/wav'
  };
}

export async function askGeminiVoiceAssistant(
  userMessage: string,
  ctx: GeminiCallContext,
  customApiKey?: string
): Promise<{
  reply: string;
  tool: string | null;
  toolResult: any;
  transferred: boolean;
  model: string;
}> {
  const apiKey = (customApiKey || env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('NO_GEMINI_KEY');
  }

  const tools = [
    {
      functionDeclarations: [
        {
          name: 'search_bank_faq',
          description: 'Search approved published XYZ Bank FAQs and policies. Use for general banking queries only.',
          parameters: {
            type: 'OBJECT',
            properties: {
              query: { type: 'STRING', description: 'Search term such as UPI failed payment, fees, card safety' }
            },
            required: ['query']
          }
        },
        {
          name: 'create_support_ticket',
          description: 'Create an official bank support ticket when the caller reports an unresolved issue, complaint, or dispute.',
          parameters: {
            type: 'OBJECT',
            properties: {
              category: { type: 'STRING', description: 'Category: payments, cards, or general' },
              subject: { type: 'STRING', description: 'Short summary of the complaint' },
              description: { type: 'STRING', description: 'Details of the caller issue' }
            },
            required: ['category', 'subject', 'description']
          }
        },
        {
          name: 'request_human_transfer',
          description: 'Transfer the caller to a human bank supervisor when explicitly requested or required.',
          parameters: {
            type: 'OBJECT',
            properties: {
              reason: { type: 'STRING', description: 'Reason for escalating to a human specialist' }
            },
            required: ['reason']
          }
        }
      ]
    }
  ];

  const contents: any[] = [];
  if (ctx.history && ctx.history.length > 0) {
    for (const h of ctx.history.slice(-6)) {
      contents.push({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.text }]
      });
    }
  }
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  const promptBody = {
    systemInstruction: {
      parts: [
        {
          text: systemInstructions() +
            "\n\nMULTILINGUAL & HUMAN VOICE GUIDELINES:\n" +
            "- You are speaking aloud over the phone as a warm, friendly, calm, empathetic banking customer care specialist for XYZ Bank.\n" +
            "- MULTILINGUAL FLUENCY: Always detect and respond in the exact language the caller speaks (English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, etc.) or natural Indian bilingual speech (Hinglish/Tanglish).\n" +
            "- HUMAN CADENCE & TONE: Greet warmly in the caller's culture ('Namaste', 'Vanakkam', 'Namaskara', 'Namaskaram', or 'Good day'). Speak like a polite, caring human professional, never stiff or robotic.\n" +
            "- SPOKEN FORMATTING: Keep replies concise (1 to 3 conversational sentences). NEVER use markdown asterisks (**bold**), bullet points (-), numbered lists (1.), or special symbols. Spell out currency ('Rupees' instead of 'INR' or '₹') and abbreviations ('U P I', 'P I N', 'O T P') so they sound natural when spoken aloud.\n" +
            "- TOOL CALLING RULES:\n" +
            "  * If the caller reports a problem, complaint, grievance, dispute, or unauthorized transaction, immediately call 'create_support_ticket'.\n" +
            "  * If the caller asks about bank procedures, UPI issues, card safety, or policies, call 'search_bank_faq'.\n" +
            "  * If the caller asks to talk to a human, person, agent, or manager, immediately call 'request_human_transfer'.\n" +
            "  * STRICT SAFETY: Never ask for or repeat PIN, CVV, password, or OTP."
        }
      ]
    },
    contents,
    tools,
    toolConfig: {
      functionCallingConfig: {
        mode: 'AUTO'
      }
    },
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 250
    }
  };

  const { data, model } = await fetchGeminiWithFallback(apiKey, promptBody);
  const candidate = data.candidates?.[0];
  const part = candidate?.content?.parts?.[0];

  // Tool Call Handling
  if (part?.functionCall) {
    const fnName = part.functionCall.name;
    const fnArgs = part.functionCall.args || {};

    if (fnName === 'request_human_transfer') {
      return {
        reply: "I understand you would like to speak with a human specialist. I am transferring your call right now to our senior customer support desk. Please hold on.",
        tool: 'request_human_transfer',
        toolResult: { reason: fnArgs.reason || 'Caller requested human agent' },
        transferred: true,
        model
      };
    }

    // Execute bank tool in real database
    const toolResult = await executeBankTool(fnName, fnArgs, {
      callId: ctx.callId,
      providerCallId: ctx.providerCallId
    });

    // Provide tool result back to Gemini preserving candidate content (with thoughtSignature)
    const secondContents = [
      ...contents,
      candidate.content,
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: fnName,
              response: { result: toolResult }
            }
          }
        ]
      }
    ];

    try {
      const secondUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const secondResp = await fetch(secondUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: promptBody.systemInstruction,
          contents: secondContents,
          tools,
          generationConfig: { temperature: 0.6, maxOutputTokens: 250 }
        })
      });

      if (secondResp.ok) {
        const secondData = await secondResp.json();
        const secondCandidate = secondData.candidates?.[0];
        const secondParts = secondCandidate?.content?.parts || [];
        const secondFnPart = secondParts.find((p: any) => p.functionCall);
        const secondTextPart = secondParts.find((p: any) => typeof p.text === 'string' && p.text.trim().length > 0);

        // Chained tool call in second turn (e.g. search_bank_faq -> create_support_ticket)
        if (secondFnPart?.functionCall) {
          const secondFn = secondFnPart.functionCall.name;
          const secondArgs = secondFnPart.functionCall.args || {};
          const secondToolResult = await executeBankTool(secondFn, secondArgs, {
            callId: ctx.callId,
            providerCallId: ctx.providerCallId
          });
          const secAny = secondToolResult as any;

          if (secondFn === 'create_support_ticket') {
            return {
              reply: `I have registered official support ticket ${secAny?.referenceCode || 'XYZ-SUPPORT'} for your complaint under category ${secAny?.category || 'general'}. Our customer care team will follow up. Is there anything else I can help you with today?`,
              tool: secondFn,
              toolResult: secondToolResult,
              transferred: false,
              model
            };
          } else if (secondFn === 'request_human_transfer') {
            return {
              reply: "I understand. I am transferring your call right now to our senior customer support desk. Please hold on.",
              tool: secondFn,
              toolResult: secondToolResult,
              transferred: true,
              model
            };
          }
        }

        if (secondTextPart?.text) {
          // Clean any markdown formatting for voice synthesis
          const cleanVoiceText = secondTextPart.text.replace(/[*_#`]/g, '').trim();
          return {
            reply: cleanVoiceText,
            tool: fnName,
            toolResult,
            transferred: false,
            model
          };
        }
      }
    } catch (e) {
      console.warn('Second Gemini turn failed, using synthesized result', e);
    }

    // Reliable voice synthesis fallback for tools
    const resAny = toolResult as any;
    if (fnName === 'create_support_ticket') {
      return {
        reply: `I have registered official support ticket ${resAny?.referenceCode || 'XYZ-SUPPORT'} for you under category ${resAny?.category || 'general'}. Our customer care team will follow up. Is there anything else I can help you with today?`,
        tool: fnName,
        toolResult,
        transferred: false,
        model
      };
    } else if (fnName === 'search_bank_faq') {
      if (resAny?.found && Array.isArray(resAny.articles) && resAny.articles[0]) {
        return {
          reply: `According to XYZ Bank policy for ${resAny.articles[0].title}: ${resAny.articles[0].content} Can I help you with anything else today?`,
          tool: fnName,
          toolResult,
          transferred: false,
          model
        };
      }
      return {
        reply: "I checked our approved bank policies, but I couldn't find an exact match for your inquiry. Would you like me to open a support ticket for this issue, or would you prefer I transfer you to a human representative?",
        tool: fnName,
        toolResult,
        transferred: false,
        model
      };
    }
  }

  const rawText = part?.text || "Thank you for contacting XYZ Bank. How may I help you today?";
  const cleanVoiceText = rawText.replace(/[*_#`]/g, '').trim();

  return {
    reply: cleanVoiceText,
    tool: null,
    toolResult: null,
    transferred: false,
    model
  };
}
