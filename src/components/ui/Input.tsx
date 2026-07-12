interface InputProps {
  placeholder?: string
  value: string
  onChange?: (value: string) => void
  error?: string
  type?: string
  autoFocus?: boolean
  className?: string
  maxLength?: number
  inputMode?: string
  pattern?: string
}

const Input = ({
  placeholder,
  value,
  onChange,
  error,
  type = 'text',
  autoFocus,
  className = '',
  maxLength,
  inputMode,
  pattern,
}: InputProps) => {
  const baseClasses = `w-full px-6 py-2 border text-xl rounded-full bg-white/20 text-white placeholder:text-white/70 outline-none transition-colors ${error ? 'border-danger' : 'border-gray-600'}`

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value)
  }

  return (
    <div className="w-full">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        autoFocus={autoFocus}
        maxLength={maxLength}
        inputMode={inputMode as React.HTMLAttributes<HTMLInputElement>['inputMode']}
        pattern={pattern}
        className={`${baseClasses} ${className}`}
      />
      {error && <p className="text-danger text-xs text-center">{error}</p>}
    </div>
  )
}

export default Input
