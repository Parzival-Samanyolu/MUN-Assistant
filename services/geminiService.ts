import { GoogleGenAI, Modality } from "@google/genai";
import { DetailLevel } from "../types";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateMUNSummary(country: string, topic: string, detailLevel: DetailLevel, includeHistory: boolean): Promise<string> {

  let detailInstruction = '';
  switch (detailLevel) {
    case 'concise':
      detailInstruction = `
        **Output Format Instructions:**
        - The briefing must be extremely concise and high-level. The entire summary should not exceed 150 words.
        - For each section, provide only a single, impactful sentence or one key bullet point.
        - Focus only on the absolute most critical information a delegate would need for a quick pre-committee reminder.
      `;
      break;
    case 'detailed':
      detailInstruction = `
        **Output Format Instructions:**
        - The briefing must be exhaustive and deeply detailed.
        - Expand significantly on each point with extensive historical context, specific data points, direct quotes from officials if available, and nuanced policy details.
        - Explore counter-arguments and alternative perspectives where applicable. The goal is a comprehensive research document.
      `;
      break;
    case 'standard':
    default:
      detailInstruction = `
        **Output Format Instructions:**
        - The briefing should be well-structured, informative, and written in a formal tone suitable for a MUN delegate's preparation.
        - Provide a comprehensive summary covering all key points.
      `;
      break;
  }

  const historySection = includeHistory ? `
### Relevant Historical Background
- Provide a concise summary of the country's historical involvement with the MUN topic. This section must not exceed 100 words.
- Highlight only the most crucial historical events or policies that have fundamentally shaped the country's current perspective on this issue.
` : '';


  const prompt = `
    Act as an expert political analyst and Model UN delegate advisor.
    Your task is to generate a country briefing for a Model United Nations (MUN) conference.

    Country: ${country}
    MUN Committee Topic: "${topic}"

    ${detailInstruction}

    Please provide a detailed summary covering the following key points, tailored specifically to the given country and topic. Structure your response using Markdown for formatting, with clear headings for each section.

    ### Country's Stance
    - A clear and concise overview of the country's official position on the topic.
    - Include historical context and key policy drivers that shape this stance.
    - Mention any internal political factors influencing the country's position.

    ### Relevant International Agreements and UN Involvement
    - List any significant international treaties, conventions, or UN resolutions the country has signed, ratified, or is actively involved in that relate to the topic.
    - Detail the country's voting record on key past resolutions related to the issue.

    ### Key Allies and Blocs
    - Identify the country's main allies and the political, economic, or regional blocs it aligns with on this specific issue (e.g., G77, EU, African Union, Arab League, etc.).
    - Briefly explain the nature of these alliances regarding the topic.

    ### Potential Solutions and Policy Proposals
    - Suggest actionable solutions or clauses that a delegate representing this country could propose in a draft resolution.
    - These proposals must be in line with the country's established foreign policy and national interests.

    ### Recent Actions and Statements
    - Summarize any recent actions taken or official statements made by the country's government, leaders, or UN representatives regarding the topic (within the last 1-2 years).

    ${historySection}

    The briefing should be well-structured, informative, and written in a formal tone suitable for a MUN delegate's preparation.
    Ensure you use Markdown headings (e.g., '### Section Title') for each section, not bolded text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating summary with Gemini API:", error);
    if (error instanceof Error) {
        // Check for specific error messages from the Gemini API
        if (error.message.includes('API key not valid')) {
            throw new Error("Invalid API Key. Please check if the API key is correct and has the necessary permissions.");
        }
        if (error.message.toLowerCase().includes('network') || error.message.includes('fetch failed')) {
            throw new Error("Network error. Please check your internet connection.");
        }
    }
    // Generic fallback error
    throw new Error("Failed to get a response from the Gemini API. The service may be temporarily unavailable.");
  }
}

export async function generatePronunciationAudio(country: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: country }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
          },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("No audio data received from API.");
      }
      return base64Audio;
  } catch(error) {
    console.error("Error generating pronunciation audio:", error);
    throw new Error("Failed to generate pronunciation audio.");
  }
}