import React, { useRef, useState } from 'react';

interface FileUploaderProps {
  /** Called with the file text and its name */
  onData: (raw: string, name: string) => void;
  disabled?: boolean;
  /** Max width of the file name label, px */
  nameMaxWidth?: number;
}

/**
 * Button + selected file name. The hidden <input> is reset after every read, so picking
 * the same file again still fires `change` (browsers skip it when the value is unchanged).
 */
export default function FileUploader({ onData, disabled = false, nameMaxWidth = 220 }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') {
        setName(file.name);
        onData(result, file.name);
      }
    };
    reader.onerror = () => alert('Не удалось прочитать файл. Проверьте формат (.tsv).');
    reader.readAsText(file);
    input.value = '';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, opacity: disabled ? 0.5 : 1 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        style={{
          fontSize: 12, padding: '2px 10px', borderRadius: 4,
          border: '1px solid #c8c8c8', background: '#f6f6f6',
          cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap',
        }}
      >
        Выбрать файл
      </button>
      <span
        title={name ?? undefined}
        style={{
          fontSize: 12, color: name ? '#333' : '#aaa', maxWidth: nameMaxWidth,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {name ?? 'файл не выбран'}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept=".tsv,.txt"
        disabled={disabled}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
