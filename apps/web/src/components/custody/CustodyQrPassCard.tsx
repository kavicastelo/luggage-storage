import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  RefreshCw,
  Printer,
  Clock,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck
} from "lucide-react";
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
  const [showManualToken, setShowManualToken] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const matrix = buildQrMatrixPath(qrPayload);
  const quietZone = 2;
  const isCollection = operation === "COLLECTION";
  const operationLabel = isCollection ? "Collection Release" : "Check-In Drop-Off";
  const expiryInfo = expiresAt ? formatRemainingCountdown(expiresAt, nowMs) : null;

  const handoverSteps = isCollection
    ? [
        "Show this QR code or read the 6-digit PIN to host counter staff.",
        "Inspect unbroken tamper-evident seals before confirming release."
      ]
    : [
        "Present this QR code or 6-digit backup PIN at the host counter.",
        "Confirm serialized tamper-evident seals are applied to every bag."
      ];

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
    <Card className="border-2 border-navy-900 bg-white overflow-hidden shadow-md">
      {/* Boarding-Pass Header */}
      <div className="bg-navy-950 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-terracotta-400" />
            <h3 className="text-lg font-extrabold tracking-tight">Digital Custody Pass</h3>
          </div>
          <p className="text-xs text-sand-300 mt-0.5">
            Reference{" "}
            <span className="font-mono font-bold text-white">{`#${referenceCode}`}</span>
            {locationName ? ` • ${locationName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isCollection ? "warning" : "brand"} size="md">
            {operationLabel}
          </Badge>
          {isPreviewDemo && (
            <Badge variant="neutral" size="sm">
              Demo Pass
            </Badge>
          )}
        </div>
      </div>

      {/* Main Ticket Body */}
      <div className="p-6 space-y-5">
        {expiryInfo?.expired && (
          <Alert variant="warning" title="Custody Pass Expired">
            Single-use custody credentials expire after 15 minutes for handover security. Generate
            a fresh pass before presenting at the counter.
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
          {/* Scannable QR Code SVG + Collapsible Manual Token */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-sand-200 bg-sand-50 p-5">
            {matrix ? (
              <div
                className="bg-white p-3.5 rounded-xl border border-sand-200 shadow-sm"
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

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 print:hidden">
              <button
                type="button"
                onClick={() => setShowManualToken((prev) => !prev)}
                aria-expanded={showManualToken}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sand-200 bg-white text-xs font-semibold text-navy-900 hover:bg-sand-100 transition-colors"
              >
                <span>Manual Token</span>
                {showManualToken ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyToken}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 rounded-lg border border-sand-200 bg-white text-navy-900 hover:bg-sand-100 transition-colors text-xs font-semibold"
                title="Copy manual QR token"
                aria-label="Copy manual QR token"
              >
                {copiedToken ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span aria-live="polite" className={copiedToken ? "text-emerald-700 font-bold" : ""}>
                  {copiedToken ? "Copied" : "Copy"}
                </span>
              </button>
            </div>

            {showManualToken && (
              <div className="mt-2.5 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-center">
                <code className="block text-[11px] font-mono text-sand-800 break-all select-all">
                  {qrPayload}
                </code>
              </div>
            )}
          </div>

          {/* 6-Digit Offline Fallback PIN & Custody Metadata */}
          <div className="space-y-4">
            <div className="rounded-xl bg-terracotta-50 border border-terracotta-200 p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-terracotta-700">
                <KeyRound className="h-3.5 w-3.5" />
                6-Digit Fallback PIN
              </div>
              <p
                className="text-3xl font-mono font-black tracking-[0.2em] text-navy-950 mt-1 tabular-nums"
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
                  className={`font-mono font-bold tabular-nums ${
                    expiryInfo.expired ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {expiryInfo.label}
                </span>
              </div>
            )}

            {(zoneCode || sealIds.length > 0) && (
              <div className="rounded-xl border border-sand-200 bg-white px-3.5 py-2.5 text-xs space-y-1.5">
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

            {/* Concise 2-Step Counter Handover Checklist */}
            <div className="rounded-xl border border-sand-200 bg-sand-50/70 px-3.5 py-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-navy-900">
                <ClipboardCheck className="h-3.5 w-3.5 text-terracotta-600" />
                2-Step Counter Handover
              </div>
              <ol className="space-y-1 text-xs text-sand-800 list-decimal list-inside">
                {handoverSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Perforated Boarding-Pass Stub */}
      <div className="relative border-t-2 border-dashed border-sand-200 bg-sand-50/60 px-6 py-4">
        <span
          aria-hidden="true"
          className="hidden sm:block absolute -left-3 -top-3 w-6 h-6 rounded-full bg-sand-50 border-r border-sand-200"
        />
        <span
          aria-hidden="true"
          className="hidden sm:block absolute -right-3 -top-3 w-6 h-6 rounded-full bg-sand-50 border-l border-sand-200"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 print:hidden">
            {onRegenerate && (
              <Button
                type="button"
                variant="outline"
                size="md"
                isLoading={isRegenerating}
                onClick={onRegenerate}
                className="print:hidden"
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate Pass
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="print:hidden"
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
          <p className="text-[11px] text-sand-700 font-medium">
            Present this pass to counter staff at drop-off and collection.
          </p>
        </div>
      </div>
    </Card>
  );
};
