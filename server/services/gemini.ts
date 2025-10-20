import { GoogleGenerativeAI } from "@google/generative-ai";

// Helper function to clean raw response text and remove subject lines
function cleanResponseText(text: string): string {
  let cleaned = text.trim();
  
  // Remove any subject lines that might be present
  cleaned = cleaned.replace(/^Subject:\s*.*\n?/mi, '');
  cleaned = cleaned.replace(/^Re:\s*.*\n?/mi, '');
  cleaned = cleaned.replace(/^Fw:\s*.*\n?/mi, '');
  
  // Remove any remaining leading/trailing whitespace
  return cleaned.trim();
}

export async function generateEmailDraft(prompt: string, apiKey: string): Promise<{ subject: string; body: string }> {
  try {
    console.log("Generating email draft with API key:", apiKey ? "Present" : "Missing");
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error("API key is required");
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const systemPrompt = `Consider your job is to generate complete professional emails based on query. Make sure the email is concise and to the point. If you need to mention names anywhere, just fill them as {user name}, {receiver name}, {company name}. Important: never respond with any follow-up or random content, and make sure if there isn't a meaningful query then response must be "give a proper query".

CRITICAL: Respond with a JSON object containing both subject and body fields. Structure your response EXACTLY like this:
{
  "subject": "Brief descriptive subject line",
  "body": "Complete email body starting with greeting and ending with proper signature"
}

The body should be a complete email with proper closing like "Thanks" or "Best regards" followed by {user name} at the end. The email should be professional and appropriate for business communication with complete structure including greeting, body, and proper closing with signature. NEVER include subject lines or headers in the body field.`;

    const result = await model.generateContent(`${systemPrompt}\n\nUser query: ${prompt}`);
    const response = result.response;

    console.log("Generated email draft successfully");
    
    try {
      // Parse the JSON response and extract only the body
      const responseText = response.text() || "Failed to generate email draft";
      console.log("Response text:", responseText);
      
      // Clean up response text - remove code fences and extra whitespace
      let cleanedText = responseText.trim();
      
      // Remove markdown code fences if present
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      
      // Try to extract JSON object if wrapped in other text
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      
      const parsedResponse = JSON.parse(cleanedText);
      
      if (parsedResponse.body && parsedResponse.subject) {
        return {
          subject: parsedResponse.subject,
          body: parsedResponse.body
        };
      } else if (parsedResponse.body) {
        return {
          subject: "",
          body: parsedResponse.body
        };
      } else {
        // Fallback if no body field
        return {
          subject: "",
          body: cleanResponseText(responseText)
        };
      }
    } catch (parseError) {
      // Fallback to raw response if JSON parsing fails
      console.log("Failed to parse JSON response, using cleaned raw text");
      return {
        subject: "",
        body: cleanResponseText(response.text() || "Failed to generate email draft")
      };
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("Failed to generate email draft with AI");
  }
}

export async function improveEmail(text: string, action: string, apiKey: string, customPrompt?: string): Promise<string> {
  try {
    console.log("Improving email with API key:", apiKey ? "Present" : "Missing");
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error("API key is required");
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    let actionPrompt = "";
    
    // If custom prompt is provided, use it directly
    if (customPrompt && action === "custom") {
      actionPrompt = customPrompt;
    } else {
      // Use predefined prompts
      switch (action) {
        case "improve":
          actionPrompt = "Improve the writing style, clarity, and professionalism of this email while maintaining its meaning. Keep it concise and to the point:";
          break;
        case "shorten":
          actionPrompt = "Make this email more concise while preserving all important information:";
          break;
        case "lengthen":
          actionPrompt = "Expand this email with more detail and context while maintaining professionalism:";
          break;
        case "fix-grammar":
          actionPrompt = "Fix any spelling, grammar, and punctuation errors in this email:";
          break;
        case "simplify":
          actionPrompt = "Simplify the language and structure of this email to make it easier to understand:";
          break;
        case "rewrite":
          actionPrompt = "Rewrite this email in a more natural, conversational tone while keeping it professional:";
          break;
        default:
          actionPrompt = "Improve this email:";
      }
    }

    const result = await model.generateContent(`${actionPrompt}\n\n${text}`);
    const response = result.response;

    console.log("Email improved successfully");
    return response.text() || "Failed to improve email";
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("Failed to improve email with AI");
  }
}
