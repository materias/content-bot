import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { config } from '../config.js';
import { CaptionResultSchema, SYSTEM_PROMPT, type CaptionResult } from './prompt.js';

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

export interface AnalyzeImageInput {
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  bakerNote: string;
}

export async function analyzeImage({
  imageBase64,
  mediaType,
  bakerNote,
}: AnalyzeImageInput): Promise<CaptionResult> {
  const response = await client.messages.parse({
    model: config.ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          {
            type: 'text',
            text: bakerNote.trim()
              ? `Заметка хозяйки: ${bakerNote.trim()}`
              : 'Хозяйка не оставила заметку — опиши только то, что видно на фото.',
          },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(CaptionResultSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error('Claude returned output that failed schema validation');
  }

  return response.parsed_output;
}
