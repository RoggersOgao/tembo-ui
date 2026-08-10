'use client'

import * as React from 'react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onValueChange' | 'type'> {
  value?: number | string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onValueChange?: (val: number | undefined) => void
  min?: number
  max?: number
  step?: number
  allowDecimals?: boolean
  allowNegative?: boolean
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      value,
      onChange,
      onValueChange,
      placeholder,
      min = 0,
      max = Number.MAX_SAFE_INTEGER,
      step = 1,
      disabled,
      className,
      allowDecimals = true,
      allowNegative = false,
      ...props
    },
    ref
  ) => {
    // Initialize state. If value is undefined/null, use empty string to show placeholder
    const [inputValue, setInputValue] = React.useState<string>(
      value !== undefined && value !== null ? String(value) : ''
    )

    // Sync prop value with internal state
    React.useEffect(() => {
      if (value !== undefined && value !== null) {
        setInputValue(String(value))
      } else {
        setInputValue('')
      }
    }, [value])

    // Helper to emit standard React Change Event for library compatibility (Hook Form, etc)
    const emitChange = (newValue: string) => {
      const syntheticEvent = {
        target: {
          value: newValue,
          name: props.name,
          type: 'number',
        },
      } as React.ChangeEvent<HTMLInputElement>

      onChange?.(syntheticEvent)

      const parsed = parseFloat(newValue)
      onValueChange?.(isNaN(parsed) ? undefined : parsed)
    }

    // Validate if the input string is a valid number format
    const isValidNumberInput = (val: string): boolean => {
      if (val === '' || val === '-') return true

      // Build regex based on options
      let pattern = '^-?\\d*'
      if (allowDecimals) {
        pattern += '\\.?\\d*'
      }
      pattern += '$'

      const regex = new RegExp(pattern)

      // Check if it matches the pattern
      if (!regex.test(val)) return false

      // Prevent negative numbers if not allowed
      if (!allowNegative && val.startsWith('-')) return false

      // Prevent multiple decimal points
      if (allowDecimals && (val.match(/\./g) || []).length > 1) return false

      return true
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value

      // Only allow valid number characters
      if (isValidNumberInput(newValue)) {
        setInputValue(newValue)
        emitChange(newValue)
      }
    }

    // Prevent non-numeric key presses
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const char = e.key
      const currentValue = inputValue

      // Allow control keys
      if (
        e.ctrlKey ||
        e.metaKey ||
        char === 'Backspace' ||
        char === 'Delete' ||
        char === 'Tab' ||
        char === 'Escape' ||
        char === 'Enter' ||
        char === 'ArrowLeft' ||
        char === 'ArrowRight' ||
        char === 'ArrowUp' ||
        char === 'ArrowDown'
      ) {
        return
      }

      // Allow numbers
      if (/^\d$/.test(char)) {
        return
      }

      // Allow decimal point if enabled and not already present
      if (allowDecimals && char === '.' && !currentValue.includes('.')) {
        return
      }

      // Allow minus sign if negative numbers allowed and it's at the start
      if (allowNegative && char === '-' && currentValue === '') {
        return
      }

      // Prevent all other characters
      e.preventDefault()
    }

    // Handle paste events
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      const pastedText = e.clipboardData.getData('text')

      // Validate pasted content
      if (isValidNumberInput(pastedText)) {
        const parsed = parseFloat(pastedText)
        if (!isNaN(parsed)) {
          // Clamp pasted value
          const clamped = Math.max(min, Math.min(parsed, max))
          const clampedStr = String(clamped)
          setInputValue(clampedStr)
          emitChange(clampedStr)
        }
      }
    }

    const handleBlur = () => {
      // If empty or just a minus sign, clear it
      if (inputValue === '' || inputValue === '-' || inputValue === '.') {
        setInputValue('')
        emitChange('')
        return
      }

      let num = parseFloat(inputValue)
      if (isNaN(num)) {
        setInputValue('')
        emitChange('')
        return
      }

      // Clamp on blur
      if (num < min) num = min
      if (num > max) num = max

      // Format the number (removes trailing zeros after decimal)
      const newStr = String(num)
      if (newStr !== inputValue) {
        setInputValue(newStr)
        emitChange(newStr)
      }
    }

    const updateValue = (operation: 'increment' | 'decrement') => {
      let current = parseFloat(inputValue)

      // If input is empty or invalid, start from min or 0
      if (isNaN(current)) {
        current = Math.max(min, 0)
      }

      // Handle floating point precision errors
      const precision = step.toString().split('.')[1]?.length || 0
      const factor = Math.pow(10, precision)

      let next = operation === 'increment'
        ? (Math.round(current * factor) + Math.round(step * factor)) / factor
        : (Math.round(current * factor) - Math.round(step * factor)) / factor

      // Clamp
      next = Math.max(min, Math.min(next, max))

      const nextStr = String(next)
      setInputValue(nextStr)
      emitChange(nextStr)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        updateValue('increment')
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        updateValue('decrement')
      }
    }

    const currentNum = parseFloat(inputValue)
    const isAtMax = !isNaN(currentNum) && currentNum >= max
    const isAtMin = !isNaN(currentNum) && currentNum <= min

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            className
          )}
          {...props}
        />

        <div className="absolute top-0 right-0 h-full flex flex-col border-l">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-[50%] w-8 rounded-none rounded-tr-md px-2 hover:bg-muted"
            onClick={() => updateValue('increment')}
            disabled={disabled || isAtMax}
            tabIndex={-1}
            aria-label="Increase value"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-[50%] w-8 rounded-none rounded-br-md px-2 hover:bg-muted border-t"
            onClick={() => updateValue('decrement')}
            disabled={disabled || isAtMin}
            tabIndex={-1}
            aria-label="Decrease value"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }
)

NumberInput.displayName = 'NumberInput'

export default NumberInput