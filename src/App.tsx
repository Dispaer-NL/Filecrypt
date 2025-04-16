import React, { useState, useCallback } from 'react';
import { Lock, Unlock, Upload, FileKey, AlertCircle } from 'lucide-react';

function App() {
  const [encryptMode, setEncryptMode] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if ((ext === 'zip' && !encryptMode) || (ext === 'fcx' && encryptMode)) {
      setEncryptMode(ext === 'zip');
    }
    setSelectedFile(file);
    setError('');
  }, [encryptMode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);

  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }, []);

  const encryptZip = async () => {
    if (!selectedFile || !password) {
      setError('Please select a ZIP file and enter a password');
      return;
    }

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const keyMaterial = await window.crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), {name: 'PBKDF2'}, false, ['deriveKey']
      );
      const key = await window.crypto.subtle.deriveKey({
        name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256'
      }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);

      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, arrayBuffer);

      const output = {
        magic: 'FCRY',
        version: 1,
        salt: btoa(String.fromCharCode(...salt)),
        iv: btoa(String.fromCharCode(...iv)),
        data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
      };

      const blob = new Blob([JSON.stringify(output)], {type: 'application/json'});
      triggerDownload(blob, selectedFile.name.replace(/\.zip$/, '') + '.fcx');
    } catch (err) {
      setError('Encryption failed. Please try again.');
    }
  };

  const decryptFcx = async () => {
    if (!selectedFile || !password) {
      setError('Please select an FCX file and enter a password');
      return;
    }

    try {
      const text = await selectedFile.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
        if (parsed.magic !== 'FCRY') throw new Error('Invalid format');
      } catch (err) {
        setError('Invalid encrypted file');
        return;
      }

      const salt = Uint8Array.from(atob(parsed.salt), c => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(parsed.iv), c => c.charCodeAt(0));
      const encryptedData = Uint8Array.from(atob(parsed.data), c => c.charCodeAt(0));

      const keyMaterial = await window.crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), {name: 'PBKDF2'}, false, ['deriveKey']
      );
      const key = await window.crypto.subtle.deriveKey({
        name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256'
      }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);

      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedData);
      const blob = new Blob([decrypted], {type: 'application/zip'});
      triggerDownload(blob, selectedFile.name.replace(/\.fcx$/, '') + '.zip');
    } catch (err) {
      setError('Wrong password or corrupted file');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4 overflow-hidden">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md shadow-2xl border border-white/20 animate-fade-in">
        <div className="flex items-center justify-center mb-8 animate-slide-down">
          <FileKey className="w-8 h-8 text-emerald-400 mr-2 animate-pulse" />
          <h1 className="text-3xl font-bold text-white">FileCrypter</h1>
        </div>

        <div className="space-y-6">
          <div className="flex bg-white/5 rounded-lg p-1 animate-slide-right">
            <button
              onClick={() => setEncryptMode(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all duration-300 ${
                encryptMode ? 'bg-emerald-500 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Lock className="w-4 h-4" />
              Encrypt
            </button>
            <button
              onClick={() => setEncryptMode(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all duration-300 ${
                !encryptMode ? 'bg-emerald-500 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Unlock className="w-4 h-4" />
              Decrypt
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 cursor-pointer animate-slide-up
              ${isDragging ? 'border-emerald-400 bg-emerald-400/10 scale-[1.02]' : 'border-white/20 hover:border-white/40'}
              ${selectedFile ? 'bg-white/5' : ''}`}
          >
            <input
              type="file"
              accept={encryptMode ? ".zip" : ".fcx"}
              onChange={handleFileInput}
              className="hidden"
              id="fileInput"
            />
            <label htmlFor="fileInput" className="cursor-pointer">
              {selectedFile ? (
                <div className="text-white">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-white/60 mt-1">Click or drag to change file</p>
                </div>
              ) : (
                <div className="text-white/60">
                  <Upload className="w-8 h-8 mx-auto mb-2 animate-bounce" />
                  <p className="font-medium">Drop your {encryptMode ? 'ZIP' : 'FCX'} file here</p>
                  <p className="text-sm mt-1">or click to browse</p>
                </div>
              )}
            </label>
          </div>

          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40
              focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/50 transition-all duration-300
              hover:border-white/20 animate-slide-left"
          />

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-lg animate-shake">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={encryptMode ? encryptZip : decryptFcx}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 rounded-lg
              transition-all duration-300 hover:shadow-lg active:shadow-sm animate-slide-up
              flex items-center justify-center gap-2"
          >
            {encryptMode ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {encryptMode ? 'Encrypt ZIP' : 'Decrypt File'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;