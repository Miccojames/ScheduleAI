"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, FileImage, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "cn";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FILE_SIZE = 8 * 1024 * 1024;

interface UploadDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

/** Validates a picked file and reports problems through a toast. */
function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Unsupported file type. Upload a JPEG, PNG, or WebP image.";
  }
  if (file.size === 0) {
    return "That file is empty. Please choose another image.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "That image is larger than 8MB. Please upload a smaller one.";
  }
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Drag & drop + file picker + camera capture, with a preview of the selection. */
export function UploadDropzone({ file, onFileChange, disabled = false }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function accept(selected: File | undefined) {
    if (!selected) return;
    const problem = validateFile(selected);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(selected));
    onFileChange(selected);
  }

  function clear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onFileChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  if (file && previewUrl) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-4">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
            <Image
              src={previewUrl}
              alt="Selected schedule preview"
              fill
              unoptimized
              className="object-cover"
              sizes="96px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              disabled={disabled}
              className="mt-2 -ml-2 text-muted-foreground hover:text-destructive"
            >
              <X className="size-4" aria-hidden="true" />
              Remove
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragging ? "border-indigo-400 bg-primary/10" : "border-border bg-card",
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
          <UploadCloud className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-medium text-foreground">Drag an image here</p>
        <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG or WebP · up to 8MB</p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
            <FileImage className="size-4" aria-hidden="true" />
            Browse files
          </Button>
          <Button
            variant="outline"
            className="sm:hidden"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled}
          >
            <Camera className="size-4" aria-hidden="true" />
            Take a photo
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          aria-label="Upload a schedule image"
          onChange={(event) => accept(event.target.files?.[0])}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          capture="environment"
          className="sr-only"
          aria-label="Take a photo of your schedule"
          onChange={(event) => accept(event.target.files?.[0])}
        />
      </div>

      {disabled ? (
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Working on your image…
        </p>
      ) : null}
    </div>
  );
}