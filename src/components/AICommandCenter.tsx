import React, { useState, useRef } from "react";
import {
  MessageSquare,
  Mic,
  Square,
  Image as ImageIcon,
  Music,
  Video,
  Send,
  Sparkles,
  Search,
  MapPin,
  Bot,
  User,
  Play,
  Loader2,
  AlertCircle,
  FileAudio,
} from "lucide-react";

interface AICommandCenterProps {
  currentScenarioSummary: string;
}

export const AICommandCenter: React.FC<AICommandCenterProps> = ({ currentScenarioSummary }) => {
  const [activeTab, setActiveTab] = useState<"chat" | "transcribe" | "image" | "music" | "video">("chat");

  // Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "model"; text: string; grounding?: any }>>([
    {
      role: "model",
      text: "Hello! I am your AI Medical Triage & Clinical Resource Advisor. Ask me anything about the current patient queue, priority scoring trade-offs, clinical protocols, or emergency hospital operations. Search and Maps grounding are available.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatModel, setChatModel] = useState("gemini-3.5-flash");
  const [useSearch, setUseSearch] = useState(false);
  const [useMaps, setUseMaps] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Transcribe State
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState("");
  const [transcribeLoading, setTranscribeLoading] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Image State
  const [imagePrompt, setImagePrompt] = useState("Architectural 3D floor plan layout of a modern hospital intensive care unit (ICU) and emergency department with telemetry stations.");
  const [imageAspectRatio, setImageAspectRatio] = useState<"1:1" | "16:9" | "4:3">("16:9");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Music State
  const [musicPrompt, setMusicPrompt] = useState("A 30-second calm ambient synthesizer pad for hospital recovery ward, soothing and restorative.");
  const [musicModel, setMusicModel] = useState("lyria-3-clip-preview");
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);

  // Video State
  const [videoPrompt, setVideoPrompt] = useState("A slow cinematic camera dolly shot through a modern high-tech hospital emergency triage center with vital signs monitoring screens.");
  const [videoAspectRatio, setVideoAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [generatedVideoUri, setGeneratedVideoUri] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Chat Submission
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    const newHistory = [...chatMessages, { role: "user" as const, text: userMsg }];
    setChatMessages(newHistory);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory,
          model: chatModel,
          useSearch,
          useMaps,
          systemInstruction: `You are the AI Medical Triage Intelligence Advisor for the Smart Hospital Resource Allocation System.\nCurrent System State: ${currentScenarioSummary}\nAdvise on medical urgency, clinical triage protocols, DAA resource allocation logic, and local hospital logistics. Ground answers with Search or Maps when requested.`,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chat failed");

      setChatMessages([...newHistory, { role: "model", text: data.text, grounding: data.groundingMetadata }]);
    } catch (err: any) {
      setChatError(err.message || "Failed to reach AI service.");
    } finally {
      setChatLoading(false);
    }
  };

  // Microphone Transcription Recording
  const startRecording = async () => {
    setTranscribeError(null);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];
          await sendAudioToTranscribe(base64Audio, "audio/webm");
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      setTranscribeError("Microphone access denied or unsupported: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioToTranscribe = async (audioBase64: string, mimeType: string) => {
    setTranscribeLoading(true);
    setTranscribeError(null);
    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Transcription failed");
      setTranscriptionText(data.text);
    } catch (err: any) {
      setTranscribeError(err.message || "Failed to transcribe audio.");
    } finally {
      setTranscribeLoading(false);
    }
  };

  // Image Generation
  const handleGenerateImage = async () => {
    setImageLoading(true);
    setImageError(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompt,
          aspectRatio: imageAspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Image generation failed");
      setGeneratedImageUrl(data.imageUrl);
    } catch (err: any) {
      setImageError(err.message || "Failed to generate image.");
    } finally {
      setImageLoading(false);
    }
  };

  // Music Generation
  const handleGenerateMusic = async () => {
    setMusicLoading(true);
    setMusicError(null);
    try {
      const res = await fetch("/api/generate-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: musicPrompt,
          model: musicModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Music generation failed");
      if (data.audioBase64) {
        setGeneratedAudioUrl(`data:${data.mimeType || "audio/wav"};base64,${data.audioBase64}`);
      }
    } catch (err: any) {
      setMusicError(err.message || "Failed to generate music.");
    } finally {
      setMusicLoading(false);
    }
  };

  // Video Generation
  const handleGenerateVideo = async () => {
    setVideoLoading(true);
    setVideoError(null);
    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: videoPrompt,
          aspectRatio: videoAspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Video generation failed");
      setGeneratedVideoUri(data.videoUri);
    } catch (err: any) {
      setVideoError(err.message || "Failed to generate video.");
    } finally {
      setVideoLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              AI Clinical Command Center & Multimodal Suite
            </h2>
            <p className="text-xs text-slate-500">
              Gemini 3 Multi-Turn Chat, Search & Maps Grounding, Audio Transcription, Image Generation, Lyria Music, and Veo Video.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded transition ${
            activeTab === "chat" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Gemini Chat & Grounding</span>
        </button>

        <button
          onClick={() => setActiveTab("transcribe")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded transition ${
            activeTab === "transcribe" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Audio Triage Transcription</span>
        </button>

        <button
          onClick={() => setActiveTab("image")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded transition ${
            activeTab === "image" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Create & Edit Images</span>
        </button>

        <button
          onClick={() => setActiveTab("music")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded transition ${
            activeTab === "music" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          <span>Music & Alert Audio (Lyria)</span>
        </button>

        <button
          onClick={() => setActiveTab("video")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded transition ${
            activeTab === "video" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Video Simulation (Veo 3)</span>
        </button>
      </div>

      {/* 1. CHATBOT TAB */}
      {activeTab === "chat" && (
        <div className="space-y-3">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between bg-slate-50 p-2.5 rounded border border-slate-200 gap-3 text-xs">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5">
                <span className="font-semibold text-slate-700">Model:</span>
                <select
                  value={chatModel}
                  onChange={(e) => setChatModel(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 font-medium outline-hidden"
                >
                  <option value="gemini-3.5-flash">gemini-3.5-flash (General Triage)</option>
                  <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Complex Clinical)</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast Response)</option>
                </select>
              </div>

              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSearch}
                  onChange={(e) => {
                    setUseSearch(e.target.checked);
                    if (e.target.checked) setUseMaps(false);
                  }}
                  className="rounded text-indigo-600 accent-indigo-600"
                />
                <Search className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-medium text-slate-700">Google Search Grounding</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useMaps}
                  onChange={(e) => {
                    setUseMaps(e.target.checked);
                    if (e.target.checked) setUseSearch(false);
                  }}
                  className="rounded text-indigo-600 accent-indigo-600"
                />
                <MapPin className="w-3.5 h-3.5 text-rose-600" />
                <span className="font-medium text-slate-700">Google Maps Grounding</span>
              </label>
            </div>
          </div>

          {/* Chat Messages Thread */}
          <div className="h-72 bg-slate-50 border border-slate-200 rounded p-3 overflow-y-auto space-y-3 text-xs">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex space-x-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "model" && (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] p-3 rounded-lg leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-white border border-slate-200 text-slate-800 shadow-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.grounding && (
                    <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                      <strong>Grounding Sources:</strong>{" "}
                      {msg.grounding.webSearchQueries?.join(", ") || "Google Search Verified"}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center space-x-2 text-slate-400 text-xs italic">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Gemini is analyzing clinical triage query...</span>
              </div>
            )}
          </div>

          {chatError && (
            <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{chatError}</span>
            </div>
          )}

          {/* Chat Input */}
          <form onSubmit={handleSendChat} className="flex space-x-2">
            <input
              type="text"
              placeholder="Ask about patient priorities, bed bottlenecks, or clinical triage protocols..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded px-3 py-2 text-xs outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold text-xs rounded transition flex items-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}

      {/* 2. TRANSCRIBE TAB */}
      {activeTab === "transcribe" && (
        <div className="space-y-4 text-xs">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col items-center justify-center space-y-3 text-center">
            <Mic className="w-8 h-8 text-indigo-600" />
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Microphone Clinical Audio Transcriber</h4>
              <p className="text-slate-500 text-xs">Uses model <strong>gemini-3.5-transcribe</strong> to convert spoken triage notes to text.</p>
            </div>

            <div className="flex space-x-3">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={transcribeLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow-xs transition flex items-center space-x-1.5"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Recording</span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded shadow-xs transition flex items-center space-x-1.5 animate-pulse"
                >
                  <Square className="w-4 h-4 fill-current text-red-500" />
                  <span>Stop & Transcribe</span>
                </button>
              )}
            </div>

            {transcribeLoading && (
              <div className="flex items-center space-x-2 text-indigo-700 font-medium pt-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Transcribing audio with gemini-3.5-transcribe...</span>
              </div>
            )}
          </div>

          {transcribeError && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{transcribeError}</span>
            </div>
          )}

          {transcriptionText && (
            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
              <span className="font-bold text-slate-800 block flex items-center space-x-1.5">
                <FileAudio className="w-4 h-4 text-emerald-600" />
                <span>Transcribed Clinical Triage Note:</span>
              </span>
              <p className="p-2.5 bg-slate-50 rounded text-slate-800 font-mono leading-relaxed whitespace-pre-wrap">
                {transcriptionText}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. IMAGE GENERATION TAB */}
      {activeTab === "image" && (
        <div className="space-y-4 text-xs">
          <div className="space-y-2">
            <label className="font-semibold text-slate-700">Image Prompt (Model: gemini-3.1-flash-image-preview)</label>
            <textarea
              rows={2}
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded p-2.5 outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Aspect Ratio:</span>
              <select
                value={imageAspectRatio}
                onChange={(e) => setImageAspectRatio(e.target.value as any)}
                className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800 font-medium"
              >
                <option value="16:9">16:9 (Landscape)</option>
                <option value="1:1">1:1 (Square)</option>
                <option value="4:3">4:3 (Standard)</option>
              </select>
            </div>

            <button
              onClick={handleGenerateImage}
              disabled={imageLoading}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded shadow-xs transition flex items-center space-x-1.5 ml-auto"
            >
              {imageLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{imageLoading ? "Generating..." : "Generate Image"}</span>
            </button>
          </div>

          {imageError && (
            <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{imageError}</span>
            </div>
          )}

          {generatedImageUrl && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center space-y-2">
              <img
                src={generatedImageUrl}
                alt="Generated clinical visual"
                className="max-h-72 rounded mx-auto border border-slate-200 shadow-sm"
              />
              <span className="text-[10px] text-slate-400 block font-mono">Generated with gemini-3.1-flash-image-preview</span>
            </div>
          )}
        </div>
      )}

      {/* 4. MUSIC GENERATION TAB */}
      {activeTab === "music" && (
        <div className="space-y-4 text-xs">
          <div className="space-y-2">
            <label className="font-semibold text-slate-700">Music / Alert Audio Prompt (Lyria)</label>
            <textarea
              rows={2}
              value={musicPrompt}
              onChange={(e) => setMusicPrompt(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded p-2.5 outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Model:</span>
              <select
                value={musicModel}
                onChange={(e) => setMusicModel(e.target.value)}
                className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800 font-medium"
              >
                <option value="lyria-3-clip-preview">lyria-3-clip-preview (Up to 30s clips)</option>
                <option value="lyria-3-pro-preview">lyria-3-pro-preview (Full tracks)</option>
              </select>
            </div>

            <button
              onClick={handleGenerateMusic}
              disabled={musicLoading}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded shadow-xs transition flex items-center space-x-1.5 ml-auto"
            >
              {musicLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{musicLoading ? "Synthesizing Audio..." : "Generate Music"}</span>
            </button>
          </div>

          {musicError && (
            <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{musicError}</span>
            </div>
          )}

          {generatedAudioUrl && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center space-y-3">
              <span className="font-bold text-slate-800 block">Generated Audio Track</span>
              <audio controls src={generatedAudioUrl} className="w-full max-w-md mx-auto" />
            </div>
          )}
        </div>
      )}

      {/* 5. VIDEO GENERATION TAB */}
      {activeTab === "video" && (
        <div className="space-y-4 text-xs">
          <div className="space-y-2">
            <label className="font-semibold text-slate-700">Video Prompt (Model: veo-3.1-fast-generate-preview)</label>
            <textarea
              rows={2}
              value={videoPrompt}
              onChange={(e) => setVideoPrompt(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded p-2.5 outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Aspect Ratio:</span>
              <select
                value={videoAspectRatio}
                onChange={(e) => setVideoAspectRatio(e.target.value as any)}
                className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800 font-medium"
              >
                <option value="16:9">16:9 (Landscape)</option>
                <option value="9:16">9:16 (Portrait)</option>
              </select>
            </div>

            <button
              onClick={handleGenerateVideo}
              disabled={videoLoading}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded shadow-xs transition flex items-center space-x-1.5 ml-auto"
            >
              {videoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
              <span>{videoLoading ? "Rendering Video..." : "Generate Video"}</span>
            </button>
          </div>

          {videoError && (
            <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{videoError}</span>
            </div>
          )}

          {generatedVideoUri && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center space-y-2">
              <video controls src={generatedVideoUri} className="max-h-72 rounded mx-auto border border-slate-200 shadow-sm" />
              <span className="text-[10px] text-slate-400 block font-mono">Rendered with Veo 3</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
