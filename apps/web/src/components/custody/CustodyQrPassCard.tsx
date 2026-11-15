import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { RefreshCw, Printer, Clock, ShieldCheck, KeyRound, Copy, Check } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export interface QrMatrixData {
  size: number;
  path: string;
}

/**
 * Generates an SVG path matrix for any custody QR payload synchronously.
 * Mirrors apps/mobile QrCodeMatrix so web passes work deterministically in both DOM and SSR.
 */
export function buildQrMatrixPath(payload: string): QrMatrixData | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;

  const qr = QRCode.create(trimmed, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const segments: string[] = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (data[row * size + col]) {
        segments.push(`M${col},${row}h1v1h-1z`);
      }
    }
  }

  return { size, path: segments.join("") };
}

function formatSixDigitPin(pin: string): string {
  const digits = pin.replace(/\s+/g, "");
  if (digits.length === 6) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  return pin;
}

function formatRemainingCountdown(expiresAtIso: string, nowMs: number): {
  expired: boolean;
  label: string;
} {
  const expMs = new Date(expiresAtIso).getTime();
  if (Number.isNaN(expMs)) {
    return { expired: false, label: "Active" };
  }
  const diffSec = Math.floor((expMs - nowMs) / 1000);
  if (diffSec <= 0) {
    return { expired: true, label: "Expired — regenerate pass" };
  }
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return {
    expired: false,
    label: `${mins}:${String(secs).padStart(2, "0")}`
  };
}

export interface CustodyQrPassCardProps {
  referenceCode: string;
  operation: "CHECK_IN" | "COLLECTION" | string;
  qrPayload: string;
  verificationPin: string;
  expiresAt?: string | null;
  locationName?: string;
  sealIds?: string[];
  zoneCode?: string;
  isRegenerating?: boolean;
  isPreviewDemo?: boolean;
  onRegenerate?: () => void;
  onPrint?: () => void;
}

export const CustodyQrPassCard: React.FC<CustodyQrPassCardProps> = ({
  referenceCode,
  operation,
  qrPayload,
  verificationPin,
  expiresAt,
  locationName,
  sealIds = [],
  zoneCode,
  isRegenerating = false,
  isPreviewDemo = false,
  onRegenerate,
  onPrint
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const matrix = buildQrMatrixPath(qrPayload);
  const quietZone = 2;
  const operationLabel = operation === "COLLECTION" ? "Collection Release" : "Check-In Drop-Off";
  const expiryInfo = expiresAt ? formatRemainingCountdown(expiresAt, nowMs) : null;

  const handleCopyToken = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(qrPayload);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      // Clipboard write unavailable in this context
    }
  };

  return (
    <Card className="border-2 border-navy-900 bg-white overflow-hidden">
      <div className="bg-navy-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-terracotta-400" />
            <h3 className="text-lg font-extrabold tracking-tight">Digital Custody Pass</h3>
          </div>
          <p className="text-xs text-sand-300 mt-0.5">
            Reference <span className="font-mono font-bold text-white">{`#${referenceCode}`}</span>
            {locationName ? ` • ${locationName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={operation === "COLLECTION" ? "warning" : "brand"} size="md">
            {operationLabel}
          </Badge>
          {isPreviewDemo && (
            <Badge variant="neutral" size="sm">
              Demo Pass
            </Badge>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5">
        {expiryInfo?.expired && (
          <Alert variant="warning" title="Custody Pass Expired">
            Single-use custody credentials expire after 15 minutes for handover security. Generate
            a fresh pass before presenting at the counter.
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
          {/* Scannable QR Code SVG */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-sand-200 bg-sand-50 p-5">
            {matrix ? (
              <div
                className="bg-white p-3 rounded-xl border border-sand-200 shadow-xs"
                data-qr-payload={qrPayload}
              >
                <svg
                  width={184}
                  height={184}
                  viewBox={`-${quietZone} -${quietZone} ${matrix.size + quietZone * 2} ${
                    matrix.size + quietZone * 2
                  }`}
                  role="img"
                  aria-label={`Custody QR code for booking ${referenceCode}`}
                  shapeRendering="crispEdges"
                >
                  <rect
                    x={-quietZone}
                    y={-quietZone}
                    width={matrix.size + quietZone * 2}
                    height={matrix.size + quietZone * 2}
                    fill="#ffffff"
                  />
                  <path d={matrix.path} fill="#070e1a" />
                </svg>
              </div>
            ) : (
              <div className="w-44 h-44 flex items-center justify-center text-xs text-sand-600">
                QR token unavailable
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 max-w-full">
              <code className="text-[11px] font-mono text-sand-700 bg-white px-2.5 py-1 rounded-lg border border-sand-200 truncate max-w-[190px]">
                {qrPayload}
              </code>
              <button
                type="button"
                onClick={handleCopyToken}
                className="p-1.5 rounded-lg border border-sand-200 bg-white text-navy-900 hover:bg-sand-100"
                title="Copy raw QR token"
                aria-label="Copy raw QR token"
              >
                {copiedToken ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* 6-Digit Offline Fallback PIN & Custody Metadata */}
          <div className="space-y-4">
            <div className="rounded-xl bg-terracotta-50 border border-terracotta-200 p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-terracotta-700">
                <KeyRound className="h-3.5 w-3.5" />
                6-Digit Fallback PIN
              </div>
              <p
                className="text-3xl font-mono font-black tracking-[0.2em] text-navy-950 mt-1"
                data-pin-value={verificationPin}
              >
                {formatSixDigitPin(verificationPin)}
              </p>
              <p className="text-xs text-sand-700 mt-1.5">
                Host staff can verify this 6-digit PIN at the counter if QR camera scanning is
                unavailable.
              </p>
            </div>

            {expiryInfo && (
              <div className="flex items-center justify-between rounded-xl border border-sand-200 bg-sand-50 px-3.5 py-2.5 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-sand-700">
                  <Clock className="h-3.5 w-3.5 text-navy-700" />
                  Pass Validity
                </span>
                <span
                  className={`font-mono font-bold ${
                    expiryInfo.expired ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {expiryInfo.label}
                </span>
              </div>
            )}

            {(zoneCode || sealIds.length > 0) && (
              <div className="rounded-xl border border-sand-200 bg-white px-3.5 py-2.5 text-xs space-y-1">
                {zoneCode && (
                  <div className="flex justify-between">
                    <span className="text-sand-700">Storage Zone</span>
                    <span className="font-mono font-bold text-navy-900">{zoneCode}</span>
                  </div>
                )}
                {sealIds.length > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-sand-700">Security Seals</span>
                    <span className="font-mono font-semibold text-navy-900 text-right">
                      {sealIds.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-sand-200">
          <div className="flex flex-wrap gap-2">
            {onRegenerate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={isRegenerating}
                onClick={onRegenerate}
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate Pass
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (onPrint) {
                  onPrint();
                } else if (typeof window !== "undefined" && typeof window.print === "function") {
                  window.print();
                }
              }}
            >
              <Printer className="h-4 w-4" />
              Print / Save Pass
            </Button>
          </div>
          <p className="text-[11px] text-sand-600">
            Present this pass to counter staff at drop-off and collection.
          </p>
        </div>
      </div>
    </Card>
  );
};
