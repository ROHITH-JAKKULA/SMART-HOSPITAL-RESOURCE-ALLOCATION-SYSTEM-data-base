import express, { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json({ limit: "50mb" }));

// Initialize GoogleGenAI server-side instance
const getAIClient = () => {
  return new GoogleGenAI({});
};

// 1. Gemini Chat with Multi-turn history, Search Grounding, and Maps Grounding
app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const { messages, model = "gemini-3.5-flash", useSearch = false, useMaps = false, systemInstruction } = req.body;
    const ai = getAIClient();

    const tools: any[] = [];
    if (useSearch) {
      tools.push({ googleSearch: {} });
    } else if (useMaps) {
      tools.push({ googleMaps: {} });
    }

    const config: any = {
      systemInstruction: systemInstruction || "You are the AI Medical Triage & Clinical Resource Advisor for the Smart Hospital Resource Allocation System. Provide clinical insights, explain priority scores, advise on hospital capacity, and answer medical logistics queries.",
    };

    if (tools.length > 0) {
      config.tools = tools;
    }

    const formattedContents = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model,
      contents: formattedContents,
      config,
    });

    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;

    res.json({
      text: response.text || "No response received.",
      groundingMetadata,
    });
  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message || "Failed to process chat message." });
  }
});

// 2. Audio Transcription using gemini-3.5-transcribe
app.post("/api/transcribe", async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = "audio/webm" } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "Missing audio data." });
    }

    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-transcribe",
      contents: [
        {
          inlineData: {
            mimeType,
            data: audioBase64,
          },
        },
        { text: "Transcribe this clinical audio recording accurately. Include patient vitals, symptoms, and urgency notes if present." },
      ],
    });

    res.json({ text: response.text || "No transcription generated." });
  } catch (error: any) {
    console.error("Transcribe error:", error);
    res.status(500).json({ error: error.message || "Failed to transcribe audio." });
  }
});

// 3. Image Generation and Editing using gemini-3.1-flash-image-preview
app.post("/api/generate-image", async (req: Request, res: Response) => {
  try {
    const { prompt, aspectRatio = "1:1", inputImageBase64, inputMimeType = "image/png" } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt." });
    }

    const ai = getAIClient();
    const contents: any[] = [];
    if (inputImageBase64) {
      contents.push({
        inlineData: {
          mimeType: inputMimeType,
          data: inputImageBase64,
        },
      });
    }
    contents.push({ text: prompt });

    const config: any = {};
    if (aspectRatio) {
      config.imageConfig = { aspectRatio };
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents,
      config,
    });

    let imageUrl: string | null = null;
    let description = "";

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      } else if (part.text) {
        description += part.text;
      }
    }

    if (!imageUrl) {
      return res.status(500).json({ error: "No image was returned by the model." });
    }

    res.json({ imageUrl, description });
  } catch (error: any) {
    console.error("Image generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate image." });
  }
});

// 4. Music Generation using lyria-3-clip-preview
app.post("/api/generate-music", async (req: Request, res: Response) => {
  try {
    const { prompt, model = "lyria-3-clip-preview" } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Missing music prompt." });
    }

    const ai = getAIClient();
    const responseStream = await ai.models.generateContentStream({
      model,
      contents: prompt,
    });

    let audioBase64 = "";
    let lyrics = "";
    let mimeType = "audio/wav";

    for await (const chunk of responseStream) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
        if (part.text && !lyrics) {
          lyrics = part.text;
        }
      }
    }

    res.json({ audioBase64, mimeType, lyrics });
  } catch (error: any) {
    console.error("Music generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate music." });
  }
});

// 5. Video Generation using veo-3.1-fast-generate-preview
app.post("/api/generate-video", async (req: Request, res: Response) => {
  try {
    const { prompt, aspectRatio = "16:9", imageBase64, imageMimeType = "image/png" } = req.body;
    if (!prompt && !imageBase64) {
      return res.status(400).json({ error: "Missing prompt or image for video generation." });
    }

    const ai = getAIClient();
    const videoConfig: any = {
      model: "veo-3.1-fast-generate-preview",
      prompt: prompt || "A slow cinematic pan of a high-tech modern hospital emergency triage ward with glowing telemetry screens.",
      config: {
        aspectRatio: aspectRatio as "16:9" | "9:16",
      },
    };

    if (imageBase64) {
      videoConfig.image = {
        imageBytes: imageBase64,
        mimeType: imageMimeType,
      };
    }

    let operation = await ai.models.generateVideos(videoConfig);

    // Poll until video is ready
    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    res.json({ videoUri, done: true });
  } catch (error: any) {
    console.error("Video generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate video." });
  }
});

// Serve Vite in development or static assets in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true, host: "0.0.0.0" },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Smart Hospital Resource Allocation Server running at http://0.0.0.0:${port}`);
  });
}

startServer();
