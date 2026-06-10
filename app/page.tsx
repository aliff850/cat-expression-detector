"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

type Emotion = "neutral" | "happy" | "sad" | "angry" | "fearful" | "disgusted" | "surprised";

export default function ExpressionMatcher() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>("neutral");
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

  // Initialize webcam stream once models are ready
  useEffect(() => {
    if (!isModelLoaded) return;

    let stream: MediaStream | null = null;

    const startVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError("Webcam access denied or unavailable.");
        console.error(err);
      }
    };

    startVideo();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isModelLoaded]);

  // Handle continuous real-time frame inference
  useEffect(() => {
    if (!isModelLoaded || !videoRef.current) return;

    let animationFrameId: number;

    const detectExpression = async () => {
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        if (detection && detection.expressions) {
          // Sort expressions by confidence array values to find the dominant emotion
          const expressionsArray = Object.entries(detection.expressions);
          const dominant = expressionsArray.reduce((max, current) =>
            current[1] > max[1] ? current : max
          );

          // Adjust sensitivity: require at least 50% confidence to change emotion, 
          // otherwise it will remain neutral or keep the last strong emotion.
          if (dominant[1] > 0.5) {
            setCurrentEmotion(dominant[0] as Emotion);
          }
        }
      }
      animationFrameId = requestAnimationFrame(detectExpression);
    };

    // Begin loop when video metadata loads completely
    const handlePlay = () => {
      animationFrameId = requestAnimationFrame(detectExpression);
    };

    const videoEl = videoRef.current;
    videoEl.addEventListener("play", handlePlay);

    return () => {
      videoEl.removeEventListener("play", handlePlay);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isModelLoaded]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-red-400">
        <p className="text-xl font-semibold">{error}</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-6 text-white">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Real-Time Cat Expression Matcher</h1>

      {!isModelLoaded ? (
        <div className="text-xl text-gray-400 animate-pulse">Loading neural network models...</div>
      ) : (
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-stretch">
          {/* Webcam Preview Panel */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-gray-900 p-6 shadow-2xl border border-gray-800">
            <div className="relative flex h-[480px] w-[640px] items-center justify-center overflow-hidden rounded-xl bg-gray-950 border border-gray-800">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover scale-x-[-1]"
              />
              <div className="absolute bottom-4 left-4 rounded-lg bg-black/60 px-4 py-2 text-sm backdrop-blur-md">
                Live Feed
              </div>
            </div>
            <div className="mt-6 text-center">
              <span className="text-xs uppercase tracking-widest text-gray-400">Camera Status</span>
              <p className="text-2xl font-extrabold capitalize text-emerald-400">Active</p>
            </div>
          </div>

          {/* Cat Representation Panel */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-gray-900 p-6 shadow-2xl border border-gray-800">
            <div className="relative flex h-[480px] w-[480px] items-center justify-center overflow-hidden rounded-xl bg-gray-950 border border-gray-800">
              {/* Fallback layout if specific asset loading fails */}
              <img
                src={`/cats/${currentEmotion === 'disgusted' ? 'disgust' : currentEmotion}.jpg`}
                alt={`Cat displaying a ${currentEmotion} expression`}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=500";
                }}
              />
            </div>
            <div className="mt-6 text-center">
              <span className="text-xs uppercase tracking-widest text-gray-400">Detected Emotion</span>
              <p className="text-2xl font-extrabold capitalize text-emerald-400">{currentEmotion}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}