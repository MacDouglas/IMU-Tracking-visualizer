import React from 'react';

interface FileUploaderProps {
  onData: (raw: string) => void;
}

export default function FileUploader({ onData }: FileUploaderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onData(ev.target?.result as string);
    reader.readAsText(file);
  };

  return (
    <div>
      <input type="file" accept=".tsv,.txt" onChange={handleChange} />
    </div>
  );
}
