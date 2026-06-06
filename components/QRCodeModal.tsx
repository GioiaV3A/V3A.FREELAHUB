'use client';

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Download, Check, ExternalLink } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  linkType: 'new_freelancer' | 'update_freelancer';
  freelancerName?: string;
  expiresAt?: string | null;
  status: string;
}

export default function QRCodeModal({
  isOpen,
  onClose,
  token,
  linkType,
  freelancerName,
  expiresAt,
  status
}: QRCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');

  // Setup full target URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const path = linkType === 'new_freelancer' ? '/public/freela/novo/' : '/public/freela/atualizar/';
      setUrl(`${origin}${path}${token}`);
    }
  }, [token, linkType]);

  // Render QR Code to Canvas
  useEffect(() => {
    if (isOpen && canvasRef.current && url) {
      QRCode.toCanvas(
        canvasRef.current,
        url,
        {
          width: 220,
          margin: 1,
          color: {
            dark: '#0A192F', // matching V3A dark navy
            light: '#FFFFFF'
          }
        },
        (error) => {
          if (error) console.error('Error generating QR Code:', error);
        }
      );
    }
  }, [isOpen, url]);

  if (!isOpen) return null;

  // Copy URL to Clipboard
  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download QR Code as PNG
  const handleDownloadQR = () => {
    if (canvasRef.current) {
      const pngUrl = canvasRef.current.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `qrcode-${linkType === 'new_freelancer' ? 'cadastro' : 'atualizacao'}-${token.slice(0, 8)}.png`;
      downloadLink.click();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081121]/80 backdrop-blur-xs animate-fade-in font-sans text-xs">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 flex flex-col relative animate-scale-up">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">QR Code Gerado</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              {linkType === 'new_freelancer' ? 'Pré-cadastro de Novo Freela' : 'Atualização de Cadastro'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          {freelancerName && (
            <p className="text-[11px] text-slate-700 font-bold bg-slate-100 px-3 py-1 rounded-full">
              Freelancer: {freelancerName}
            </p>
          )}

          {/* QR Code Container */}
          <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-xs">
            <canvas ref={canvasRef} className="block rounded-lg" />
          </div>

          {/* Link status info */}
          <div className="w-full bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1 text-left select-none text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold uppercase">Status:</span>
              <span className="text-emerald-600 font-extrabold uppercase bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                {status === 'active' ? 'Ativo' : status}
              </span>
            </div>
            {expiresAt && (
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase">Expira em:</span>
                <span className="text-slate-700 font-bold">
                  {new Date(expiresAt).toLocaleString('pt-BR')}
                </span>
              </div>
            )}
          </div>

          {/* URL text display */}
          <div className="w-full flex items-center bg-slate-50 border border-slate-100 rounded-xl overflow-hidden pr-2">
            <input
              type="text"
              readOnly
              value={url}
              className="flex-1 bg-transparent p-2.5 outline-none font-mono text-[10px] text-slate-600 truncate border-none"
            />
            <button
              onClick={handleCopyLink}
              className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg shadow-2xs shrink-0 cursor-pointer"
              title="Copiar Link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button
            onClick={handleDownloadQR}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-4 h-4" /> Baixar PNG
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold py-2.5 rounded-xl flex items-center justify-center transition"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
