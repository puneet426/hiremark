"use client";
// Local proctoring. The camera feed is analysed in this browser tab only;
// no frame is uploaded. Only an event name ("face_missing") reaches the server.
import { useEffect, useRef, useState } from "react";

type Detector = { detectForVideo: (v: HTMLVideoElement, t: number) => { detections: unknown[] }; close: () => void };

export function useProctor(active: boolean, report: (kind: string, detail?: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"wait" | "on" | "off">("wait");
  const [faces, setFaces] = useState<number | null>(null);
  const [faceCheck, setFaceCheck] = useState<"loading" | "on" | "unavailable">("loading");
  const reportRef = useRef(report);
  reportRef.current = report;

  // Camera stream + face detection
  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null, detector: Detector | null = null, timer: ReturnType<typeof setInterval> | null = null, dead = false;
    let missingSince = 0, manySince = 0, missingFlagged = false, manyFlagged = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
      } catch {
        setCamera("off");
        reportRef.current("camera_off", "Camera permission missing");
        return;
      }
      if (dead) return stream.getTracks().forEach((t) => t.stop());
      setCamera("on");
      stream.getVideoTracks()[0].addEventListener("ended", () => { setCamera("off"); reportRef.current("camera_off", "Camera stopped"); });
      const v = videoRef.current;
      if (v) { v.srcObject = stream; await v.play().catch(() => {}); }
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const files = await vision.FilesetResolver.forVisionTasks("/mediapipe");
        detector = (await vision.FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: "/models/face.tflite" }, runningMode: "VIDEO", minDetectionConfidence: 0.5 })) as unknown as Detector;
      } catch {
        setFaceCheck("unavailable");
        return;
      }
      if (dead) return detector.close();
      setFaceCheck("on");
      timer = setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || !detector) return;
        let n = 0;
        try { n = detector.detectForVideo(video, performance.now()).detections.length; } catch { return; }
        setFaces(n);
        const t = Date.now();
        if (n === 0) {
          missingSince ||= t;
          if (!missingFlagged && t - missingSince > 6000) { missingFlagged = true; reportRef.current("face_missing", "No face for 6 seconds"); }
        } else { missingSince = 0; missingFlagged = false; }
        if (n > 1) {
          manySince ||= t;
          if (!manyFlagged && t - manySince > 3000) { manyFlagged = true; reportRef.current("multiple_faces", `${n} faces`); }
        } else { manySince = 0; manyFlagged = false; }
      }, 1000);
    })();

    return () => { dead = true; if (timer) clearInterval(timer); detector?.close(); stream?.getTracks().forEach((t) => t.stop()); };
  }, [active]);

  // Tab, focus and full-screen
  const [fullscreen, setFullscreen] = useState(true);
  useEffect(() => {
    if (!active) return;
    setFullscreen(!!document.fullscreenElement);
    const onVis = () => { if (document.hidden) reportRef.current("tab_hidden"); };
    const onBlur = () => reportRef.current("window_blur");
    const onFs = () => {
      const fs = !!document.fullscreenElement;
      setFullscreen(fs);
      if (!fs) reportRef.current("fullscreen_exit");
    };
    const noMenu = (e: Event) => e.preventDefault();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("contextmenu", noMenu);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("contextmenu", noMenu);
    };
  }, [active]);

  return { videoRef, camera, faces, faceCheck, fullscreen };
}
