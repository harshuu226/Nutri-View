import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

// ─── DIRECT GEMINI CALL (frontend-only mode when no backend) ─────────────────
async function analyzeWithGemini(base64Image, mimeType = "image/jpeg") {
  if (!GEMINI_KEY) {
    throw new Error("Gemini API key not configured. Add VITE_GEMINI_API_KEY to .env");
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `You are a professional nutritionist AI. Analyze this food image and return ONLY valid JSON (no markdown, no explanation):
{
  "foodName": "Specific food name",
  "foodDescription": "Brief appetizing description",
  "confidence": 85,
  "servingSize": "1 serving (approx 200g)",
  "mealType": "lunch",
  "nutrition": {
    "calories": 350,
    "protein": 28,
    "carbohydrates": 35,
    "fat": 10,
    "fiber": 4,
    "sugar": 6,
    "sodium": 520,
    "cholesterol": 75,
    "vitamins": {
      "vitaminA": { "amount": 150, "unit": "mcg", "dailyValue": 17 },
      "vitaminC": { "amount": 12, "unit": "mg", "dailyValue": 13 },
      "vitaminD": { "amount": 1.5, "unit": "mcg", "dailyValue": 8 },
      "vitaminE": { "amount": 2, "unit": "mg", "dailyValue": 13 },
      "vitaminK": { "amount": 15, "unit": "mcg", "dailyValue": 13 },
      "vitaminB12": { "amount": 1.2, "unit": "mcg", "dailyValue": 50 },
      "folate": { "amount": 40, "unit": "mcg", "dailyValue": 10 }
    },
    "minerals": {
      "calcium": { "amount": 120, "unit": "mg", "dailyValue": 9 },
      "iron": { "amount": 3, "unit": "mg", "dailyValue": 17 },
      "magnesium": { "amount": 45, "unit": "mg", "dailyValue": 11 },
      "potassium": { "amount": 420, "unit": "mg", "dailyValue": 9 },
      "zinc": { "amount": 3, "unit": "mg", "dailyValue": 27 }
    },
    "dailyValues": {
      "calories": 18,
      "protein": 56,
      "carbohydrates": 12,
      "fat": 13,
      "fiber": 14,
      "sugar": null,
      "sodium": 23
    }
  },
  "tags": {
    "isHighProtein": true,
    "isLowCarb": false,
    "isHighFat": false,
    "isJunkFood": false,
    "isVegan": false,
    "isVegetarian": false,
    "isGlutenFree": false
  },
  "healthScore": 72,
  "healthInsights": ["Good source of lean protein", "Rich in iron", "Watch sodium levels"]
}`
            },
            { inlineData: { mimeType, data: base64Image } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
      })
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Gemini API error");
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
}

// ─── API HELPERS ──────────────────────────────────────────────────────────────
const api = {
  async request(path, options = {}) {
    const token = localStorage.getItem("lens_token");
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  },
  post: (path, body) => api.request(path, { method: "POST", body: JSON.stringify(body) }),
  get: (path) => api.request(path),
  delete: (path) => api.request(path, { method: "DELETE" }),
};

// ─── UTILITY HELPERS ─────────────────────────────────────────────────────────
const getHealthColor = (score) => {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  if (score >= 25) return "#f97316";
  return "#ef4444";
};

const getHealthLabel = (score) => {
  if (score >= 75) return "Excellent";
  if (score >= 50) return "Good";
  if (score >= 25) return "Fair";
  return "Poor";
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function LoadingSpinner({ size = 32, color = "#a78bfa" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: size, height: size, border: `3px solid rgba(167,139,250,0.2)`,
        borderTop: `3px solid ${color}`, borderRadius: "50%",
        animation: "spin 0.8s linear infinite"
      }} />
    </div>
  );
}

function NutrientBar({ label, value, max, unit, color, dailyValue }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13 }}>
        <span style={{ color: "#cbd5e1", fontWeight: 500 }}>{label}</span>
        <span style={{ color: "#f8fafc", fontWeight: 600 }}>
          {value}{unit}
          {dailyValue != null && (
            <span style={{ color: "#94a3b8", marginLeft: 6, fontSize: 11 }}>{dailyValue}% DV</span>
          )}
        </span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 99, height: 7, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%", background: color,
          borderRadius: 99, transition: "width 1s cubic-bezier(0.4,0,0.2,1)"
        }} />
      </div>
    </div>
  );
}

function HealthTag({ label, color, bg, icon }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "5px 12px", borderRadius: 99,
      background: bg, color: color, fontSize: 12, fontWeight: 600,
      border: `1px solid ${color}30`
    }}>
      <span>{icon}</span> {label}
    </div>
  );
}

function CircularScore({ score }) {
  const color = getHealthColor(score);
  const label = getHealthLabel(score);
  const circumference = 2 * Math.PI * 40;
  const strokeDash = (score / 100) * circumference;

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: 110, height: 110, margin: "0 auto" }}>
        <svg width="110" height="110" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="55" cy="55" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="55" cy="55" r="40" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1.5s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center"
        }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>{score}</span>
          <span style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>/ 100</span>
        </div>
      </div>
      <div style={{ marginTop: 6, color, fontWeight: 700, fontSize: 14 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Health Score</div>
    </div>
  );
}

// ─── PAGES ────────────────────────────────────────────────────────────────────

function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      let result;
      if (isLogin) {
        result = await api.post("/auth/login", { email: form.email, password: form.password });
      } else {
        result = await api.post("/auth/register", form);
      }
      localStorage.setItem("lens_token", result.token);
      localStorage.setItem("lens_user", JSON.stringify(result.user));
      onLogin(result.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg, #0a0a1a 0%, #0f0a1e 50%, #0a1020 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "'DM Sans', system-ui, sans-serif"
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", fontSize: 32, boxShadow: "0 0 40px #7c3aed40"
          }}>🔬</div>
          <h1 style={{ color: "#f8fafc", fontSize: 28, fontWeight: 800, margin: 0 }}>Lens Nutrition</h1>
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 6 }}>AI-powered food intelligence</p>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 24, padding: 32, backdropFilter: "blur(20px)"
        }}>
          {/* Toggle */}
          <div style={{
            display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 12,
            padding: 4, marginBottom: 28
          }}>
            {["Login", "Register"].map((t) => (
              <button key={t} onClick={() => { setIsLogin(t === "Login"); setError(""); }}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 9, border: "none",
                  fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.2s",
                  background: (t === "Login") === isLogin ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "transparent",
                  color: (t === "Login") === isLogin ? "white" : "#64748b",
                }}>
                {t}
              </button>
            ))}
          </div>

          {/* Fields */}
          {!isLogin && (
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full Name" style={inputStyle} />
          )}
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email address" type="email" style={inputStyle} />
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Password" type="password" style={{ ...inputStyle, marginBottom: 0 }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />

          {error && (
            <div style={{
              marginTop: 16, padding: "12px 16px", borderRadius: 10,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              color: "#f87171", fontSize: 13
            }}>{error}</div>
          )}

          <button onClick={handleSubmit} disabled={loading}
            style={{
              width: "100%", padding: 14, borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "white",
              fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
              marginTop: 20, opacity: loading ? 0.7 : 1, transition: "all 0.2s",
              boxShadow: "0 4px 20px rgba(124,58,237,0.35)"
            }}>
            {loading ? <LoadingSpinner size={20} color="white" /> : isLogin ? "Sign In" : "Create Account"}
          </button>
        </div>

        <p style={{ textAlign: "center", color: "#334155", fontSize: 12, marginTop: 20 }}>
          Demo mode: works with Gemini API key in .env
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "13px 16px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)", color: "#f8fafc", fontSize: 14,
  marginBottom: 14, outline: "none", boxSizing: "border-box",
  fontFamily: "'DM Sans', system-ui, sans-serif",
};

function ScanPage({ onResult }) {
  const [mode, setMode] = useState("upload"); // upload | camera
  const [preview, setPreview] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [mealType, setMealType] = useState("unknown");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 1280, height: 720 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setMode("camera");
    } catch (e) {
      setError("Camera access denied. Please use file upload instead.");
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setMode("upload");
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreview(dataUrl);
    setImageData(dataUrl.split(",")[1]);
    setMimeType("image/jpeg");
    stopCamera();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Image too large. Max 10MB."); return; }
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target.result);
      setImageData(ev.target.result.split(",")[1]);
    };
    reader.readAsDataURL(file);
    setError("");
  };

  const analyze = async () => {
    if (!imageData) { setError("Please select or capture a food image first."); return; }
    setError(""); setAnalyzing(true);
    try {
      let result;
      // Try backend first, fall back to direct Gemini
      try {
        result = await api.post("/food/analyze", {
          imageData: preview, mimeType, mealType
        });
        onResult({ ...result.data, healthInsights: result.data.healthInsights || [] });
      } catch {
        // Frontend-only mode using direct Gemini
        if (!GEMINI_KEY) throw new Error("No API connection. Please configure VITE_GEMINI_API_KEY.");
        const geminiData = await analyzeWithGemini(imageData, mimeType);
        onResult({ ...geminiData, _id: Date.now().toString(), scannedAt: new Date(), imageData: preview });
      }
    } catch (e) {
      setError(e.message || "Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div style={{ padding: "0 0 24px" }}>
      <h2 style={{ color: "#f8fafc", fontWeight: 800, fontSize: 22, margin: "0 0 6px" }}>Scan Food</h2>
      <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px" }}>
        Upload or capture a photo to analyze nutrition
      </p>

      {/* Mode Toggle */}
      {mode !== "camera" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {[
            { id: "upload", icon: "📁", label: "Upload Photo" },
            { id: "camera", icon: "📷", label: "Use Camera" },
          ].map(({ id, icon, label }) => (
            <button key={id}
              onClick={() => id === "camera" ? startCamera() : setMode("upload")}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid",
                borderColor: mode === id ? "#7c3aed" : "rgba(255,255,255,0.08)",
                background: mode === id ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
                color: mode === id ? "#a78bfa" : "#64748b", cursor: "pointer",
                fontWeight: 600, fontSize: 13, transition: "all 0.2s"
              }}>
              {icon} {label}
            </button>
          ))}
        </div>
      )}

      {/* Camera View */}
      {mode === "camera" && (
        <div style={{ borderRadius: 16, overflow: "hidden", position: "relative", marginBottom: 16 }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: "100%", display: "block", maxHeight: 340, objectFit: "cover" }} />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 12 }}>
            <button onClick={stopCamera}
              style={{ padding: "10px 20px", borderRadius: 99, background: "rgba(0,0,0,0.7)", color: "white", border: "none", cursor: "pointer", fontSize: 13 }}>
              ✕ Cancel
            </button>
            <button onClick={capturePhoto}
              style={{ padding: "10px 24px", borderRadius: 99, background: "#7c3aed", color: "white", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
              📸 Capture
            </button>
          </div>
        </div>
      )}

      {/* Upload Area */}
      {mode === "upload" && !preview && (
        <label style={{
          display: "block", border: "2px dashed rgba(124,58,237,0.4)", borderRadius: 16,
          padding: "40px 20px", textAlign: "center", cursor: "pointer",
          background: "rgba(124,58,237,0.04)", transition: "all 0.2s", marginBottom: 16
        }}>
          <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
          <div style={{ color: "#a78bfa", fontWeight: 600, marginBottom: 6 }}>Tap to select food photo</div>
          <div style={{ color: "#475569", fontSize: 12 }}>JPEG, PNG, WebP • Max 10MB</div>
        </label>
      )}

      {/* Preview */}
      {preview && (
        <div style={{ position: "relative", marginBottom: 16 }}>
          <img src={preview} alt="food"
            style={{ width: "100%", borderRadius: 16, maxHeight: 300, objectFit: "cover", display: "block" }} />
          <button onClick={() => { setPreview(null); setImageData(null); setError(""); }}
            style={{
              position: "absolute", top: 10, right: 10, width: 32, height: 32,
              borderRadius: "50%", background: "rgba(0,0,0,0.7)", color: "white",
              border: "none", cursor: "pointer", fontSize: 16, display: "flex",
              alignItems: "center", justifyContent: "center"
            }}>✕</button>
        </div>
      )}

      {/* Meal Type */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Meal Type
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["breakfast", "lunch", "dinner", "snack", "unknown"].map((t) => (
            <button key={t} onClick={() => setMealType(t)}
              style={{
                padding: "7px 14px", borderRadius: 99, border: "1px solid",
                borderColor: mealType === t ? "#7c3aed" : "rgba(255,255,255,0.1)",
                background: mealType === t ? "rgba(124,58,237,0.2)" : "transparent",
                color: mealType === t ? "#a78bfa" : "#64748b", cursor: "pointer",
                fontSize: 12, fontWeight: 600, textTransform: "capitalize"
              }}>{t}</button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 16,
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 13
        }}>{error}</div>
      )}

      <button onClick={analyze} disabled={!preview || analyzing}
        style={{
          width: "100%", padding: 16, borderRadius: 14, border: "none",
          background: preview && !analyzing ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "rgba(255,255,255,0.05)",
          color: preview && !analyzing ? "white" : "#475569",
          fontWeight: 700, fontSize: 16, cursor: preview && !analyzing ? "pointer" : "not-allowed",
          boxShadow: preview && !analyzing ? "0 4px 24px rgba(124,58,237,0.4)" : "none",
          transition: "all 0.3s", display: "flex", alignItems: "center", justifyContent: "center", gap: 10
        }}>
        {analyzing ? (
          <><LoadingSpinner size={20} color="white" /> <span>Analyzing nutrition...</span></>
        ) : (
          <><span>🔬</span><span>Analyze Nutrition</span></>
        )}
      </button>
    </div>
  );
}

function ResultPage({ result, onBack, onSave }) {
  const { foodName, foodDescription, nutrition: n, healthScore, tags, confidence, healthInsights = [], aiSource, imageData } = result;

  if (!n) return <div style={{ color: "#64748b", textAlign: "center", padding: 40 }}>No nutrition data</div>;

  const tagList = [];
  if (tags?.isHighProtein) tagList.push({ label: "High Protein", color: "#34d399", bg: "rgba(52,211,153,0.1)", icon: "💪" });
  if (tags?.isLowCarb) tagList.push({ label: "Low Carb", color: "#60a5fa", bg: "rgba(96,165,250,0.1)", icon: "📉" });
  if (tags?.isHighFat) tagList.push({ label: "High Fat", color: "#fbbf24", bg: "rgba(251,191,36,0.1)", icon: "🧈" });
  if (tags?.isJunkFood) tagList.push({ label: "Junk Food ⚠️", color: "#f87171", bg: "rgba(248,113,113,0.1)", icon: "🚫" });
  if (tags?.isVegan) tagList.push({ label: "Vegan", color: "#86efac", bg: "rgba(134,239,172,0.1)", icon: "🌿" });
  if (tags?.isGlutenFree) tagList.push({ label: "Gluten Free", color: "#c4b5fd", bg: "rgba(196,181,253,0.1)", icon: "🌾" });

  const vitamins = n.vitamins || {};
  const minerals = n.minerals || {};

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Header */}
      <button onClick={onBack} style={{
        display: "flex", alignItems: "center", gap: 6, color: "#94a3b8",
        background: "none", border: "none", cursor: "pointer", fontSize: 14,
        fontWeight: 500, padding: "0 0 16px", fontFamily: "inherit"
      }}>← Back to scan</button>

      {/* Food Image + Name */}
      <div style={{
        background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.1))",
        border: "1px solid rgba(124,58,237,0.2)", borderRadius: 20, overflow: "hidden", marginBottom: 20
      }}>
        {imageData && (
          <img src={imageData.startsWith("data:") ? imageData : `data:image/jpeg;base64,${imageData}`}
            alt={foodName} style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
        )}
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ color: "#f8fafc", fontWeight: 800, fontSize: 22, margin: "0 0 6px" }}>{foodName}</h2>
              {foodDescription && <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>{foodDescription}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#64748b", background: "rgba(255,255,255,0.05)", padding: "3px 8px", borderRadius: 99 }}>
                  🎯 {confidence}% confidence
                </span>
                <span style={{ fontSize: 11, color: "#64748b", background: "rgba(255,255,255,0.05)", padding: "3px 8px", borderRadius: 99 }}>
                  🤖 {aiSource === "usda" ? "USDA Verified" : "AI Estimated"}
                </span>
              </div>
            </div>
            <CircularScore score={healthScore || 0} />
          </div>
        </div>
      </div>

      {/* Tags */}
      {tagList.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {tagList.map((t) => <HealthTag key={t.label} {...t} />)}
        </div>
      )}

      {/* Health Insights */}
      {healthInsights.length > 0 && (
        <div style={{
          background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)",
          borderRadius: 16, padding: 16, marginBottom: 20
        }}>
          <div style={{ color: "#86efac", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>💡 Health Insights</div>
          {healthInsights.map((ins, i) => (
            <div key={i} style={{ color: "#94a3b8", fontSize: 13, padding: "4px 0", display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>•</span> {ins}
            </div>
          ))}
        </div>
      )}

      {/* Macros Grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20
      }}>
        {[
          { label: "Calories", value: n.calories, unit: "kcal", color: "#f97316", dv: n.dailyValues?.calories },
          { label: "Protein", value: n.protein, unit: "g", color: "#22c55e", dv: n.dailyValues?.protein },
          { label: "Carbs", value: n.carbohydrates, unit: "g", color: "#3b82f6", dv: n.dailyValues?.carbohydrates },
          { label: "Fat", value: n.fat, unit: "g", color: "#f59e0b", dv: n.dailyValues?.fat },
        ].map(({ label, value, unit, color, dv }) => (
          <div key={label} style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16, padding: "16px 18px"
          }}>
            <div style={{ color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
            <div style={{ color, fontSize: 26, fontWeight: 800, margin: "6px 0 2px" }}>{value}</div>
            <div style={{ color: "#475569", fontSize: 11 }}>{unit} {dv != null ? `· ${dv}% DV` : ""}</div>
          </div>
        ))}
      </div>

      {/* Detailed Nutrients */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20, padding: 20, marginBottom: 20
      }}>
        <h3 style={{ color: "#f8fafc", fontWeight: 700, fontSize: 15, margin: "0 0 20px" }}>📊 Nutrient Breakdown</h3>
        <NutrientBar label="Fiber" value={n.fiber || 0} max={30} unit="g" color="#a78bfa" dailyValue={n.dailyValues?.fiber} />
        <NutrientBar label="Sugar" value={n.sugar || 0} max={50} unit="g" color="#f472b6" dailyValue={null} />
        <NutrientBar label="Sodium" value={n.sodium || 0} max={2300} unit="mg" color="#fb923c" dailyValue={n.dailyValues?.sodium} />
        <NutrientBar label="Cholesterol" value={n.cholesterol || 0} max={300} unit="mg" color="#94a3b8" dailyValue={null} />
      </div>

      {/* Vitamins */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20, padding: 20, marginBottom: 20
      }}>
        <h3 style={{ color: "#f8fafc", fontWeight: 700, fontSize: 15, margin: "0 0 20px" }}>🍊 Vitamins</h3>
        {[
          ["Vitamin A", vitamins.vitaminA, 900],
          ["Vitamin C", vitamins.vitaminC, 90],
          ["Vitamin D", vitamins.vitaminD, 20],
          ["Vitamin E", vitamins.vitaminE, 15],
          ["Vitamin B12", vitamins.vitaminB12, 2.4],
          ["Folate", vitamins.folate, 400],
        ].map(([label, v, maxVal]) => v?.amount != null && (
          <NutrientBar key={label} label={label} value={v.amount} max={maxVal}
            unit={v.unit || "mcg"} color="#818cf8" dailyValue={v.dailyValue} />
        ))}
      </div>

      {/* Minerals */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20, padding: 20, marginBottom: 24
      }}>
        <h3 style={{ color: "#f8fafc", fontWeight: 700, fontSize: 15, margin: "0 0 20px" }}>⚡ Minerals</h3>
        {[
          ["Calcium", minerals.calcium, 1300],
          ["Iron", minerals.iron, 18],
          ["Magnesium", minerals.magnesium, 420],
          ["Potassium", minerals.potassium, 4700],
          ["Zinc", minerals.zinc, 11],
        ].map(([label, v, maxVal]) => v?.amount != null && (
          <NutrientBar key={label} label={label} value={v.amount} max={maxVal}
            unit={v.unit || "mg"} color="#34d399" dailyValue={v.dailyValue} />
        ))}
      </div>

      <button onClick={onSave}
        style={{
          width: "100%", padding: 16, borderRadius: 14, border: "none",
          background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "white",
          fontWeight: 700, fontSize: 15, cursor: "pointer",
          boxShadow: "0 4px 24px rgba(124,58,237,0.4)"
        }}>
        ✅ Save to History
      </button>
    </div>
  );
}

function DashboardPage({ user }) {
  const [summary, setSummary] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState("calories");
  const goals = user?.goals || { dailyCalories: 2000, dailyProtein: 50, dailyCarbs: 250, dailyFat: 65 };

  useEffect(() => {
    const load = async () => {
      try {
        const [summaryRes, weeklyRes] = await Promise.all([
          api.get("/food/daily-summary"),
          api.get("/food/weekly-stats"),
        ]);
        setSummary(summaryRes.data);
        setWeekly(weeklyRes.data);
      } catch { /* backend not connected */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
      <LoadingSpinner size={40} />
    </div>
  );

  const totals = summary?.totals || {};
  const caloriesPct = goals.dailyCalories ? Math.round(((totals.calories || 0) / goals.dailyCalories) * 100) : 0;

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const metricColors = { calories: "#f97316", protein: "#22c55e", carbohydrates: "#3b82f6", fat: "#f59e0b" };
  const maxVal = weekly.length ? Math.max(...weekly.map((d) => d[activeMetric] || 0), 1) : 1;

  return (
    <div style={{ paddingBottom: 32 }}>
      <h2 style={{ color: "#f8fafc", fontWeight: 800, fontSize: 22, margin: "0 0 6px" }}>
        Hi, {user?.name?.split(" ")[0] || "there"} 👋
      </h2>
      <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px" }}>
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </p>

      {/* Calories Ring */}
      <div style={{
        background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.08))",
        border: "1px solid rgba(124,58,237,0.2)", borderRadius: 20, padding: 24, marginBottom: 20,
        display: "flex", alignItems: "center", gap: 24
      }}>
        <div style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}>
          <svg width="100" height="100" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="#f97316" strokeWidth="8"
              strokeDasharray={`${Math.min(caloriesPct / 100, 1) * 2 * Math.PI * 38} ${2 * Math.PI * 38}`}
              strokeLinecap="round" style={{ transition: "stroke-dasharray 1.2s ease" }} />
          </svg>
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center"
          }}>
            <span style={{ color: "#f8fafc", fontSize: 18, fontWeight: 800 }}>{caloriesPct}%</span>
          </div>
        </div>
        <div>
          <div style={{ color: "#64748b", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Today's Calories</div>
          <div style={{ color: "#f8fafc", fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>
            {Math.round(totals.calories || 0)}
          </div>
          <div style={{ color: "#64748b", fontSize: 13 }}>of {goals.dailyCalories} goal</div>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
            {summary?.totalMeals || 0} meal{summary?.totalMeals !== 1 ? "s" : ""} logged
          </div>
        </div>
      </div>

      {/* Macro Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Protein", value: totals.protein, goal: goals.dailyProtein, color: "#22c55e", unit: "g" },
          { label: "Carbs", value: totals.carbohydrates, goal: goals.dailyCarbs, color: "#3b82f6", unit: "g" },
          { label: "Fat", value: totals.fat, goal: goals.dailyFat, color: "#f59e0b", unit: "g" },
        ].map(({ label, value, goal, color, unit }) => {
          const pct = goal ? Math.min(Math.round(((value || 0) / goal) * 100), 100) : 0;
          return (
            <div key={label} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "14px 12px"
            }}>
              <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
              <div style={{ color, fontSize: 18, fontWeight: 800 }}>{Math.round(value || 0)}<span style={{ fontSize: 10, color: "#475569" }}>{unit}</span></div>
              <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 99, height: 4, marginTop: 8 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 1s ease" }} />
              </div>
              <div style={{ color: "#475569", fontSize: 10, marginTop: 4 }}>{pct}% of {goal}{unit}</div>
            </div>
          );
        })}
      </div>

      {/* Weekly Chart */}
      {weekly.length > 0 && (
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 20, padding: 20
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ color: "#f8fafc", fontWeight: 700, fontSize: 15, margin: 0 }}>📈 Weekly Trends</h3>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(metricColors).map(([m, c]) => (
                <button key={m} onClick={() => setActiveMetric(m)}
                  style={{
                    padding: "4px 8px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 10,
                    fontWeight: 600, textTransform: "capitalize",
                    background: activeMetric === m ? c + "30" : "transparent",
                    color: activeMetric === m ? c : "#475569"
                  }}>{m}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
            {weekly.map((d, i) => {
              const val = d[activeMetric] || 0;
              const h = maxVal > 0 ? Math.max((val / maxVal) * 72, val > 0 ? 4 : 0) : 0;
              const dateKey = d.date;
              const dayIdx = new Date(dateKey + "T12:00:00").getDay();
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 9, color: "#475569" }}>{val > 0 ? Math.round(val) : ""}</div>
                  <div style={{
                    width: "100%", height: h, borderRadius: "4px 4px 2px 2px",
                    background: val > 0 ? metricColors[activeMetric] : "rgba(255,255,255,0.05)",
                    transition: "height 0.8s ease", minHeight: 4
                  }} />
                  <div style={{ fontSize: 10, color: "#475569" }}>{days[dayIdx]}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!summary && (
        <div style={{
          background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)",
          borderRadius: 16, padding: 20, textAlign: "center", marginTop: 20
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔬</div>
          <div style={{ color: "#a78bfa", fontWeight: 600, marginBottom: 4 }}>No data yet</div>
          <div style={{ color: "#475569", fontSize: 13 }}>Scan your first meal to start tracking!</div>
        </div>
      )}
    </div>
  );
}

function HistoryPage({ onView }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (p = 1) => {
    try {
      const res = await api.get(`/food/history?page=${p}&limit=15`);
      if (p === 1) setScans(res.data);
      else setScans((prev) => [...prev, ...res.data]);
      setHasMore(p < res.pagination.pages);
      setPage(p);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/food/${id}`);
      setScans((prev) => prev.filter((s) => s._id !== id));
    } catch (e) { alert(e.message); }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
      <LoadingSpinner size={40} />
    </div>
  );

  return (
    <div style={{ paddingBottom: 32 }}>
      <h2 style={{ color: "#f8fafc", fontWeight: 800, fontSize: 22, margin: "0 0 6px" }}>History</h2>
      <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px" }}>Your scanned meals</p>

      {scans.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ color: "#475569", fontSize: 15 }}>No scans yet. Start scanning food!</div>
        </div>
      ) : (
        scans.map((scan) => (
          <div key={scan._id} onClick={() => onView(scan)}
            style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: 16, marginBottom: 12, cursor: "pointer",
              display: "flex", gap: 14, alignItems: "center", transition: "all 0.2s"
            }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12, overflow: "hidden", flexShrink: 0,
              background: "rgba(124,58,237,0.15)", display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {scan.imageData ? (
                <img src={scan.imageData.startsWith("data:") ? scan.imageData : `data:image/jpeg;base64,${scan.imageData}`}
                  alt={scan.foodName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : <span style={{ fontSize: 24 }}>🍽️</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: 15, marginBottom: 2 }}
                className="truncate">{scan.foodName}</div>
              <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>{formatDate(scan.scannedAt)}</div>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ color: "#f97316", fontSize: 12, fontWeight: 600 }}>{Math.round(scan.nutrition?.calories || 0)} kcal</span>
                <span style={{ color: "#22c55e", fontSize: 12 }}>{Math.round(scan.nutrition?.protein || 0)}g protein</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${getHealthColor(scan.healthScore || 0)}20`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: getHealthColor(scan.healthScore || 0), fontWeight: 800, fontSize: 14
              }}>{scan.healthScore || 0}</div>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(scan._id); }}
                style={{
                  background: "rgba(239,68,68,0.1)", border: "none", color: "#f87171",
                  width: 28, height: 28, borderRadius: 8, cursor: "pointer", fontSize: 12
                }}>✕</button>
            </div>
          </div>
        ))
      )}

      {hasMore && (
        <button onClick={() => load(page + 1)}
          style={{
            width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent", color: "#a78bfa", cursor: "pointer", fontWeight: 600, fontSize: 14
          }}>Load More</button>
      )}
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lens_user") || "null"); } catch { return null; }
  });
  const [tab, setTab] = useState("scan");
  const [result, setResult] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState([]);

  const handleLogin = (u) => setUser(u);
  const handleLogout = () => {
    localStorage.removeItem("lens_token");
    localStorage.removeItem("lens_user");
    setUser(null);
  };

  const handleResult = (data) => {
    setResult(data);
    setSaved(false);
  };

  const handleSave = () => {
    if (result && !saved) {
      setHistory((prev) => [result, ...prev]);
      setSaved(true);
      setTimeout(() => { setResult(null); setTab("history"); }, 800);
    }
  };

  if (!user) return <AuthPage onLogin={handleLogin} />;

  const tabs = [
    { id: "dashboard", icon: "📊", label: "Today" },
    { id: "scan", icon: "🔬", label: "Scan" },
    { id: "history", icon: "📋", label: "History" },
  ];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; background: #090912; }
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.3); border-radius: 99px; }
      `}</style>

      <div style={{
        maxWidth: 480, margin: "0 auto", minHeight: "100vh",
        background: "linear-gradient(180deg, #0a0a1a 0%, #090912 100%)",
        fontFamily: "'DM Sans', system-ui, sans-serif", position: "relative"
      }}>
        {/* Top Bar */}
        <div style={{
          padding: "16px 20px 12px", display: "flex", alignItems: "center",
          justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)",
          position: "sticky", top: 0, background: "rgba(9,9,18,0.9)",
          backdropFilter: "blur(20px)", zIndex: 10
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16
            }}>🔬</div>
            <span style={{ color: "#f8fafc", fontWeight: 800, fontSize: 16 }}>Lens Nutrition</span>
          </div>
          <button onClick={handleLogout}
            style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#64748b", padding: "6px 12px", borderRadius: 8, cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "inherit"
            }}>Logout</button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 20px 90px", animation: "fadeIn 0.3s ease" }}>
          {result && !saved ? (
            <ResultPage result={result} onBack={() => setResult(null)} onSave={handleSave} />
          ) : viewItem ? (
            <ResultPage result={viewItem} onBack={() => setViewItem(null)} onSave={() => setViewItem(null)} />
          ) : tab === "dashboard" ? (
            <DashboardPage user={user} />
          ) : tab === "scan" ? (
            <ScanPage onResult={handleResult} />
          ) : (
            <HistoryPage onView={setViewItem} localHistory={history} />
          )}
        </div>

        {/* Bottom Nav */}
        {!result && !viewItem && (
          <div style={{
            position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
            width: "100%", maxWidth: 480,
            background: "rgba(9,9,18,0.95)", backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex", padding: "8px 0 max(8px, env(safe-area-inset-bottom))", zIndex: 100
          }}>
            {tabs.map(({ id, icon, label }) => (
              <button key={id} onClick={() => setTab(id)}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 3, padding: "6px 0", background: "none", border: "none", cursor: "pointer",
                  transition: "all 0.2s", fontFamily: "inherit"
                }}>
                <div style={{
                  fontSize: id === "scan" && tab === id ? 26 : 22,
                  filter: tab === id ? "none" : "grayscale(80%) opacity(0.5)",
                  transition: "all 0.2s"
                }}>{icon}</div>
                <span style={{
                  fontSize: 10, fontWeight: tab === id ? 700 : 500,
                  color: tab === id ? "#a78bfa" : "#475569",
                  transition: "all 0.2s"
                }}>{label}</span>
                {tab === id && (
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#7c3aed" }} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
