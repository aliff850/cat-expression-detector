"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

type Emotion = "neutral" | "happy" | "sad" | "angry" | "fearful" | "disgusted" | "surprised";

const TARGET_EMOTIONS: Emotion[] = ["happy", "sad", "angry", "fearful", "disgusted", "surprised"];
const GAME_DURATION = 60; // 60 seconds

export default function ExpressionMatcher() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [currentEmotion, setCurrentEmotion] = useState<Emotion>("neutral");
    const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Game states
    const [gameState, setGameState] = useState<"menu" | "playing" | "victory" | "gameover">("menu");
    const [timeLeft, setTimeLeft] = useState<number>(GAME_DURATION);
    const [capturedEmotions, setCapturedEmotions] = useState<Set<Emotion>>(new Set());

    // Load face-api.js models on component mount
    useEffect(() => {
        const loadModels = async () => {
            try {
                const MODEL_URL = "/models";
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
                ]);
                setIsModelLoaded(true);
            } catch (err) {
                setError("Failed to load facial recognition models.");
                console.error(err);
            }
        };
        loadModels();
    }, []);

    // Store active media stream in state
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

    // Initialize webcam stream once models are ready
    useEffect(() => {
        if (!isModelLoaded) return;

        let activeStream: MediaStream | null = null;

        const startVideo = async () => {
            try {
                activeStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: "user" },
                });
                setMediaStream(activeStream);
            } catch (err) {
                setError("Webcam access denied or unavailable.");
                console.error(err);
            }
        };

        startVideo();

        return () => {
            if (activeStream) {
                activeStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [isModelLoaded]);

    // Attach stream to video element whenever video element or stream updates
    useEffect(() => {
        if (videoRef.current && mediaStream) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.play().catch(() => { });
        }
    }, [mediaStream, gameState]);


    // Handle continuous real-time frame inference
    useEffect(() => {
        if (!isModelLoaded || gameState !== "playing") return;

        let animationFrameId: number;
        let isSubscribed = true;

        const detectExpression = async () => {
            if (!isSubscribed) return;

            if (videoRef.current && videoRef.current.readyState >= 2 && !videoRef.current.paused && !videoRef.current.ended) {
                try {
                    const detection = await faceapi
                        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                        .withFaceExpressions();

                    if (detection && detection.expressions) {
                        const expressionsArray = Object.entries(detection.expressions);
                        const dominant = expressionsArray.reduce((max, current) =>
                            current[1] > max[1] ? current : max
                        );

                        if (dominant[1] > 0.35) {
                            const detected = dominant[0] as Emotion;
                            setCurrentEmotion(detected);

                            if (TARGET_EMOTIONS.includes(detected)) {
                                setCapturedEmotions((prev) => {
                                    if (!prev.has(detected)) {
                                        const updated = new Set(prev);
                                        updated.add(detected);
                                        if (updated.size === TARGET_EMOTIONS.length) {
                                            setGameState("victory");
                                        }
                                        return updated;
                                    }
                                    return prev;
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.error("Expression detection error:", err);
                }
            }

            if (isSubscribed) {
                animationFrameId = requestAnimationFrame(detectExpression);
            }
        };

        animationFrameId = requestAnimationFrame(detectExpression);

        return () => {
            isSubscribed = false;
            cancelAnimationFrame(animationFrameId);
        };
    }, [isModelLoaded, gameState]);


    // Timer countdown logic
    useEffect(() => {
        if (gameState !== "playing") return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setGameState((current) => (current === "playing" ? "gameover" : current));
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [gameState]);

    const handleStartGame = () => {
        setCapturedEmotions(new Set());
        setTimeLeft(GAME_DURATION);
        setCurrentEmotion("neutral");
        setGameState("playing");
    };

    const handleExitToMenu = () => {
        setGameState("menu");
        setCapturedEmotions(new Set());
        setTimeLeft(GAME_DURATION);
        setCurrentEmotion("neutral");
    };

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-950 text-red-400">
                <p className="text-xl font-semibold">{error}</p>
            </div>
        );
    }

    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 p-4 sm:p-6 text-white font-sans overflow-hidden">
            {/* Ambient decorative background blobs */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* MAIN MENU VIEW */}
            {gameState === "menu" && (
                <div className="flex flex-col items-center justify-center text-center max-w-lg p-8 sm:p-10 rounded-3xl bg-slate-900/90 border border-purple-500/30 backdrop-blur-2xl shadow-2xl shadow-purple-950/50 space-y-6">
                    <div className="relative w-36 h-36 rounded-3xl overflow-hidden shadow-xl border-4 border-amber-400/80 transform hover:scale-105 transition-transform duration-300">
                        <img
                            src="/cats/happy.jpg"
                            alt="Happy Cat"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=500";
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-amber-300 via-pink-400 to-purple-400 bg-clip-text text-transparent drop-shadow-sm">
                            Cat Expression Challenge 🐱✨
                        </h1>
                        <p className="text-purple-200/80 text-sm sm:text-base font-medium leading-relaxed">
                            Can you match all 6 cat expressions within 60 seconds? Make your face happy, sad, angry, fearful, disgusted, and surprised!
                        </p>
                    </div>

                    <button
                        onClick={handleStartGame}
                        disabled={!isModelLoaded}
                        className={`w-full py-4 rounded-2xl font-black text-lg sm:text-xl transition-all transform active:scale-95 shadow-xl ${isModelLoaded
                                ? "bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 hover:from-amber-300 hover:to-pink-400 text-white shadow-orange-500/30 hover:shadow-orange-500/50"
                                : "bg-slate-800 text-slate-500 cursor-not-allowed"
                            }`}
                    >
                        {!isModelLoaded ? "Loading AI Models... 🐾" : "Play Game! 🎉"}
                    </button>
                </div>
            )}

            {/* IN-GAME VIEW */}
            {gameState !== "menu" && (
                <div className="flex flex-col items-center w-full max-w-5xl space-y-5 z-10">
                    {/* Top Bar: Exit button & Timer */}
                    <div className="flex items-center justify-between w-full bg-slate-900/80 border border-purple-500/30 rounded-2xl px-6 py-3.5 backdrop-blur-xl shadow-lg">
                        <button
                            onClick={handleExitToMenu}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-200 hover:text-white transition-all text-sm font-bold border border-purple-500/20 shadow-sm"
                        >
                            ← Exit to Menu
                        </button>

                        {/* Timer Display */}
                        <div className="flex items-center gap-3">
                            <span className="text-xs uppercase tracking-widest text-purple-300 font-bold">Time Remaining</span>
                            <span
                                className={`text-2xl font-black px-4 py-1 rounded-xl border ${timeLeft <= 10
                                        ? "bg-rose-500/20 text-rose-300 border-rose-500/50 animate-bounce"
                                        : "bg-amber-400/20 text-amber-300 border-amber-400/40"
                                    }`}
                            >
                                ⏱️ {timeLeft}s
                            </span>
                        </div>
                    </div>

                    {/* Main Side-by-Side Webcam & Cat Displays */}
                    <div className="flex flex-col md:flex-row gap-5 w-full items-stretch">
                        {/* Left: Webcam & Live Detection */}
                        <div className="flex-1 flex flex-col items-center justify-between rounded-3xl bg-slate-900/80 p-4 shadow-xl border border-purple-500/30 backdrop-blur-md">
                            <div className="relative w-full h-[320px] sm:h-[360px] flex items-center justify-center overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="h-full w-full object-cover scale-x-[-1]"
                                />
                                <div className="absolute bottom-3 left-3 rounded-xl bg-slate-900/80 px-3 py-1 text-xs font-bold text-amber-300 backdrop-blur-md border border-amber-400/30">
                                    📷 Live Feed
                                </div>
                            </div>
                            <div className="mt-3 text-center">
                                <span className="text-xs uppercase tracking-widest text-purple-300 font-semibold">Your Detected Emotion</span>
                                <p className="text-2xl font-black capitalize text-amber-400 drop-shadow">{currentEmotion}</p>
                            </div>
                        </div>

                        {/* Right: Cat Expression Target */}
                        <div className="flex-1 flex flex-col items-center justify-between rounded-3xl bg-slate-900/80 p-4 shadow-xl border border-purple-500/30 backdrop-blur-md">
                            <div className="relative w-full h-[320px] sm:h-[360px] flex items-center justify-center overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                                <img
                                    src={`/cats/${currentEmotion === 'disgusted' ? 'disgust' : currentEmotion}.jpg`}
                                    alt={`Cat displaying ${currentEmotion}`}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=500";
                                    }}
                                />
                            </div>
                            <div className="mt-3 text-center">
                                <span className="text-xs uppercase tracking-widest text-purple-300 font-semibold">Matching Cat</span>
                                <p className="text-2xl font-black capitalize text-pink-400 drop-shadow">{currentEmotion}</p>
                            </div>
                        </div>
                    </div>

                    {/* HORIZONTAL EMOTIONS CHECKLIST BENEATH WEBCAM AND CAT */}
                    <div className="w-full flex flex-col rounded-3xl bg-slate-900/80 p-5 shadow-xl border border-purple-500/30 backdrop-blur-md space-y-3">
                        <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                            <h2 className="text-base sm:text-lg font-black text-amber-300 flex items-center gap-2">
                                🎯 Required Emotions Checklist
                            </h2>
                            <span className="text-xs sm:text-sm font-extrabold px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30">
                                {capturedEmotions.size} / 6 Collected
                            </span>
                        </div>

                        {/* Horizontal list layout */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
                            {TARGET_EMOTIONS.map((emotion) => {
                                const isCaptured = capturedEmotions.has(emotion);
                                return (
                                    <div
                                        key={emotion}
                                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm font-extrabold transition-all duration-300 shadow-md ${isCaptured
                                                ? "bg-gradient-to-r from-emerald-500/30 to-teal-500/30 border-emerald-400 text-emerald-300 shadow-emerald-950"
                                                : "bg-gradient-to-r from-rose-500/20 to-red-500/20 border-rose-500/40 text-rose-300"
                                            }`}
                                    >
                                        <span className="capitalize">{emotion}</span>
                                        <span className="text-base">{isCaptured ? "🟢" : "🔴"}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* END GAME OVERLAY MODAL (VICTORY OR TIME'S UP) */}
            {(gameState === "victory" || gameState === "gameover") && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="flex flex-col items-center text-center max-w-md w-full p-8 rounded-3xl bg-slate-900 border-2 border-purple-500/40 shadow-2xl space-y-6">
                        {gameState === "victory" ? (
                            <>
                                <div className="text-7xl animate-bounce">🎉</div>
                                <h2 className="text-3xl font-black text-amber-300 tracking-tight">
                                    You got all 6 emotions!
                                </h2>
                                <p className="text-purple-200/90 text-sm font-medium">
                                    Incredible job! You matched every single cat emotion with {timeLeft} seconds remaining on the clock! 🐾🌟
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="text-7xl animate-pulse">⏰</div>
                                <h2 className="text-3xl font-black text-rose-400 tracking-tight">
                                    Time's Up!
                                </h2>
                                <p className="text-purple-200/90 text-sm font-medium">
                                    You collected {capturedEmotions.size} out of 6 emotions. Give it another shot! 🐱
                                </p>
                            </>
                        )}

                        <button
                            onClick={handleExitToMenu}
                            className="w-full py-4 rounded-2xl font-black text-base bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 hover:from-amber-300 hover:to-pink-400 text-white shadow-xl shadow-orange-500/30 transition-all transform active:scale-95"
                        >
                            Return to Home
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}

