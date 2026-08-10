"use client";

import { useEffect, useState, useRef } from "react";

export function useS3Socket(clientId: string, siteId?: string, uploadKey?: string) {
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("Idle");
    const [completed, setCompleted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!clientId) return;
        if (wsRef.current) return; // prevent creating multiple WS

        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const host = window.location.hostname;
        const port = 5001;
        const ws = new WebSocket(`${protocol}://${host}:${port}/complete-upload?clientId=${clientId}`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected", clientId);
            if (siteId && uploadKey && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ siteId, uploadKey }));
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.progress !== undefined) setProgress(data.progress);
                if (data.status) setStatus(data.status);

                if (data.status === "completed") {
                    setCompleted(true);
                    setProgress(100);
                }
                if (data.status === "error") {
                    setError(data.message || "An error occurred");
                    setCompleted(true);
                }
            } catch (err) {
                console.error("WebSocket parse error:", err);
            }
        };

        ws.onerror = (err) => {
            console.error("WebSocket error:", err);
            setError("WebSocket connection failed");
            setCompleted(true);
        };

        ws.onclose = (e) => console.log("WebSocket closed", e.code, e.reason);

        return () => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.close();
            }
        };
    }, [clientId, siteId, uploadKey]);

    const sendMessage = (msg: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    };

    return { progress, status, completed, error, sendMessage };
}
