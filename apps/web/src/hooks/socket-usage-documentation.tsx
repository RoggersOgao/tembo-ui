// ============================================
// Example 1: Manual Connection Control
// ============================================


import { useState } from "react";

export function ManualConnectionExample() {
    const [uploading, setUploading] = useState(false);

    const { clientId, isConnected, lastProgress, connect, disconnect } = useSocketProgress({
        onProgress: (event) => {
            console.log("Progress:", event.message);
        },
        onComplete: (data) => {
            console.log("Complete!", data);
            setUploading(false);
        },
        onError: (error) => {
            console.error("Error:", error);
            setUploading(false);
        },
        autoConnect: false // Don't connect automatically
    });

    const handleUpload = async () => {
        try {
            setUploading(true);

            // Connect to socket before starting upload
            await connect();

            // Now make your API call with clientId
            await fetch(`/api/upload?clientId=${clientId}`, {
                method: "POST",
                // ... your upload data
            });

            // Socket will receive progress updates automatically

        } catch (error) {
            console.error("Upload failed:", error);
            setUploading(false);
        }
    };

    const handleCancel = () => {
        disconnect();
        setUploading(false);
    };

    return (
        <div>
            <p>Status: {isConnected ? "Connected" : "Disconnected"}</p>
            {lastProgress && <p>{lastProgress.message}</p>}

            <button onClick={handleUpload} disabled={uploading}>
                Start Upload
            </button>

            {uploading && (
                <button onClick={handleCancel}>Cancel</button>
            )}
        </div>
    );
}

// ============================================
// Example 2: Auto-Connect on Mount
// ============================================

export function AutoConnectExample() {
    const { clientId, isConnected, lastProgress } = useSocketProgress({
        autoConnect: true, // Connect automatically on mount
        onProgress: (event) => {
            console.log(event.step, event.message);
        },
        onComplete: () => {
            toast.success("Operation complete!");
        },
        onError: (error) => {
            toast.error(error);
        }
    });

    return (
        <div>
            {isConnected && (
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span>Connected (ID: {clientId})</span>
                </div>
            )}

            {lastProgress && (
                <div className="mt-4">
                    <p className="font-semibold">{lastProgress.step}</p>
                    <p className="text-sm text-gray-600">{lastProgress.message}</p>
                    {lastProgress.percent !== undefined && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${lastProgress.percent}%` }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================
// Example 3: Integration with Store
// ============================================

import { useS3Store } from "@/hooks/zustand/stores/use-S3-store";

export function StoreIntegrationExample() {
    const [uploading, setUploading] = useState(false);

    // Use the hook for connection management only
    const { clientId, isConnected, connect, disconnect } = useSocketProgress({
        autoConnect: false
    });

    // Use the store for actual operations
    const {
        // deleteSite,
        processingState,
        loading
    } = useS3Store();

    const handleDeleteSite = async (siteId: string) => {
        try {
            setUploading(true);

            // Connect socket first
            await connect();

            // Use store method - it will handle progress internally
            // await deleteSite(siteId);

            toast.success("Site deleted!");

        } catch (error) {
            toast.error("Failed to delete site");
        } finally {
            setUploading(false);
            disconnect();
        }
    };

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>

            {processingState.message && (
                <div className="mb-4 p-4 bg-blue-50 rounded">
                    <p className="text-sm font-medium">{processingState.step}</p>
                    <p className="text-xs text-gray-600">{processingState.message}</p>
                </div>
            )}

            <button
                onClick={() => handleDeleteSite("site-123")}
                disabled={loading || uploading}
            >
                {loading ? "Deleting..." : "Delete Site"}
            </button>
        </div>
    );
}

// ============================================
// Example 4: Progress History Tracking
// ============================================


import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import { useSocketProgress, useSocketProgressManual } from "./use-socket-progress";
import { toast } from "sonner";

export function ProgressHistoryExample() {
    const {
        clientId,
        isConnected,
        progress,
        connect,
        disconnect,
        clearProgress
    } = useSocketProgressManual();

    const startOperation = async () => {
        await connect();
        clearProgress(); // Clear previous progress

        // Start your operation with clientId
        await fetch(`/api/operation?clientId=${clientId}`, {
            method: "POST"
        });
    };

    return (
        <div>
            <button onClick={startOperation} disabled={!isConnected}>
                Start Operation
            </button>

            <div className="mt-4">
                <h3>Progress History:</h3>
                <ul className="space-y-2">
                    {progress.map((event, index) => (
                        <li key={index} className="text-sm">
                            <span className="font-semibold">{event.step}:</span> {event.message}
                            {event.percent && <span> ({event.percent}%)</span>}
                        </li>
                    ))}
                </ul>
            </div>

            <button onClick={clearProgress} className="mt-2">
                Clear History
            </button>
        </div>
    );
}

// ============================================
// Example 5: With Upload Dialog (Real-World)
// ============================================

export function UploadDialogExample() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [uploadComplete, setUploadComplete] = useState(false);
    const [currentMessage, setCurrentMessage] = useState("");

    const { clientId, isConnected, lastProgress, connect, disconnect } = useSocketProgress({
        autoConnect: false,
        onProgress: (event) => {
            setCurrentMessage(event.message);
        },
        onComplete: (data) => {
            setUploadComplete(true);
            setCurrentMessage("Upload complete!");
        },
        onError: (error) => {
            setCurrentMessage(`Error: ${error}`);
        }
    });

    const handleUpload = async (file: File) => {
        try {
            setDialogOpen(true);
            setUploadComplete(false);
            setCurrentMessage("Connecting...");

            // Connect to socket
            await connect();
            setCurrentMessage("Connected! Starting upload...");

            // Your upload logic here
            await uploadFile(file, clientId);

        } catch (error) {
            console.error(error);
            setCurrentMessage("Upload failed");
        }
    };

    const handleClose = () => {
        disconnect();
        setDialogOpen(false);
        setUploadComplete(false);
        setCurrentMessage("");
    };

    return (
        <>
            <button onClick={() => document.getElementById('file-input')?.click()}>
                Upload File
            </button>

            <input
                id="file-input"
                type="file"
                hidden
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                }}
            />

            <AlertDialog open={dialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {uploadComplete ? "Complete!" : "Uploading..."}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {currentMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {lastProgress?.percent !== undefined && !uploadComplete && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${lastProgress.percent}%` }}
                            />
                        </div>
                    )}

                    <AlertDialogFooter>
                        {uploadComplete ? (
                            <AlertDialogAction onClick={handleClose}>
                                Done
                            </AlertDialogAction>
                        ) : (
                            <AlertDialogCancel onClick={handleClose}>
                                Cancel
                            </AlertDialogCancel>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// ============================================
// Helper: Upload File Function
// ============================================

async function uploadFile(file: File, clientId: string) {
    // 1. Get presigned URL
    const presignResponse = await fetch('/api/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            filename: file.name,
            contentType: file.type
        })
    });

    const { uploadUrl, key } = await presignResponse.json();

    // 2. Upload to S3
    await fetch(uploadUrl, {
        method: 'PUT',
        body: file
    });

    // 3. Trigger backend processing (with clientId for progress updates)
    await fetch(`/api/process?clientId=${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
    });
}