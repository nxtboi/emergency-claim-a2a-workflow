
import React, { useState, useRef, useEffect } from 'react';
import { WorkflowStep, DamageReport, HandshakeLog, ClaimResult } from './types';
import { analyzeDamage } from './services/geminiService';
import { Terminal } from './components/Terminal';
import { A2AVisualizer } from './components/A2AVisualizer';

const APPROVAL_THRESHOLD = 5000;

const App: React.FC = () => {
  const [step, setStep] = useState<WorkflowStep>(WorkflowStep.IDLE);
  const [report, setReport] = useState<DamageReport | null>(null);
  const [logs, setLogs] = useState<HandshakeLog[]>([]);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (log: Omit<HandshakeLog, 'timestamp'>) => {
    setLogs(prev => [...prev, { ...log, timestamp: new Date().toLocaleTimeString() }]);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Simulate Upload
    setStep(WorkflowStep.UPLOADING);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setPreviewUrl(reader.result as string);
      
      try {
        setStep(WorkflowStep.GEMINI_ANALYSIS);
        const damageReport = await analyzeDamage(base64, file.type);
        setReport(damageReport);
        
        // Start A2A Handshake
        setStep(WorkflowStep.A2A_HANDSHAKE);
        await performA2AHandshake(damageReport);
        
      } catch (error) {
        console.error("Analysis failed", error);
        setStep(WorkflowStep.IDLE);
        alert("Verification failed. Please ensure the image/video clearly shows the damage.");
      }
    };
    reader.readAsDataURL(file);
  };

  const performA2AHandshake = async (report: DamageReport) => {
    // Step 1: Google Agent initiates A2A
    addLog({
      from: 'GoogleAgent',
      to: 'SalesforceAgent',
      protocol: 'A2A',
      status: 'SENT',
      payload: {
        method: 'PROPOSE_CLAIM',
        params: {
          assessment: report,
          agent_version: 'Gemini-3-Pro-Handshake-V1'
        }
      }
    });

    await new Promise(r => setTimeout(r, 1500));

    // Step 2: Salesforce Agent checks thresholds
    const isApproved = report.estimatedCost < APPROVAL_THRESHOLD;
    addLog({
      from: 'SalesforceAgent',
      to: 'GoogleAgent',
      protocol: 'A2A',
      status: 'PROCESSED',
      payload: {
        method: 'EVALUATE_POLICY',
        result: isApproved ? 'AUTO_APPROVE' : 'REQUIRE_MANUAL_REVIEW',
        threshold_applied: `$${APPROVAL_THRESHOLD}`
      }
    });

    await new Promise(r => setTimeout(r, 1500));

    // Step 3: Initiate AP2 if approved
    if (isApproved) {
      addLog({
        from: 'SalesforceAgent',
        to: 'SalesforceAgent',
        protocol: 'AP2',
        status: 'SENT',
        payload: {
          method: 'INITIATE_PAYMENT',
          amount: report.estimatedCost,
          currency: 'USD',
          // Fix: Renamed duplicate property 'method' to 'settlement_network' to resolve object literal error.
          settlement_network: 'FED_INSTANT_SETTLEMENT'
        }
      });
    }

    await new Promise(r => setTimeout(r, 1000));

    setResult({
      status: isApproved ? 'APPROVED' : 'MANUAL_REVIEW',
      paymentInitiated: isApproved,
      referenceId: `CLM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      report: report
    });
    setStep(WorkflowStep.COMPLETED);
  };

  const resetWorkflow = () => {
    setStep(WorkflowStep.IDLE);
    setReport(null);
    setLogs([]);
    setResult(null);
    setPreviewUrl(null);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-red-600 rounded-xl shadow-lg shadow-red-500/20">
            <i className="fa-solid fa-house-flood-water text-2xl text-white"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rapid Response Claim Agent</h1>
            <p className="text-slate-400 text-sm">Agentic A2A Handshake Workflow v2026.4</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="flex items-center px-3 py-1 bg-green-900/30 text-green-400 text-xs font-mono rounded-full border border-green-800">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse mr-2"></span>
            A2A NODE_ONLINE
          </span>
          <button 
            onClick={resetWorkflow}
            className="text-slate-400 hover:text-white transition-colors text-sm underline"
          >
            Reset System
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Input and Analysis */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Upload Area */}
          {step === WorkflowStep.IDLE && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 rounded-2xl p-12 flex flex-col items-center justify-center hover:border-blue-500 hover:bg-blue-500/5 transition-all cursor-pointer group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*,video/*"
              />
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-cloud-arrow-up text-3xl text-slate-400 group-hover:text-blue-400"></i>
              </div>
              <h3 className="text-xl font-semibold mb-2">Upload Damage Footage</h3>
              <p className="text-slate-400 text-center max-w-sm">
                Provide a clear video or image of the flooded area. Gemini will analyze the damage intensity and estimate costs.
              </p>
            </div>
          )}

          {/* Processing State */}
          {(step === WorkflowStep.UPLOADING || step === WorkflowStep.GEMINI_ANALYSIS) && (
            <div className="bg-slate-800/50 rounded-2xl p-12 flex flex-col items-center justify-center border border-slate-700 animate-pulse">
              <div className="relative mb-8">
                <div className="w-24 h-24 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <i className="fa-brands fa-google text-2xl text-blue-400"></i>
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {step === WorkflowStep.UPLOADING ? 'Ingesting Evidence...' : 'Gemini AI Vision Analysis...'}
              </h3>
              <p className="text-slate-400 text-center max-w-sm">
                Identifying intensity levels, water heights, and estimated structural risk using Google Cloud Agent.
              </p>
            </div>
          )}

          {/* Report Display */}
          {(step === WorkflowStep.A2A_HANDSHAKE || step === WorkflowStep.COMPLETED) && report && (
            <div className="bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-700">
              <div className="p-6 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                <h3 className="font-bold flex items-center">
                  <i className="fa-solid fa-magnifying-glass-chart mr-3 text-blue-400"></i>
                  AI Damage Assessment Report
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  report.intensity === 'Catastrophic' ? 'bg-red-900 text-red-200' :
                  report.intensity === 'Severe' ? 'bg-orange-900 text-orange-200' : 'bg-blue-900 text-blue-200'
                }`}>
                  {report.intensity.toUpperCase()} INTENSITY
                </span>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Assessment Summary</h4>
                  <p className="text-slate-200 text-sm leading-relaxed">{report.summary}</p>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-400 text-xs uppercase font-bold">Estimated Cost</span>
                    <span className="text-2xl font-bold text-emerald-400">${report.estimatedCost.toLocaleString()}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Structural Risk</span>
                      <span className={report.structuralIntegrityRisk ? 'text-red-400' : 'text-emerald-400'}>
                        {report.structuralIntegrityRisk ? 'DETECTED' : 'CLEAR'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full ${report.estimatedCost > APPROVAL_THRESHOLD ? 'bg-orange-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min((report.estimatedCost / 10000) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Identified Damaged Items</h4>
                <div className="flex flex-wrap gap-2">
                  {report.identifiedItems.map((item, i) => (
                    <span key={i} className="px-3 py-1 bg-slate-700/50 rounded-lg text-xs text-slate-300 border border-slate-600">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* A2A Terminal (Always show when protocol starts) */}
          {(step === WorkflowStep.A2A_HANDSHAKE || step === WorkflowStep.COMPLETED) && (
            <Terminal logs={logs} />
          )}

        </div>

        {/* Right Column: Handshake and Status */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 flex flex-col h-full">
            <h3 className="text-lg font-bold mb-6 flex items-center">
              <i className="fa-solid fa-handshake-angle mr-3 text-orange-400"></i>
              Agent-to-Agent Handshake
            </h3>

            <A2AVisualizer 
              isProcessing={step === WorkflowStep.A2A_HANDSHAKE} 
              step={step === WorkflowStep.COMPLETED ? 3 : step === WorkflowStep.A2A_HANDSHAKE ? logs.length : 0} 
            />

            {/* Final Status Card */}
            {result && (
              <div className={`mt-auto p-6 rounded-2xl border ${
                result.status === 'APPROVED' 
                  ? 'bg-emerald-500/10 border-emerald-500/50' 
                  : 'bg-orange-500/10 border-orange-500/50'
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className={`text-sm font-bold uppercase tracking-wider ${
                      result.status === 'APPROVED' ? 'text-emerald-400' : 'text-orange-400'
                    }`}>
                      {result.status === 'APPROVED' ? 'Claim Auto-Approved' : 'Manual Review Required'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">Ref ID: {result.referenceId}</p>
                  </div>
                  <div className={`p-2 rounded-full ${
                    result.status === 'APPROVED' ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'
                  }`}>
                    <i className={`fa-solid ${result.status === 'APPROVED' ? 'fa-check' : 'fa-user-clock'}`}></i>
                  </div>
                </div>
                
                <p className="text-sm text-slate-300 mb-6">
                  {result.status === 'APPROVED' 
                    ? `Agentforce has verified the A2A handshake from Google Gemini and authorized a payout of $${report?.estimatedCost.toLocaleString()}. Payment initiated via AP2.`
                    : 'The estimated repair cost exceeds the $5,000 threshold for autonomous approval. The claim has been escalated to a Human Service Specialist.'}
                </p>

                {result.paymentInitiated && (
                  <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 flex items-center space-x-4">
                    <div className="w-10 h-10 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <i className="fa-solid fa-building-columns"></i>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">AP2 Payment Protocol</p>
                      <p className="text-xs text-white">Payment of <span className="text-emerald-400 font-bold">${report?.estimatedCost.toLocaleString()}</span> Disbursed</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!result && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                <div className="p-4 bg-slate-800 rounded-full mb-4 opacity-50">
                  <i className="fa-solid fa-robot text-4xl text-slate-500"></i>
                </div>
                <p className="text-slate-500 text-sm">
                  Awaiting vision analysis from Google Agent to begin Salesforce A2A protocol.
                </p>
              </div>
            )}
          </div>

          {/* User Preview */}
          {previewUrl && (
            <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
               <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Evidence Footage</span>
                  <i className="fa-solid fa-video text-slate-600"></i>
               </div>
               <div className="aspect-video bg-black flex items-center justify-center">
                  <img src={previewUrl} alt="Damage Evidence" className="max-h-full object-contain" />
               </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer Info */}
      <footer className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between text-slate-500 text-xs">
        <p>&copy; 2026 Disaster Management Solutions. Powered by Gemini 3.0 & Salesforce Agentforce A2A Protocol.</p>
        <div className="flex space-x-6 mt-4 md:mt-0">
          <span className="hover:text-slate-300 cursor-pointer">Security Compliance</span>
          <span className="hover:text-slate-300 cursor-pointer">API Documentation</span>
          <span className="hover:text-slate-300 cursor-pointer">Protocol Status</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
