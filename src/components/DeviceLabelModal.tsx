import React, { useState, useRef } from 'react';
import { Device } from '../types';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import Barcode from 'react-barcode';
import { X, Printer, Download, Copy, Check, QrCode, Tag, Sliders, ExternalLink } from 'lucide-react';

interface DeviceLabelModalProps {
  devices: Device[];
  isOpen: boolean;
  onClose: () => void;
}

export default function DeviceLabelModal({ devices, isOpen, onClose }: DeviceLabelModalProps) {
  const [labelSize, setLabelSize] = useState<'standard' | 'compact' | 'full'>('standard');
  const [showQrCode, setShowQrCode] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showSpecs, setShowSpecs] = useState(true);
  const [showCompany, setShowCompany] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canvasRefs = useRef<{ [key: string]: HTMLCanvasElement | null }>({});

  if (!isOpen || devices.length === 0) return null;

  const getDeviceUrl = (id: string) => {
    return `${window.location.origin}/devices/${id}`;
  };

  const handleCopyLink = (device: Device) => {
    const url = getDeviceUrl(device.id);
    navigator.clipboard.writeText(url);
    setCopiedId(device.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadQrPng = (device: Device) => {
    const canvas = canvasRefs.current[device.id];
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR_${device.category.replace(/\s+/g, '_')}_${device.serialNumber}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Modal Dialog (Hidden on Print) */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 print:hidden">
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in" onClick={onClose} />
        
        <div className="relative bg-white w-full max-w-4xl max-h-[92dvh] rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in">
          
          {/* Header */}
          <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight text-white leading-tight">
                  Generatore Etichette Magazzino
                </h2>
                <p className="text-xs text-slate-300">
                  {devices.length === 1 
                    ? `${devices[0].category} - SN: ${devices[0].serialNumber}` 
                    : `${devices.length} etichette dispositivo selezionate`}
                </p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          {/* Config Bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5 mr-1">
                <Sliders className="w-3.5 h-3.5 text-slate-500" /> Formato:
              </span>
              <button
                onClick={() => setLabelSize('standard')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  labelSize === 'standard' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Standard (70x45mm)
              </button>
              <button
                onClick={() => setLabelSize('compact')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  labelSize === 'compact' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Compatto (50x30mm)
              </button>
              <button
                onClick={() => setLabelSize('full')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  labelSize === 'full' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Badge Esteso
              </button>
            </div>

            <div className="flex items-center gap-4 flex-wrap text-slate-600">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showQrCode} 
                  onChange={e => setShowQrCode(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>QR Code</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showBarcode} 
                  onChange={e => setShowBarcode(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>Barcode</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showSpecs} 
                  onChange={e => setShowSpecs(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>Specifiche</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showCompany} 
                  onChange={e => setShowCompany(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>Intestazione</span>
              </label>
            </div>
          </div>

          {/* Interactive Preview Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70">
            <div className="max-w-3xl mx-auto space-y-6">
              
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider text-slate-600">
                  Anteprima Etichette ({devices.length})
                </span>
                <span className="text-[11px] bg-slate-200/80 px-2 py-0.5 rounded text-slate-600">
                  Scansionando il QR si apre direttamente la scheda del dispositivo
                </span>
              </div>

              {/* Grid of label cards in preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {devices.map((device) => {
                  const url = getDeviceUrl(device.id);
                  const specsList = Object.entries(device.dynamicFields || {}).filter(([_, v]) => Boolean(v));

                  return (
                    <div 
                      key={`preview-${device.id}`}
                      className="bg-white rounded-xl border border-slate-300/80 p-4 shadow-sm relative flex flex-col justify-between hover:border-blue-400 transition-colors"
                    >
                      {/* Label Card Body */}
                      <div className="space-y-3">
                        {/* Company Header */}
                        {showCompany && (
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                              <Tag className="w-3 h-3 text-blue-600" />
                              Office Manager IT • Magazzino
                            </span>
                            <span className="text-[9px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded font-bold">
                              {device.isUnderMaintenance ? 'MANUTENZIONE' : device.assignedToUserId ? 'IN USO' : 'DISPONIBILE'}
                            </span>
                          </div>
                        )}

                        {/* Title and Model */}
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm leading-tight">{device.category}</h3>
                          <p className="font-mono text-xs font-semibold text-slate-600 mt-0.5">
                            SN: <span className="text-slate-900">{device.serialNumber}</span>
                          </p>
                        </div>

                        {/* QR & Barcode Row */}
                        <div className="flex items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-lg border border-slate-100">
                          {showQrCode && (
                            <div className="flex flex-col items-center gap-1 shrink-0">
                              <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                                <QRCodeSVG
                                  value={url}
                                  size={labelSize === 'compact' ? 68 : labelSize === 'standard' ? 84 : 96}
                                  level="M"
                                  includeMargin={false}
                                />
                              </div>
                              <span className="text-[9px] font-bold text-blue-600 tracking-tight flex items-center gap-0.5">
                                <QrCode className="w-2.5 h-2.5" /> Scansiona
                              </span>
                            </div>
                          )}

                          <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                            {showBarcode && (
                              <div className="w-full flex flex-col items-center overflow-hidden">
                                <div className="transform scale-90 origin-center max-w-full">
                                  <Barcode 
                                    value={device.serialNumber} 
                                    height={labelSize === 'compact' ? 24 : 32} 
                                    width={1.2}
                                    displayValue={false} 
                                    margin={0}
                                    lineColor="#1e293b"
                                  />
                                </div>
                                <span className="font-mono text-[10px] text-slate-500 font-bold mt-1">
                                  {device.serialNumber}
                                </span>
                              </div>
                            )}

                            {/* Specs Preview */}
                            {showSpecs && specsList.length > 0 && (
                              <div className="w-full mt-2 pt-2 border-t border-slate-200/60 text-[10px] text-slate-600 space-y-0.5">
                                {specsList.slice(0, labelSize === 'compact' ? 1 : 2).map(([k, v]) => (
                                  <div key={k} className="truncate">
                                    <span className="text-slate-600 font-medium capitalize">{k}:</span> <strong className="text-slate-700">{v}</strong>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* URL snippet */}
                        <div className="text-[9px] text-slate-600 font-mono truncate bg-slate-50 px-2 py-1 rounded border border-slate-100 flex items-center justify-between">
                          <span className="truncate">{url}</span>
                        </div>
                      </div>

                      {/* Card Action footer (Quick PNG Download & Copy Link) */}
                      <div className="flex items-center justify-end gap-1.5 pt-3 mt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleCopyLink(device)}
                          className="btn btn-secondary"
                          title="Copia link diretto alla scheda"
                        >
                          {copiedId === device.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                          <span>{copiedId === device.id ? 'Copiato!' : 'Copia Link'}</span>
                        </button>

                        <button
                          onClick={() => handleDownloadQrPng(device)}
                          className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Scarica immagine QR Code in PNG"
                        >
                          <Download className="w-3 h-3 text-blue-600" />
                          <span>Scarica QR</span>
                        </button>

                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="h-7 px-2 rounded-md text-[11px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center"
                          title="Apri scheda in nuova scheda"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      {/* Hidden offscreen canvas for PNG export */}
                      <div className="hidden">
                        <QRCodeCanvas
                          ref={(el) => {
                            canvasRefs.current[device.id] = el;
                          }}
                          value={url}
                          size={512}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <footer className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-500">
              Pronto per la stampa su etichettatrici termiche o fogli adesivi A4.
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Chiudi
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="btn btn-primary"
              >
                <Printer className="w-4 h-4" />
                <span>Stampa Etichette ({devices.length})</span>
              </button>
            </div>
          </footer>
        </div>
      </div>

      {/* Pure Print Container (Only visible during window.print()) */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-4">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .device-labels-print-area, .device-labels-print-area * {
              visibility: visible;
            }
            .device-labels-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 0;
              margin: 0;
            }
            @page {
              size: auto;
              margin: 10mm;
            }
          }
        `}} />
        <div className="device-labels-print-area grid grid-cols-2 gap-4">
          {devices.map((device) => {
            const url = getDeviceUrl(device.id);
            const specsList = Object.entries(device.dynamicFields || {}).filter(([_, v]) => Boolean(v));

            return (
              <div 
                key={`print-${device.id}`}
                className="border-2 border-slate-800 rounded-lg p-3 bg-white flex flex-col justify-between break-inside-avoid text-black page-break-inside-avoid mb-2"
                style={{
                  minHeight: labelSize === 'compact' ? '40mm' : labelSize === 'standard' ? '50mm' : '65mm',
                  maxWidth: '90mm'
                }}
              >
                {/* Header */}
                {showCompany && (
                  <div className="flex items-center justify-between border-b border-black pb-1 mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      OFFICE MANAGER IT
                    </span>
                    <span className="text-[9px] font-mono font-bold uppercase">
                      {device.isUnderMaintenance ? '[MANUTENZIONE]' : device.assignedToUserId ? '[IN USO]' : '[DISPONIBILE]'}
                    </span>
                  </div>
                )}

                {/* Model & SN */}
                <div className="mb-1.5">
                  <div className="text-xs font-black leading-tight uppercase">{device.category}</div>
                  <div className="text-[10px] font-mono font-bold">SN: {device.serialNumber}</div>
                </div>

                {/* Main QR and Barcode Content */}
                <div className="flex items-center gap-3 my-1">
                  {showQrCode && (
                    <div className="shrink-0 flex flex-col items-center">
                      <QRCodeSVG
                        value={url}
                        size={labelSize === 'compact' ? 65 : 80}
                        level="M"
                        includeMargin={false}
                      />
                      <span className="text-[8px] font-bold uppercase mt-0.5">Scansiona QR</span>
                    </div>
                  )}

                  <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                    {showBarcode && (
                      <div className="w-full flex flex-col items-center">
                        <Barcode 
                          value={device.serialNumber} 
                          height={labelSize === 'compact' ? 22 : 28} 
                          width={1.1}
                          displayValue={false} 
                          margin={0}
                          lineColor="#000000"
                        />
                        <span className="font-mono text-[9px] font-bold mt-0.5">{device.serialNumber}</span>
                      </div>
                    )}

                    {showSpecs && specsList.length > 0 && (
                      <div className="w-full mt-1 pt-1 border-t border-slate-300 text-[8px] leading-tight">
                        {specsList.slice(0, 2).map(([k, v]) => (
                          <div key={k} className="truncate">
                            <span className="font-bold uppercase">{k}:</span> {v}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* URL Footer */}
                <div className="mt-1 pt-1 border-t border-slate-300 text-[8px] font-mono text-center truncate">
                  {url}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
